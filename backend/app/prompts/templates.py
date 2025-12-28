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


def format_report_prompt(agent_state: dict) -> str:
    """Format the report prompt with actual data."""
    import json
    return REPORT_PROMPT.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
    )


def format_risk_explanation_prompt(agent_state: dict, risk_codes: list) -> str:
    """Format the risk explanation prompt with actual data."""
    import json
    return RISK_EXPLANATION_PROMPT.format(
        agent_state=json.dumps(agent_state, indent=2, ensure_ascii=False),
        risk_codes=json.dumps(risk_codes, ensure_ascii=False),
    )
