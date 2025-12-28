"""
LLM Service - Google Gemini API Integration

Handles slot extraction and report generation using Gemini.
"""

import json
from typing import Dict, Any

from google import genai

from app.config import get_settings
from app.models import LLMExtractionResponse, SlotValue
from app.prompts.templates import (
    SYSTEM_PROMPT,
    format_extraction_prompt,
    format_report_prompt,
)

# Lazy load client
_gemini_client = None


def _get_client():
    """Get or create Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        settings = get_settings()
        _gemini_client = genai.Client(api_key=settings.google_api_key)
    return _gemini_client


async def extract_slots(
    agent_state: Dict[str, Any],
    user_answer: str,
) -> LLMExtractionResponse:
    """
    Extract slots from user's answer using Gemini.

    Args:
        agent_state: Current session state as dict
        user_answer: Combined user answer text

    Returns:
        LLMExtractionResponse with updated slots, summary, and unknown slots
    """
    client = _get_client()

    prompt = format_extraction_prompt(agent_state, user_answer)
    full_prompt = f"""{SYSTEM_PROMPT}

{prompt}"""

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=full_prompt,
    )

    # Parse JSON response
    response_text = response.text.strip()

    # Handle potential markdown code blocks
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        # Remove first line (```json) and last line (```)
        response_text = "\n".join(lines[1:-1])

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as e:
        # Fallback response on parse error
        print(f"JSON parse error: {e}")
        print(f"Response was: {response_text[:500]}")
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
    Generate final Markdown report using Gemini.

    Args:
        agent_state: Complete session state

    Returns:
        Markdown report string
    """
    client = _get_client()

    prompt = format_report_prompt(agent_state)
    full_prompt = f"""{SYSTEM_PROMPT}

{prompt}"""

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=full_prompt,
    )

    response_text = response.text.strip()

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
