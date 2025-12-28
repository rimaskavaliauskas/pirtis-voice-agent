"""
LLM Service - Claude API Integration

Handles slot extraction and report generation using Claude.
"""

import json
import asyncio
from typing import Dict, Any

from anthropic import Anthropic

from app.config import get_settings
from app.models import LLMExtractionResponse, LLMReportResponse, SlotValue
from app.prompts.templates import (
    SYSTEM_PROMPT,
    format_extraction_prompt,
    format_report_prompt,
)

# Lazy load client
_anthropic_client = None


def _get_client() -> Anthropic:
    """Get or create Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")
        _anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


async def extract_slots(
    agent_state: Dict[str, Any],
    user_answer: str,
) -> LLMExtractionResponse:
    """
    Extract slots from user's answer using Claude.

    Args:
        agent_state: Current session state as dict
        user_answer: Combined user answer text

    Returns:
        LLMExtractionResponse with updated slots, summary, and unknown slots
    """
    settings = get_settings()
    client = _get_client()

    prompt = format_extraction_prompt(agent_state, user_answer)

    response = await asyncio.to_thread(
        client.messages.create,
        model=settings.anthropic_model,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse JSON response
    response_text = response.content[0].text.strip()

    # Handle potential markdown code blocks
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as e:
        # Fallback response on parse error
        return LLMExtractionResponse(
            updated_slots={},
            round_summary="Could not parse LLM response",
            unknown_slots=[],
            notes_for_backend=[f"JSON parse error: {str(e)}"],
        )

    # Convert updated_slots to proper format
    updated_slots = {}
    for key, value in data.get("updated_slots", {}).items():
        if isinstance(value, dict):
            updated_slots[key] = SlotValue(
                value=value.get("value"),
                confidence=value.get("confidence", 0.0),
            )

    return LLMExtractionResponse(
        updated_slots=updated_slots,
        round_summary=data.get("round_summary", ""),
        unknown_slots=data.get("unknown_slots", []),
        notes_for_backend=data.get("notes_for_backend", []),
    )


async def generate_report(agent_state: Dict[str, Any]) -> str:
    """
    Generate final Markdown report using Claude.

    Args:
        agent_state: Complete session state

    Returns:
        Markdown report string
    """
    settings = get_settings()
    client = _get_client()

    prompt = format_report_prompt(agent_state)

    response = await asyncio.to_thread(
        client.messages.create,
        model=settings.anthropic_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = response.content[0].text.strip()

    # Handle potential markdown code blocks
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        data = json.loads(response_text)
        return data.get("final_markdown", "# Report Generation Failed")
    except json.JSONDecodeError:
        # If we can't parse JSON, maybe it returned markdown directly
        if response_text.startswith("#"):
            return response_text
        return f"# Report Generation Error\n\nCould not parse response."
