"""
Email Service - Send reports via Resend.com

Sends the full sauna design report to clients via email with:
- HTML-formatted email body
- Markdown file attachment
"""

import base64
import markdown
import resend
from typing import Optional

from app.config import get_settings

settings = get_settings()


def send_report_email(
    to_email: str,
    to_name: str,
    report_markdown: str,
    session_id: str,
    language: str = "lt",
) -> bool:
    """
    Send the full report via email using Resend.com.

    Args:
        to_email: Recipient email address
        to_name: Recipient name
        report_markdown: Full markdown report content
        session_id: Session ID for filename
        language: Language code for subject line

    Returns:
        True if email sent successfully, False otherwise
    """
    # Check if email service is configured
    if not settings.resend_api_key or not settings.email_from:
        print("Email service not configured (RESEND_API_KEY or EMAIL_FROM missing)")
        return False

    resend.api_key = settings.resend_api_key

    # Prepare subject based on language
    subjects = {
        "lt": "Jūsų pirties projekto ataskaita",
        "en": "Your Sauna Project Report",
        "ru": "Ваш отчёт о проекте сауны",
    }
    subject = subjects.get(language, subjects["lt"])

    # Convert markdown to HTML for email body
    html_content = markdown.markdown(
        report_markdown,
        extensions=['tables', 'fenced_code']
    )

    # Wrap in basic email template
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #8B4513; border-bottom: 2px solid #8B4513; padding-bottom: 10px; }}
        h2 {{ color: #A0522D; margin-top: 30px; }}
        h3 {{ color: #CD853F; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #f5f5f5; }}
        tr:nth-child(even) {{ background-color: #fafafa; }}
        code {{ background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; }}
        blockquote {{ border-left: 4px solid #8B4513; margin: 20px 0; padding-left: 20px; color: #666; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <p>Sveiki, {to_name}!</p>
    <p>Ačiū, kad naudojotės mūsų pirties projektavimo paslauga. Žemiau rasite pilną jūsų projekto ataskaitą.</p>
    <hr>
    {html_content}
    <div class="footer">
        <p>Ši ataskaita buvo automatiškai sugeneruota Pirtis Voice Agent sistemos.</p>
        <p>Jei turite klausimų, susisiekite su mumis.</p>
    </div>
</body>
</html>
"""

    # Encode markdown for attachment
    attachment_content = base64.b64encode(report_markdown.encode('utf-8')).decode('utf-8')
    filename = f"pirties-ataskaita-{session_id[:8]}.md"

    try:
        response = resend.Emails.send({
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "attachments": [
                {
                    "filename": filename,
                    "content": attachment_content,
                }
            ],
        })
        print(f"Email sent successfully to {to_email}: {response}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
        return False


def extract_report_summary(full_markdown: str) -> str:
    """
    Extract Sections I-III from the full report for client display.

    Sections:
    - I. PROJEKTO SANTRAUKA (vision + parameters + scenarios)
    - II. STATYBOS TECHNOLOGIJA
    - III. PATALPŲ SĄRAŠAS

    Args:
        full_markdown: Complete markdown report

    Returns:
        Markdown containing only Sections I-III
    """
    lines = full_markdown.split('\n')
    summary_lines = []
    in_summary_section = False
    current_section = 0

    for line in lines:
        # Detect section headers (## I., ## II., etc. or # I., # II.)
        stripped = line.strip()

        # Check for section IV or later - stop collecting
        if any(marker in stripped for marker in ['## IV.', '# IV.', '## 4.', '# 4.', 'IV. ', '4. IŠORINĖ']):
            break

        # Check for title or sections I-III
        if stripped.startswith('#'):
            # Main title (keep it)
            if '# ' in stripped and not any(x in stripped for x in ['## ', '### ']):
                in_summary_section = True
            # Section headers I, II, III
            elif any(marker in stripped for marker in ['## I.', '# I.', '## 1.', '# 1.', 'I. PROJEKTO']):
                in_summary_section = True
                current_section = 1
            elif any(marker in stripped for marker in ['## II.', '# II.', '## 2.', '# 2.', 'II. STATYBOS']):
                in_summary_section = True
                current_section = 2
            elif any(marker in stripped for marker in ['## III.', '# III.', '## 3.', '# 3.', 'III. PATALPŲ']):
                in_summary_section = True
                current_section = 3

        if in_summary_section:
            summary_lines.append(line)

    summary = '\n'.join(summary_lines).strip()

    # Add note about full report
    summary += "\n\n---\n\n*Pilna ataskaita buvo išsiųsta jūsų el. paštu.*"

    return summary
