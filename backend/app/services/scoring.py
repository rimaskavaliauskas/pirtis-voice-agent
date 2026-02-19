"""
Question Scoring and Selection Service

Deterministic selection of next questions based on scoring algorithm.
Includes skip rule evaluation to filter irrelevant questions.
"""

from typing import Any, Dict, List, Optional, Set

from app.models import Question, RiskFlag, SlotValue
from app.services.quick_policy import QuickPolicy, quick_adjustment


def evaluate_skip_rules(
    skip_rules: List[Dict[str, Any]],
    slots: Dict[str, SlotValue],
) -> Set[str]:
    """
    Evaluate skip rules against current slot values.

    Returns set of question IDs that should be skipped.
    """
    questions_to_skip = set()

    for rule in skip_rules:
        condition_slot = rule.get("condition_slot", "")
        condition_type = rule.get("condition_type", "")
        condition_values = rule.get("condition_values", [])
        skip_question_ids = rule.get("skip_question_ids", [])
        
        # Get slot value
        slot_value = slots.get(condition_slot)
        if slot_value is None:
            continue

        # Convert slot value to string for comparison
        slot_str = str(slot_value.value).lower() if slot_value.value else ""
        
        # Evaluate condition
        condition_met = False
        
        if condition_type == "contains_any":
            # Skip if slot contains any of the values
            for val in condition_values:
                if val.lower() in slot_str:
                    condition_met = True
                    break
                    
        elif condition_type == "not_contains_any":
            # Skip if slot does NOT contain any of the values
            contains_any = False
            for val in condition_values:
                if val.lower() in slot_str:
                    contains_any = True
                    break
            condition_met = not contains_any
            
        elif condition_type == "equals_any":
            # Skip if slot equals any of the values
            condition_met = slot_str in [v.lower() for v in condition_values]
            
        elif condition_type == "not_equals_any":
            # Skip if slot does NOT equal any of the values
            condition_met = slot_str not in [v.lower() for v in condition_values]
        
        if condition_met:
            questions_to_skip.update(skip_question_ids)

    return questions_to_skip


def calculate_question_score(
    question: Dict[str, Any],
    current_round: int,
    missing_slots: Set[str],
    active_risk_codes: Set[str],
    asked_question_ids: Set[str],
    required_slots: Set[str],
    weights: Dict[str, float],
) -> float:
    """Calculate score for a single question."""
    score = 0.0
    question_id = question.get("question_id", "")

    # Base priority
    base_priority = question.get("base_priority", 50)
    score += base_priority * weights.get("base_priority", 0.1)

    # Missing slots coverage
    slot_coverage = set(question.get("slot_coverage", []))
    covered_missing = len(slot_coverage & missing_slots)
    score += covered_missing * weights.get("missing_slot", 3.0)

    # Required slots bonus
    covered_required = len(slot_coverage & required_slots & missing_slots)
    score += covered_required * weights.get("required_slot_bonus", 2.0)

    # Risk coverage
    risk_coverage = set(question.get("risk_coverage", []))
    covered_risks = len(risk_coverage & active_risk_codes)
    score += covered_risks * weights.get("risk", 2.0)

    # Round fit bonus
    round_hint = question.get("round_hint")
    if round_hint == current_round:
        score += weights.get("round_fit", 1.5)

    # Asked penalty
    if question_id in asked_question_ids:
        score += weights.get("asked_penalty", -5.0)

    return score


