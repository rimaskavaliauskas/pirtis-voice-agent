"""
LLM Prompt Templates v2 - Enhanced with Pirtis Design Skill Integration

All prompts now incorporate the skill methodology for better question generation.
"""

# ============================================
# System Prompt (Enhanced with Skill Persona)
# ============================================

SYSTEM_PROMPT_V2 = """Tu esi patyręs pirties projektavimo konsultantas su 15 metų patirtimi. Vadovaujiesi „Pirties Laboratorijos" metodika.

PAGRINDINIAI PRINCIPAI:
1) Pradėk nuo VIZIJOS, ne nuo technikalijų
2) Pirmasis klausimas visada: "Papasakokite, kaip įsivaizduojate idealų pirties seansą..."
3) Detales ir variantus laikyk sau – klientui pateik rekomenduojamus sprendimus
4) Jei sprendimas nepatvirtintas – įtrauk į klausimų sąrašą

KRITINIAI PARAMETRAI (surinkti pirmiausia):
- Ploto limitas (visų sprendimų pagrindas)
- Žmonių skaičius (garinės dydis, plautai)
- Naudojimo tipas (šeimos / verslo / mišrus)
- Krosnies tipas (periodinio / nuolatinio)
- Statybos technologija (rąstai / karkasinė / mūrinė / bačka)

GARINĖS TAISYKLĖS:
- Plautų prioritetas (sėdimos vs gulimos) – išsiaiškink dialogo metu, fiksuok kaip faktą
- Žemos tradicinės durys rekomenduojamos
- 4 apšvietimo zonos: išėjimas, karštas vanduo, krosnis, pirtininko darbo zona
- Ventilacija KRITIŠKAI SVARBI – atskiras išėjimas nuo poilsio patalpos!

POILSIO PATALPA:
- Šildymas BŪTINAS (šilumos iš garinės per duris NEUŽTENKA)
- Svarbus klausimas: ar tik techninis šildymas, ar norima ESTETINĖS UGNIES?

IŠORINĖ INFRASTRUKTŪRA (dažnai pamirštama!):
- Karšto vandens zona (kubilas, rotenburas)
- Šalto vandens kubilas
- Lauko dušai

KĄ NEDARYTI:
- Nesiūlyk alternatyvių technologijų, nebent klientas prašo
- Nerašyk "Būtina aptarti" teksto vidury – perkelk į klausimų skyrių
- Nesiūlyk patalpų proporcijų (projektuotojo prerogatyva)
- Neišvardink visų šildymo variantų – pateik konkrečią rekomendaciją
- Niekada nepraleisk ventiliacijos aptarimo
- Nepamiršk išorinės infrastruktūros"""


# ============================================
# Enhanced Follow-up Question Prompt
# ============================================

# Language-specific settings for multilingual support
LANGUAGE_INSTRUCTIONS = {
    "lt": "SVARBU: Generuok klausimą LIETUVIŲ kalba!",
    "en": "IMPORTANT: Generate the question in ENGLISH!",
    "ru": "ВАЖНО: Генерируй вопрос на РУССКОМ ЯЗЫКЕ!",
}

ROLE_LABELS = {
    "lt": {"consultant": "Konsultantas", "client": "Klientas"},
    "en": {"consultant": "Consultant", "client": "Client"},
    "ru": {"consultant": "Консультант", "client": "Клиент"},
}

NO_HISTORY_TEXT = {
    "lt": "(pokalbis dar neprasidėjo)",
    "en": "(conversation hasn't started yet)",
    "ru": "(разговор ещё не начался)",
}

NO_DATA_TEXT = {
    "lt": "(dar nieko nesurinkta)",
    "en": "(no data collected yet)",
    "ru": "(данные ещё не собраны)",
}

ALL_DATA_TEXT = {
    "lt": "(visi duomenys surinkti)",
    "en": "(all data collected)",
    "ru": "(все данные собраны)",
}

