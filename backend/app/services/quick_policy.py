"""
Quick Policy Service

Handles Quick mode interview logic: stop conditions, scoring adjustments,
and low-information streak detection.

Stage 1: No uncertain_slots, no micro-followups, no risk→goals.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class QuickPolicy:
    """Configuration for Quick interview mode."""
    enabled: bool = True
    max_questions: int = 8
    max_clarifications: int = 0
    low_info_streak_max: int = 2
    critical_slots: List[Dict[str, Any]] = field(default_factory=list)
    clarify_threshold: float = 0.55
    scoring_weights: Dict[str, float] = field(default_factory=lambda: {
        "missing_critical_slot_bonus": 2.0,
        "uncertain_critical_slot_bonus": 1.2,
        "resolve_risk_bonus": 0.0,
        "diversify_topic_penalty": 0.4,
        "repeat_slot_penalty": 0.7,
    })
    question_pool: Optional[Dict[str, List[str]]] = None  # {include_tags, exclude_tags}


def load_quick_policy(config_values: Dict[str, Any]) -> Optional[QuickPolicy]:
    """
    Parse modes.quick from brain config values.

    Args:
        config_values: Dict from brain_config._config_values
                       Expected key: "modes_quick" with full policy dict

    Returns:
        QuickPolicy if configured, None otherwise
    """
    raw = config_values.get("modes_quick")
    if not raw or not isinstance(raw, dict):
        return None

    if not raw.get("enabled", True):
        return None

    limits = raw.get("limits", {})
    scoring_raw = raw.get("scoring_overrides", {}).get("weights", {})

    # Build scoring weights with defaults
    default_weights = {
        "missing_critical_slot_bonus": 2.0,
        "uncertain_critical_slot_bonus": 1.2,
        "resolve_risk_bonus": 0.0,
        "diversify_topic_penalty": 0.4,
        "repeat_slot_penalty": 0.7,
    }
    scoring_weights = {**default_weights, **scoring_raw}

    return QuickPolicy(
        enabled=raw.get("enabled", True),
        max_questions=limits.get("max_questions", 8),
        max_clarifications=limits.get("max_clarifications", 0),
        low_info_streak_max=limits.get("low_info_streak_max", 2),
        critical_slots=raw.get("critical_slots", []),
        clarify_threshold=raw.get("clarify_threshold", 0.55),
        scoring_weights=scoring_weights,
        question_pool=raw.get("question_pool"),
    )


def evaluate_stop_conditions(
    policy: QuickPolicy,
    slots: Dict[str, Dict[str, Any]],
    asked_count: int,
    low_info_streak: int,
) -> Tuple[bool, Optional[str]]:
    """
    Check if Quick interview should stop.

    Returns:
        (should_stop, reason) where reason is one of:
        - "critical_slots_met"
        - "max_questions"
        - "low_info_streak"
        - None if should not stop
    """
    # 3A: All critical slots have value
    if policy.critical_slots:
        all_filled = True
        for cs in policy.critical_slots:
            slot_id = cs.get("id", "")
            slot_data = slots.get(slot_id, {})
            value = slot_data.get("value")
            if value is None:
                all_filled = False
                break
        if all_filled:
            return True, "critical_slots_met"

    # 3B: Max questions reached
    if asked_count >= policy.max_questions:
        return True, "max_questions"

    # 3C: Low information streak
    if low_info_streak >= policy.low_info_streak_max:
        return True, "low_info_streak"

    return False, None


def calculate_low_info(
    slots_before: Dict[str, Dict[str, Any]],
    slots_after: Dict[str, Dict[str, Any]],
    answer_text: str,
    min_text_length: int = 15,
) -> bool:
    """
    Determine if an answer provided no useful information.

    Returns True if:
    - No slots changed value, OR
    - Answer text is very short (< min_text_length chars)
    """
    # Very short answer = low info
    if len(answer_text.strip()) < min_text_length:
        return True

    # Count slots that got a new or changed value
    updates = 0
    for key, after_data in slots_after.items():
        before_data = slots_before.get(key, {})
        before_val = before_data.get("value")
        after_val = after_data.get("value")

        # New value appeared
        if before_val is None and after_val is not None:
            updates += 1
        # Value changed
        elif before_val != after_val and after_val is not None:
            updates += 1

    return updates == 0


def quick_adjustment(
    question: Dict[str, Any],
    slots: Dict[str, Dict[str, Any]],
    policy: QuickPolicy,
    last_question_id: Optional[str] = None,
    asked_question_ids: set = None,
) -> float:
    """
    Calculate additional score adjustment for Quick mode.

    Added on top of the base score from the existing scoring algorithm.
    """
    if asked_question_ids is None:
        asked_question_ids = set()

    adjustment = 0.0
    weights = policy.scoring_weights
    slot_coverage = set(question.get("slot_coverage", []))
    critical_slot_ids = {cs["id"] for cs in policy.critical_slots}

    # Missing critical slot bonus
    for cs in policy.critical_slots:
        slot_id = cs["id"]
        if slot_id in slot_coverage:
            slot_data = slots.get(slot_id, {})
            if slot_data.get("value") is None:
                adjustment += weights.get("missing_critical_slot_bonus", 2.0)

    # Diversify topic penalty: penalize if same topic as last question
    if last_question_id:
        question_id = question.get("question_id", "")
        # Use slot_coverage overlap as proxy for "same topic"
        # If this question covers only slots that were already targeted by the last question,
        # it's likely the same topic — but we don't have last question's coverage here,
        # so we use a simpler heuristic: same round_hint = same topic area
        # Skip penalty if question covers a missing critical slot (important enough)
        covers_missing_critical = any(
            cs["id"] in slot_coverage and slots.get(cs["id"], {}).get("value") is None
            for cs in policy.critical_slots
        )
        if not covers_missing_critical and question_id == last_question_id:
            adjustment -= weights.get("diversify_topic_penalty", 0.4)

    # Repeat slot penalty: penalize if all covered slots already have values
    # and none changed after being asked before
    if slot_coverage:
        all_covered_filled = all(
            slots.get(s, {}).get("value") is not None
            for s in slot_coverage
        )
        if all_covered_filled:
            adjustment -= weights.get("repeat_slot_penalty", 0.7)

    return adjustment


def calculate_quick_progress(
    policy: QuickPolicy,
    slots: Dict[str, Dict[str, Any]],
) -> int:
    """
    Calculate progress percentage for Quick mode based on critical slots filled.
    """
    if not policy.critical_slots:
        return 0

    filled = sum(
        1 for cs in policy.critical_slots
        if slots.get(cs["id"], {}).get("value") is not None
    )
    return int(100 * filled / len(policy.critical_slots))
