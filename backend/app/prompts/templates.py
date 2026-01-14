"""
LLM Prompt Templates for the Sauna Design Interview Agent.

All prompts are designed for JSON-only responses for reliable parsing.
"""

# ============================================
# System Prompt (Persona + Rules)
# ============================================

SYSTEM_PROMPT = """Tu esi „Pirties projektavimo interviu" asistentas. Tavo tikslas – padėti surinkti informaciją individualizuotam pirties pasiūlymui.

Taisyklės:
1) Dirbk tik su pateikta sesijos informacija. Jei kažko trūksta – pažymėk kaip UNKNOWN.
2) Būk tikslus: nieko neišsigalvok. Jei neaišku – confidence mažas.
3) Grąžink tik JSON (be jokio papildomo teksto).
4) Gerbk privatumo principą: neišsaugok asmens duomenų, nebent pateikta ir būtina.
5) Pirties technologijų gairės (santrauka):
   - Pirties paskirtis ir scenarijus lemia išplanavimą.
   - Krosnis: periodinio kūrenimo → geriausias „minkštas" garas, bet reikia iškūrenti prieš; nuolatinio → patogu, bet garas kitoks.
   - Mikroklimatas sveikai pirčiai dažnai 60–80°C, per didelė temperatūra ir netinkamos medžiagos kelia rizikas.
   - Ventiliacija būtina (žmonės išnaudoja daug oro).
   - Garinėje vengti OSB, plastiko ir kitų sintetinių medžiagų."""


# ============================================
# Extraction Prompt (Slots + Summary + Unknown)
# ============================================

EXTRACTION_PROMPT = """Tu gauni dabartinę sesijos būseną `agent_state` ir naują kliento atsakymą `user_answer`.

Tavo užduotis:
1) Atnaujinti `slots`: įrašyti `value` ir `confidence` (0..1) tik tiems slotams, kuriuos galima pagrįsti atsakymu.
2) Sugeneruoti `round_summary`: 3–7 sakiniai apie tai, ką jau aiškiai supratai šiame raunde.
3) Sudaryti `unknown_slots`: slotų rinkinys, kurie vis dar trūksta (value null arba confidence < 0.55), surikiuoti nuo svarbiausio.
4) Niekada neišsigalvok reikšmių – jei tik spėjimas, confidence mažas (<=0.5).

Grąžink tik JSON šiuo formatu:
{{
  "updated_slots": {{ "<slot_key>": {{"value": ..., "confidence": 0.0}} ... }},
  "round_summary": "…",
  "unknown_slots": ["slot_key_1","slot_key_2", ...],
  "notes_for_backend": ["optional trumpi pastebėjimai (max 5)"]
}}

agent_state:
{agent_state}

user_answer:
{user_answer}"""


# ============================================
# Final Report Prompt (Markdown Report)
# ============================================

REPORT_PROMPT = """Sukurk galutinę ataskaitą Markdown formatu apie kliento pirties poreikius.

Taisyklės:
- Remkis tik agent_state (nieko neišsigalvok).
- Ataskaita turi būti konkreti ir praktiška: ką jau žinom, ką rekomenduojam, kas dar neaišku.
- Nurodyk 3–7 „Next steps" patikslinimų klausimus, jei dar yra spragų.
- Venk marketingo, rašyk kaip projektavimo konsultantas.

Rekomenduojama struktūra:
1. **Santrauka** – trumpas apibendrinimas
2. **Naudojimo scenarijus ir žmonės** – kas ir kaip naudosis
3. **Vieta ir infrastruktūra** – kur ir kokios galimybės
4. **Krosnis ir mikroklimatas** – techninės rekomendacijos
5. **Patalpų programa ir dydis** – erdvių poreikis
6. **Rizikos / konfliktai** – aptikti prieštaravimai
7. **Patikslinimų checklist** – kas dar nežinoma
8. **Pasiūlymo rėmai** – koks galėtų būti kitas žingsnis

Grąžink tik JSON:
{{
  "final_markdown": "..."
}}

agent_state:
{agent_state}"""


# ============================================
# Final Report Prompt WITH Contact Info
# ============================================

REPORT_WITH_CONTACT_PROMPT = """Sukurk galutinę ataskaitą Markdown formatu apie kliento pirties poreikius.

Taisyklės:
- Remkis tik agent_state (nieko neišsigalvok).
- Ataskaita turi būti konkreti ir praktiška: ką jau žinom, ką rekomenduojam, kas dar neaišku.
- Nurodyk 3–7 „Next steps" patikslinimų klausimus, jei dar yra spragų.
- Venk marketingo, rašyk kaip projektavimo konsultantas.

Ataskaitos pradžioje (prieš santrauką) įterpk kliento informaciją:
{contact_header}

Ataskaitos pabaigoje įterpk šį poraštės tekstą:
{footer_text}

Rekomenduojama struktūra:
1. **Santrauka** – trumpas apibendrinimas
2. **Naudojimo scenarijus ir žmonės** – kas ir kaip naudosis
3. **Vieta ir infrastruktūra** – kur ir kokios galimybės
4. **Krosnis ir mikroklimatas** – techninės rekomendacijos
5. **Patalpų programa ir dydis** – erdvių poreikis
6. **Rizikos / konfliktai** – aptikti prieštaravimai
7. **Patikslinimų checklist** – kas dar nežinoma
8. **Pasiūlymo rėmai** – koks galėtų būti kitas žingsnis

Grąžink tik JSON:
{{
  "final_markdown": "..."
}}

agent_state:
{agent_state}"""