FOLLOWUP_QUESTION_PROMPT_V3 = """You are an experienced sauna design consultant with 15 years of experience. Generate a natural follow-up question based on the methodology and conversation context.

{language_instruction}

{skill_methodology}

CONVERSATION HISTORY:
{conversation_history}

COLLECTED DATA:
{collected_slots}

MISSING DATA:
{missing_slots}

QUESTION GENERATION RULES:
1) If the conversation hasn't started yet – begin with a vision question about ideal sauna experience
2) If vision is already discussed – move to critical parameters (area, people count, stove type)
3) Build on what the client has already said
4) Be friendly and professional
5) Don't repeat questions already asked
6) One question – max 2 sentences

IMPORTANT: If the client mentioned something significant (e.g., lake, large budget, business use) – ask a related follow-up question.

CRITICAL: You MUST generate the question in the language specified above! The client expects to communicate in that language.

Return only JSON:
{{
  "followup_question": "...",
  "reasoning": "brief explanation why this question"
}}"""


# ============================================
# Enhanced Report Prompt with Skill Template
# ============================================

REPORT_PROMPT_V2 = """Sukurk galutinę projektavimo užduotį pagal Pirties Laboratorijos metodiką.

{skill_documentation_template}

TAISYKLĖS:
- Remkis tik surinkta informacija (nieko neišsigalvok)
- Nepatvirtintus dalykus perkelk į "KLAUSIMAI APTARIMUI" skyrių
- Nerašyk "Būtina aptarti" teksto vidury
- Pridėk "Projekto adekvatumo įvertinimą" ir "Rizikų analizę"
- Paminėk 15 metų patirtį

ATASKAITOS STRUKTŪRA:
I. PROJEKTO SANTRAUKA
   - Literatūrinė pastraipa apie viziją (~10 sakinių)
   - Esminių parametrų lentelė
   - Naudojimo scenarijai

II. STATYBOS TECHNOLOGIJA
   - Pasirinkta technologija
   - Implikacijos projektui

III. PATALPŲ SĄRAŠAS
   - Garinė (plautai, durys, apšvietimas, ventilacija, vanduo)
   - Poilsio patalpa (arbatos zona, šildymas)
   - Persirengimo zona
   - Tualetas
   - Išorės erdvės (terasos, papildomi pastatai)

IV. IŠORINĖ PIRTIES INFRASTRUKTŪRA (jei aktualu)
   - Karšto vandens zona (rotenburas / kubilas)
   - Šalto vandens zona (kubilas)
   - Lauko dušai

V. TECHNINIAI SPRENDIMAI
   - Krosnis
   - Ventiliacijos sistema

VI. PROJEKTO ADEKVATUMO ĮVERTINIMAS
   - Stipriosios pusės
   - Atitikimas poreikiams
   - Įgyvendinamumo vertinimas

VII. RIZIKŲ ANALIZĖ
   - Kritinės
   - Vidutinės

VIII. KLAUSIMAI APTARIMUI
   - Sprendimai, reikalaujantys patvirtinimo
   - Būtina išsiaiškinti prieš projektavimą

IX. PROJEKTAVIMO DARBŲ APIMTIS
   - Projektavimo eiga
   - Orientaciniai terminai

{contact_header}

{footer_text}

SESIJOS DUOMENYS:
{agent_state}

Grąžink tik JSON:
{{
  "final_markdown": "..."
}}"""


# ============================================
# Enhanced Extraction Prompt
# ============================================

EXTRACTION_PROMPT_V2 = """Tu esi pirties projektavimo konsultantas. Analizuok kliento atsakymą ir ištrauk struktūruotą informaciją.

KRITINIAI PARAMETRAI (prioritetas surinkimui):
1. purpose - Pirties paskirtis (šeimos poilsis, sveikatinimas, verslas, mišrus)
2. users - Naudotojai (kiek žmonių, amžius, specialūs poreikiai)
3. location - Vieta (miestas/kaimas, šalia vandens, klimatas)
4. size_direction - Ploto limitas ir ribojantys veiksniai
5. stove_type - Krosnies tipas (periodinio/nuolatinio kūrenimo)
6. fuel_type - Kuro tipas (malkos, elektra, dujos)
7. microclimate - Mikroklimato lūkesčiai (temperatūra, drėgnumas)
8. room_program - Patalpų programa (garinė, poilsio, dušai, etc.)
9. infrastructure - Infrastruktūra (vanduo, elektra, kanalizacija)
10. budget - Biudžetas
11. timeline - Terminai
12. ritual - Pirties ritualas (tradicinis, modernus)

TAISYKLĖS:
- Confidence >= 0.7: aiški, konkreti informacija
- Confidence 0.4-0.7: dalinė informacija arba spėjimas
- Confidence < 0.4: labai neaiški informacija
- Niekada neišsigalvok – jei tik spėjimas, confidence mažas

SESIJOS BŪSENA:
{agent_state}

KLIENTO ATSAKYMAS:
{user_answer}

Grąžink tik JSON:
{{
  "updated_slots": {{ "<slot_key>": {{"value": ..., "confidence": 0.0}} ... }},
  "round_summary": "3-7 sakiniai apie tai, ką supratai",
  "unknown_slots": ["slot_key_1", "slot_key_2", ...],
  "notes_for_backend": ["pastabos (max 5)"]
}}"""


