"""
LLM Service v2 - Enhanced with Pirtis Design Skill Integration

Tries Gemini first, falls back to Anthropic on quota errors.
Injects skill methodology into prompts for better question generation.
"""

import json
import re
from typing import Dict, Any, Optional

from google import genai
from anthropic import Anthropic

from app.config import get_settings
from app.models import LLMExtractionResponse, SlotValue
from app.prompts.templates import (
    SYSTEM_PROMPT,
    format_extraction_prompt,
    format_report_prompt,
    format_clarification_prompt,
)
from app.prompts.templates_v2 import (
    SYSTEM_PROMPT_V2,
    format_extraction_prompt_v2,
    format_followup_prompt_v3,
    format_report_prompt_v2,
)

_gemini_client = None
_anthropic_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        settings = get_settings()
        _gemini_client = genai.Client(api_key=settings.google_api_key)
    return _gemini_client


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        settings = get_settings()
        _anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def _extract_json(text):
    text = text.strip()
    json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if json_match:
        return json_match.group(1).strip()
    if text.startswith("{") or text.startswith("["):
        return text
    return text


def _extract_markdown_from_response(raw_text):
    """Extract markdown from LLM response."""
    try:
        json_text = _extract_json(raw_text)
        data = json.loads(json_text)
        md = data.get("final_markdown", "")
        if "\n" in md:
            md = md.replace("\n", "\n")
        return md
    except json.JSONDecodeError:
        pass

    match = re.search(r'"final_markdown"\s*:\s*"(.*)"', raw_text, re.DOTALL)
    if match:
        md = match.group(1)
        md = md.replace("\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
        return md.strip()

    if raw_text.strip().startswith("#"):
        return raw_text.strip()

    return ""


def _call_gemini(prompt: str) -> str:
    """Call Gemini API."""
    client = _get_gemini_client()
    response = client.models.generate_content(
        model="models/gemini-flash-latest",
        contents=prompt,
    )
    return response.text


def _call_anthropic(prompt: str) -> str:
    """Call Anthropic API."""
    client = _get_anthropic_client()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def _call_llm_with_fallback(prompt: str) -> str:
    """Try Gemini first, fall back to Anthropic on quota errors."""
    try:
        print("Trying Gemini...")
        result = _call_gemini(prompt)
        print("Gemini succeeded")
        return result
    except Exception as e:
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
            print(f"Gemini quota exceeded, falling back to Anthropic: {error_str[:100]}")
            try:
                result = _call_anthropic(prompt)
                print("Anthropic succeeded")
                return result
            except Exception as e2:
                print(f"Anthropic also failed: {e2}")
                raise e2
        else:
            print(f"Gemini error (not quota): {e}")
            raise e


async def extract_slots(agent_state, user_answer, use_skill: bool = True):
    """
    Extract slots from user answer using LLM.

    Args:
        agent_state: Current session state
        user_answer: User's response text
        use_skill: Whether to use enhanced skill-based prompts (default True)
    """
    if use_skill:
        prompt = format_extraction_prompt_v2(agent_state, user_answer)
        full_prompt = f"{SYSTEM_PROMPT_V2}\n\n{prompt}"
    else:
        prompt = format_extraction_prompt(agent_state, user_answer)
        full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"

    try:
        response_text = _call_llm_with_fallback(full_prompt)
        response_text = _extract_json(response_text)
        data = json.loads(response_text)

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
    except Exception as e:
        print(f"LLM Extract Error: {e}")
        return LLMExtractionResponse(
            updated_slots={},
            round_summary=f"Error: {str(e)[:100]}",
            unknown_slots=[],
            notes_for_backend=[str(e)],
        )


async def generate_report(
    agent_state: dict,
    contact_info: Optional[dict] = None,
    report_footer: Optional[str] = None,
    skill_content: Optional[dict] = None,
) -> str:
    """
    Generate final report using LLM with skill template.

    Args:
        agent_state: Current session state
        contact_info: Optional contact info dict with name, email, phone
        report_footer: Optional footer text from admin config
        skill_content: Optional skill content for template injection

    Returns:
        Markdown report string
    """
    if skill_content:
        prompt = format_report_prompt_v2(agent_state, contact_info, report_footer, skill_content)
        full_prompt = f"{SYSTEM_PROMPT_V2}\n\n{prompt}"
    else:
        prompt = format_report_prompt(agent_state, contact_info, report_footer)
        full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"

    try:
        raw_text = _call_llm_with_fallback(full_prompt)
        markdown = _extract_markdown_from_response(raw_text)

        if markdown:
            print(f"Report OK, length: {len(markdown)}")
            return markdown
        else:
            print("Failed to extract markdown")
            return "# Report Error\n\nCould not extract report."

    except Exception as e:
        print(f"Report error: {e}")
        return f"# Report Error\n\n{str(e)}"


async def generate_clarification_question(
    slot_key: str,
    current_value: str,
    confidence: float,
    original_question: str,
    user_answer: str,
) -> Optional[str]:
    """
    Generate a clarification question for a low-confidence slot.

    Args:
        slot_key: The slot that needs clarification
        current_value: Current extracted value
        confidence: Confidence score (should be < 0.6)
        original_question: The original question asked
        user_answer: User's vague answer

    Returns:
        Clarification question string or None on failure
    """
    prompt = format_clarification_prompt(
        slot_key=slot_key,
        current_value=current_value,
        confidence=confidence,
        original_question=original_question,
        user_answer=user_answer,
    )
    full_prompt = f"{SYSTEM_PROMPT_V2}\n\n{prompt}"

    try:
        response_text = _call_llm_with_fallback(full_prompt)
        response_text = _extract_json(response_text)
        data = json.loads(response_text)

        return data.get("clarification_question")
    except Exception as e:
        print(f"Clarification generation error: {e}")
        return None


async def translate_markdown(markdown: str, target_language: str) -> str:
    """Translate markdown report to target language."""

    lang_names = {
        'en': 'English',
        'ru': 'Russian',
        'lt': 'Lithuanian',
    }
    lang_name = lang_names.get(target_language, target_language)

    prompt = f"""Translate the following markdown document to {lang_name}.
Keep all markdown formatting (headers, tables, lists, bold, etc.) intact.
Only translate the text content, not the markdown syntax.

Document to translate:
{markdown}

Return ONLY the translated markdown, nothing else."""

    try:
        result = _call_llm_with_fallback(prompt)
        return result.strip()
    except Exception as e:
        print(f"Translation error: {e}")
        return f"# Translation Error\n\n{str(e)}"


async def translate_text(text: str, target_language: str) -> str:
    """Translate short text (question, summary) to target language."""

    lang_names = {
        'en': 'English',
        'ru': 'Russian',
        'lt': 'Lithuanian',
    }
    lang_name = lang_names.get(target_language, target_language)

    prompt = f"""Translate the following text to {lang_name}.
Keep the same tone and style. Return ONLY the translated text, nothing else.

Text to translate:
{text}"""

    try:
        result = _call_llm_with_fallback(prompt)
        return result.strip()
    except Exception as e:
        print(f"Text translation error: {e}")
        return text  # Return original on failure


async def generate_followup_question_v2(
    conversation_history: list,
    collected_slots: dict,
    missing_slots: list,
) -> str:
    """
    Generate contextual follow-up question using AI with full conversation context.
    Uses old prompt format (without skill integration).

    Args:
        conversation_history: List of formatted conversation entries
        collected_slots: Dict of collected slot data with values and confidence
        missing_slots: List of slot keys still needing data

    Returns:
        Follow-up question string, or None on failure
    """
    from app.prompts.templates import format_followup_prompt_v2

    print(f"AI followup context: {len(conversation_history)} history items, {len(missing_slots)} missing slots")

    prompt = format_followup_prompt_v2(
        conversation_history=conversation_history,
        collected_slots=collected_slots,
        missing_slots=missing_slots,
    )
    full_prompt = SYSTEM_PROMPT + "\n\n" + prompt

    try:
        response_text = _call_llm_with_fallback(full_prompt)
        response_text = _extract_json(response_text)
        data = json.loads(response_text)

        followup = data.get("followup_question")
        if followup:
            print(f"AI generated followup: {followup[:80]}...")
            return followup

        print("No followup_question in AI response")
        return None
    except Exception as e:
        print(f"Followup generation error: {e}")
        return None


async def generate_followup_question_v3(
    conversation_history: list,
    collected_slots: dict,
    missing_slots: list,
    skill_content: dict = None,
    language: str = "lt",
) -> str:
    """
    Generate contextual follow-up question using AI with skill methodology.

    This is the enhanced version that incorporates the Pirtis Design Skill
    for better question generation.

    Args:
        conversation_history: List of formatted conversation entries
        collected_slots: Dict of collected slot data with values and confidence
        missing_slots: List of slot keys still needing data
        skill_content: Skill content dict from get_skill_for_prompts()
        language: Session language code (lt/en/ru) for generating question in correct language

    Returns:
        Follow-up question string, or None on failure
    """
    print(f"AI followup v3 context: {len(conversation_history)} history items, {len(missing_slots)} missing slots, language={language}")

    prompt = format_followup_prompt_v3(
        conversation_history=conversation_history,
        collected_slots=collected_slots,
        missing_slots=missing_slots,
        skill_content=skill_content,
        language=language,
    )
    full_prompt = SYSTEM_PROMPT_V2 + "\n\n" + prompt

    try:
        response_text = _call_llm_with_fallback(full_prompt)
        response_text = _extract_json(response_text)
        data = json.loads(response_text)

        followup = data.get("followup_question")
        reasoning = data.get("reasoning", "")

        if followup:
            print(f"AI generated followup v3: {followup[:80]}...")
            if reasoning:
                print(f"  Reasoning: {reasoning[:60]}...")
            return followup

        print("No followup_question in AI response")
        return None
    except Exception as e:
        print(f"Followup v3 generation error: {e}")
        return None