# ============================================
# Clarification Question Prompt
# ============================================

CLARIFICATION_PROMPT = """Vartotojo atsakymas buvo neaiškus arba per bendras. Sugeneruok natūralų patikslinimo klausimą.

Sloto, kurį bandome patikslinti:
- Slot: {slot_key}
- Dabartinė reikšmė: {current_value}
- Confidence: {confidence}

Pradinė klausimas: {original_question}
Vartotojo atsakymas: {user_answer}

Sugeneruok vieną trumpą, draugišką patikslinimo klausimą lietuvių kalba.
Klausk konkrečiau, siūlyk pavyzdžius ar intervalus, jei tinka.

Grąžink tik JSON:
{{
  "clarification_question": "..."
}}"""


# ============================================
# Risk Explanation Prompt (Optional)
# ============================================

RISK_EXPLANATION_PROMPT = """Atsižvelgiant į agent_state, suformuluok trumpą paaiškinimą kiekvienai aktyviai rizikai.

Grąžink tik JSON:
{{
  "risk_explanations": [
    {{"code":"RISK_CODE","note":"1-2 sakiniai","evidence":["slot_key", "..."]}}
  ]
}}

agent_state:
{agent_state}

active_risk_codes:
{risk_codes}"""


# ============================================
# Helper Functions
# ============================================

def format_extraction_prompt(agent_state: dict, user_answer: str) -> str:
    """Format the extraction prompt with actual data."""
    import json
    return EXTRACTION_PROMPT.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        user_answer=user_answer,
    )


def format_report_prompt(
    agent_state: dict,
    contact_info: dict = None,
    report_footer: str = None,
) -> str:
    """Format the report prompt with actual data and optional contact/footer."""
    import json
    from datetime import datetime

    # If no contact info or footer, use simple prompt
    if not contact_info and not report_footer:
        return REPORT_PROMPT.format(
            agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        )

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

        contact_header = "\n".join(contact_parts)

    # Build footer
    footer_text = ""
    if report_footer:
        footer_text = f"\n---\n{report_footer}"

    return REPORT_WITH_CONTACT_PROMPT.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        contact_header=contact_header if contact_header else "(nėra kontaktinės informacijos)",
        footer_text=footer_text if footer_text else "(nėra poraštės)",
    )


def format_clarification_prompt(
    slot_key: str,
    current_value: str,
    confidence: float,
    original_question: str,
    user_answer: str,
) -> str:
    """Format the clarification prompt."""
    return CLARIFICATION_PROMPT.format(
        slot_key=slot_key,
        current_value=current_value,
        confidence=confidence,
        original_question=original_question,
        user_answer=user_answer,
    )


def format_risk_explanation_prompt(agent_state: dict, risk_codes: list) -> str:
    """Format the risk explanation prompt with actual data."""
    import json
    return RISK_EXPLANATION_PROMPT.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        risk_codes=json.dumps(risk_codes, ensure_ascii=False),
    )

# ============================================
# Follow-up Question Generation (Full Context)
# ============================================

FOLLOWUP_QUESTION_PROMPT_V2 = """Tu esi pirties projektavimo interviu asistentas. Sugeneruok natūralų klausimą pagal visą pokalbio kontekstą.

Pokalbio istorija (nuo pradžios iki dabar):
{conversation_history}

Surinkti duomenys:
{collected_slots}

Trūkstami duomenys:
{missing_slots}

Sugeneruok VIENĄ natūralų tęstinį klausimą lietuvių kalba, kuris:
1) Remtųsi tuo, ką klientas pasakė ankstesniuose atsakymuose
2) Padėtų surinkti informaciją apie vieną iš trūkstamų duomenų
3) Būtų draugiškas ir profesionalus
4) Nebūtų per ilgas (max 2 sakiniai)
5) Niekada nekartotų jau užduotų klausimų

Grąžink tik JSON:
{{
  "followup_question": "..."
}}"""


def format_followup_prompt_v2(
    conversation_history: list,
    collected_slots: dict,
    missing_slots: list,
) -> str:
    """Format the follow-up question generation prompt with full conversation context."""
    import json

    # Format conversation history
    history_str = "\n".join(conversation_history) if conversation_history else "(pokalbis dar neprasidėjo)"

    # Format collected slots for readability
    collected_text = []
    for key, slot in collected_slots.items():
        if isinstance(slot, dict) and slot.get("value"):
            conf = slot.get("confidence", 0)
            collected_text.append(f"- {key}: {slot['value']} (tikrumas: {conf:.0%})")
    collected_str = "\n".join(collected_text) if collected_text else "(dar nieko nesurinkta)"

    # Format missing slots
    missing_str = ", ".join(missing_slots) if missing_slots else "(visi duomenys surinkti)"

    return FOLLOWUP_QUESTION_PROMPT_V2.format(
        conversation_history=history_str,
        collected_slots=collected_str,
        missing_slots=missing_str,
    )