# ============================================
# Helper Functions (Updated)
# ============================================

def format_extraction_prompt_v2(agent_state: dict, user_answer: str) -> str:
    """Format the enhanced extraction prompt with actual data."""
    import json
    return EXTRACTION_PROMPT_V2.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        user_answer=user_answer,
    )


def format_followup_prompt_v3(
    conversation_history: list,
    collected_slots: dict,
    missing_slots: list,
    skill_content: dict = None,
    language: str = "lt",
) -> str:
    """Format the enhanced follow-up prompt with skill methodology and language support."""
    import json

    # Get language-specific instruction
    language_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["lt"])

    # Format conversation history
    no_history = NO_HISTORY_TEXT.get(language, NO_HISTORY_TEXT["lt"])
    history_str = "\n".join(conversation_history) if conversation_history else no_history

    # Format collected slots for readability
    no_data = NO_DATA_TEXT.get(language, NO_DATA_TEXT["lt"])
    collected_text = []
    for key, slot in collected_slots.items():
        if isinstance(slot, dict) and slot.get("value"):
            conf = slot.get("confidence", 0)
            collected_text.append(f"- {key}: {slot['value']} ({conf:.0%})")
    collected_str = "\n".join(collected_text) if collected_text else no_data

    # Format missing slots
    all_data = ALL_DATA_TEXT.get(language, ALL_DATA_TEXT["lt"])
    missing_str = ", ".join(missing_slots) if missing_slots else all_data

    # Get skill methodology section
    skill_methodology = ""
    if skill_content and skill_content.get('methodology'):
        skill_methodology = f"METHODOLOGY:\n{skill_content['methodology'][:2000]}"  # Limit length

    return FOLLOWUP_QUESTION_PROMPT_V3.format(
        language_instruction=language_instruction,
        skill_methodology=skill_methodology,
        conversation_history=history_str,
        collected_slots=collected_str,
        missing_slots=missing_str,
    )


def format_report_prompt_v2(
    agent_state: dict,
    contact_info: dict = None,
    report_footer: str = None,
    skill_content: dict = None,
) -> str:
    """Format the enhanced report prompt with skill template."""
    import json
    from datetime import datetime

    # Build contact header
    contact_header = ""
    if contact_info:
        name = contact_info.get("name", "")
        email = contact_info.get("email", "")
        phone = contact_info.get("phone", "")
        date = datetime.now().strftime("%Y-%m-%d")

        contact_parts = []
        if name:
            contact_parts.append(f"**Klientas:** {name}")
        if email or phone:
            contact_details = " | ".join(filter(None, [email, phone]))
            contact_parts.append(f"**Kontaktai:** {contact_details}")
        contact_parts.append(f"**Data:** {date}")

        contact_header = "KLIENTO INFORMACIJA:\n" + "\n".join(contact_parts)

    # Build footer
    footer_text = ""
    if report_footer:
        footer_text = f"PORAŠTĖ:\n{report_footer}"

    # Get documentation template from skill
    documentation_template = ""
    if skill_content and skill_content.get('documentation_template'):
        documentation_template = f"DOKUMENTACIJOS ŠABLONAS:\n{skill_content['documentation_template'][:3000]}"

    return REPORT_PROMPT_V2.format(
        skill_documentation_template=documentation_template,
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        contact_header=contact_header if contact_header else "",
        footer_text=footer_text if footer_text else "",
    )
