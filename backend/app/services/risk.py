"""
Risk Rule Evaluation Service

Deterministic evaluation of risk rules against slot values.
"""

import re
from typing import Any, Dict, List

from app.models import RiskFlag, SlotValue


def _slot_contains_any(slot_value: Any, patterns: List[str]) -> bool:
    """
    Check if slot value contains any of the given patterns.

    Args:
        slot_value: The slot value (string or JSON)
        patterns: List of patterns to check for

    Returns:
        True if any pattern is found in the value
    """
    if slot_value is None:
        return False

    # Convert to string for matching
    value_str = str(slot_value).lower()

    for pattern in patterns:
        pattern_lower = pattern.lower()
        if pattern_lower in value_str:
            return True

    return False


def _slot_not_contains_any(slot_value: Any, patterns: List[str]) -> bool:
    """
    Check if slot value does NOT contain any of the given patterns.

    Args:
        slot_value: The slot value (string or JSON)
        patterns: List of patterns to check for

    Returns:
        True if NONE of the patterns are found
    """
    if slot_value is None:
        return True  # No value means it doesn't contain anything

    value_str = str(slot_value).lower()

    for pattern in patterns:
        pattern_lower = pattern.lower()
        if pattern_lower in value_str:
            return False

    return True


def _slot_eq_any(slot_value: Any, values: List[str]) -> bool:
    """
    Check if slot value equals any of the given values.

    Args:
        slot_value: The slot value
        values: List of values to check

    Returns:
        True if value matches any in the list
    """
    if slot_value is None:
        return False

    value_str = str(slot_value).lower().strip()

    for v in values:
        if v.lower().strip() == value_str:
            return True

    return False


def _evaluate_condition(
    slots: Dict[str, SlotValue],
    condition: Dict[str, Any],
) -> bool:
    """
    Evaluate a single condition against slots.

    Args:
        slots: Current slot values
        condition: Condition dict with slot and operator

    Returns:
        True if condition is met
    """
    slot_key = condition.get("slot")
    if not slot_key:
        return False

    slot = slots.get(slot_key)
    slot_value = slot.value if slot else None

    # Check different operators
    if "contains_any" in condition:
        return _slot_contains_any(slot_value, condition["contains_any"])

    if "not_contains_any" in condition:
        return _slot_not_contains_any(slot_value, condition["not_contains_any"])

    if "eq_any" in condition:
        return _slot_eq_any(slot_value, condition["eq_any"])

    return False


def _evaluate_rule(
    slots: Dict[str, SlotValue],
    rule_json: Dict[str, Any],
) -> bool:
    """
    Evaluate a risk rule against slot values.

    Args:
        slots: Current slot values
        rule_json: Rule definition with conditions

    Returns:
        True if rule matches (risk is active)
    """
    # Handle "all" (AND) operator
    if "all" in rule_json:
        conditions = rule_json["all"]
        return all(_evaluate_condition(slots, c) for c in conditions)

    # Handle "any" (OR) operator
    if "any" in rule_json:
        conditions = rule_json["any"]
        return any(_evaluate_condition(slots, c) for c in conditions)

    # Single condition
    return _evaluate_condition(slots, rule_json)


def evaluate_risk_rules(
    slots: Dict[str, SlotValue],
    rules: List[Dict[str, Any]],
) -> List[RiskFlag]:
    """
    Evaluate all risk rules against current slot values.

    Args:
        slots: Current slot values
        rules: List of risk rule definitions from database

    Returns:
        List of active RiskFlag objects
    """
    active_risks = []

    for rule in rules:
        if not rule.get("enabled", True):
            continue

        rule_json = rule.get("rule_json", {})

        if _evaluate_rule(slots, rule_json):
            # Extract evidence (which slots triggered this rule)
            evidence = []
            conditions = rule_json.get("all", rule_json.get("any", [rule_json]))
            if isinstance(conditions, list):
                for c in conditions:
                    slot_key = c.get("slot")
                    if slot_key:
                        evidence.append(slot_key)

            active_risks.append(RiskFlag(
                code=rule.get("code", "UNKNOWN"),
                severity=rule.get("severity", "medium"),
                note=rule.get("note_template"),
                evidence=evidence,
            ))

    return active_risks