def select_next_questions(
    questions: List[Dict[str, Any]],
    slots: Dict[str, SlotValue],
    risk_flags: List[RiskFlag],
    asked_question_ids: List[str],
    current_round: int,
    weights: Dict[str, float],
    slot_definitions: List[Dict[str, Any]],
    skip_rules: List[Dict[str, Any]] = None,
    count: int = 3,
    confidence_threshold: float = 0.55,
) -> List[Question]:
    """
    Select the next questions to ask based on scoring.
    
    Args:
        questions: All enabled questions from database
        slots: Current slot values
        risk_flags: Active risk flags
        asked_question_ids: Already asked question IDs
        current_round: Current round number (1-3)
        weights: Scoring weights from config
        slot_definitions: Slot definitions from database
        skip_rules: Skip rules to filter irrelevant questions
        count: Number of questions to select (default: 3)
        confidence_threshold: Confidence below which slot is "missing"

    Returns:
        List of Question objects (top N by score)
    """
    # Evaluate skip rules first
    questions_to_skip = set()
    if skip_rules:
        questions_to_skip = evaluate_skip_rules(skip_rules, slots)

    # Determine missing slots (not filled or low confidence)
    missing_slots = set()
    for slot_def in slot_definitions:
        slot_key = slot_def.get("slot_key") or slot_def.get("key")
        if slot_key:
            slot_value = slots.get(slot_key)
            if slot_value is None or slot_value.confidence < confidence_threshold:
                missing_slots.add(slot_key)

    # Get required slots
    required_slots = {
        s.get("slot_key") or s.get("key")
        for s in slot_definitions
        if s.get("is_required", False)
    }

    # Get active risk codes
    active_risk_codes = {rf.code for rf in risk_flags}

    # Convert asked IDs to set
    asked_set = set(asked_question_ids)

    # Score all enabled questions (excluding skipped ones)
    scored_questions = []
    for q in questions:
        if not q.get("enabled", True):
            continue
            
        question_id = q.get("question_id", "")
        
        # Skip if in skip list
        if question_id in questions_to_skip:
            continue

        score = calculate_question_score(
            question=q,
            current_round=current_round,
            missing_slots=missing_slots,
            active_risk_codes=active_risk_codes,
            asked_question_ids=asked_set,
            required_slots=required_slots,
            weights=weights,
        )

        scored_questions.append((score, q))

    # Sort by score (descending)
    scored_questions.sort(key=lambda x: x[0], reverse=True)

    # Take top N
    selected = []
    for score, q in scored_questions[:count]:
        text = q.get("text_lt") or q.get("text_en", "")

        selected.append(Question(
            id=q.get("question_id", ""),
            text=text,
            round_hint=q.get("round_hint"),
        ))

    return selected


def select_next_question_quick(
    questions: List[Dict[str, Any]],
    slots: Dict[str, SlotValue],
    slots_raw: Dict[str, Dict[str, Any]],
    risk_flags: List[RiskFlag],
    asked_question_ids: List[str],
    weights: Dict[str, float],
    slot_definitions: List[Dict[str, Any]],
    skip_rules: List[Dict[str, Any]],
    policy: QuickPolicy,
    last_question_id: Optional[str] = None,
    confidence_threshold: float = 0.55,
) -> Optional[Question]:
    """
    Select the next single question for Quick mode using base scoring + quick_adjustment.

    Args:
        questions: All enabled questions from database
        slots: Current slot values as SlotValue objects (for base scoring)
        slots_raw: Current slot values as raw dicts (for quick_adjustment)
        risk_flags: Active risk flags
        asked_question_ids: Already asked question IDs
        weights: Base scoring weights from config
        slot_definitions: Slot definitions from database
        skip_rules: Skip rules to filter irrelevant questions
        policy: QuickPolicy configuration
        last_question_id: ID of the last question asked (for dedup)
        confidence_threshold: Confidence below which slot is "missing"

    Returns:
        Single best Question, or None if no candidates remain
    """
    # Get top candidates using existing scoring (ignore round, set to 1)
    candidates = select_next_questions(
        questions=questions,
        slots=slots,
        risk_flags=risk_flags,
        asked_question_ids=asked_question_ids,
        current_round=1,  # Quick mode ignores rounds
        weights=weights,
        slot_definitions=slot_definitions,
        skip_rules=skip_rules,
        count=5,  # Get more candidates for re-ranking
        confidence_threshold=confidence_threshold,
    )

    if not candidates:
        return None

    # Build a lookup from question ID to full question dict for quick_adjustment
    q_lookup = {q.get("question_id"): q for q in questions}
    asked_set = set(asked_question_ids)

    # Re-rank with quick_adjustment
    scored = []
    for candidate in candidates:
        q_dict = q_lookup.get(candidate.id)
        if not q_dict:
            continue

        # Calculate base score (re-derive for this candidate)
        missing_slots = set()
        for slot_def in slot_definitions:
            slot_key = slot_def.get("slot_key") or slot_def.get("key")
            if slot_key:
                slot_value = slots.get(slot_key)
                if slot_value is None or slot_value.confidence < confidence_threshold:
                    missing_slots.add(slot_key)

        required_slots = {
            s.get("slot_key") or s.get("key")
            for s in slot_definitions
            if s.get("is_required", False)
        }

        base_score = calculate_question_score(
            question=q_dict,
            current_round=1,
            missing_slots=missing_slots,
            active_risk_codes={rf.code for rf in risk_flags},
            asked_question_ids=asked_set,
            required_slots=required_slots,
            weights=weights,
        )

        adj = quick_adjustment(
            question=q_dict,
            slots=slots_raw,
            policy=policy,
            last_question_id=last_question_id,
            asked_question_ids=asked_set,
        )

        final_score = base_score + adj
        scored.append((final_score, candidate))

    if not scored:
        return None

    # Sort by final score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Pick top, skipping last_question_id for dedup
    for score, candidate in scored:
        if candidate.id != last_question_id:
            return candidate

    # All candidates are the same as last — return top anyway
    return scored[0][1]
