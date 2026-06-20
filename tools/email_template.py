#!/usr/bin/env python3
"""
email_template.py — Branded HTML email wrapper for Brains & Gains (AJMFit).

One source of truth for the look of every email — drips AND the welcome — so the
brand stays consistent. Table-based + inline styles for email-client safety
(Gmail, Outlook, Apple Mail). Web fonts load where supported and fall back to
Arial/Helvetica elsewhere.

Brand (from tailwind.config.ts):
  navy #1B2D50 · blue #1A7BFF · orange #F76B16 · offwhite #F4F6F9 · slate #64748B
Header banner already combines the AJMfit logo + cartoon avatar. The Chea mascot
sits in the footer. Kit auto-appends the compliant unsubscribe + address footer.
"""
from __future__ import annotations

SITE = "https://ajmfit.com"
BANNER_URL = f"{SITE}/BandGnewsletter.png"   # 1536x1024 -> shown at 600x400
AVATAR_URL = f"{SITE}/chea-avatar.jpg"        # Chea mascot, square
APPLY_URL = f"{SITE}/apply"
IG_URL = "https://www.instagram.com/anthony.j.martin"

NAVY, BLUE, ORANGE, OFFWHITE, SLATE = (
    "#1B2D50", "#1A7BFF", "#F76B16", "#F4F6F9", "#64748B"
)

_FONT_BODY = "'Barlow', Arial, Helvetica, sans-serif"
_FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"


def render(content_html: str, *, preheader: str,
           kicker: str = "The ISSA cert, one Thursday at a time") -> str:
    """Wrap inner body HTML in the full branded email shell."""
    return f"""\
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<title>Brains &amp; Gains</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">
<style>
  body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
  img {{ -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }}
  body {{ margin:0; padding:0; width:100%!important; background:{OFFWHITE}; }}
  a {{ color:{ORANGE}; }}
  .content p {{ margin:0 0 18px; }}
  .content ul {{ margin:0 0 18px; padding-left:20px; }}
  .content li {{ margin:0 0 9px; }}
  .content strong {{ color:{NAVY}; }}
  @media only screen and (max-width:620px) {{
    .wrap {{ width:100%!important; }}
    .px {{ padding-left:24px!important; padding-right:24px!important; }}
  }}
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:{OFFWHITE};">
  {_esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{OFFWHITE};">
  <tr><td align="center" style="padding:24px 12px;">

    <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(27,45,80,0.10);">

      <!-- Banner: AJMfit logo + avatar -->
      <tr><td style="background:{NAVY};">
        <a href="{SITE}" target="_blank">
          <img src="{BANNER_URL}" width="600" alt="AJMfit Newsletter — Brains &amp; Gains"
               style="width:100%;max-width:600px;height:auto;display:block;">
        </a>
      </td></tr>

      <!-- Orange accent + kicker -->
      <tr><td style="height:5px;background:{ORANGE};line-height:5px;font-size:5px;">&nbsp;</td></tr>
      <tr><td class="px" style="padding:22px 40px 0;">
        <p style="margin:0;font-family:{_FONT_DISPLAY};text-transform:uppercase;letter-spacing:2px;font-size:13px;font-weight:700;color:{BLUE};">
          Brains &amp; Gains
          <span style="color:{SLATE};font-weight:600;">&nbsp;·&nbsp;{_esc(kicker)}</span>
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td class="content px" style="padding:14px 40px 8px;font-family:{_FONT_BODY};font-size:16px;line-height:1.7;color:{NAVY};">
        {content_html}
      </td></tr>

      <!-- Divider -->
      <tr><td class="px" style="padding:8px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="border-top:2px solid {OFFWHITE};font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>

      <!-- Apply CTA -->
      <tr><td class="px" align="center" style="padding:24px 40px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td align="center" bgcolor="{ORANGE}" style="border-radius:10px;">
            <a href="{APPLY_URL}" target="_blank"
               style="display:inline-block;padding:14px 30px;font-family:{_FONT_DISPLAY};font-weight:700;font-size:17px;letter-spacing:1px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
              Apply for Coaching
            </a>
          </td>
        </tr></table>
      </td></tr>

    </table>

    <!-- Footer with Chea mascot -->
    <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
      <tr><td class="px" align="center" style="padding:26px 40px 8px;text-align:center;">
        <img src="{AVATAR_URL}" width="64" height="64" alt="Chea — AJMfit"
             style="width:64px;height:64px;border-radius:50%;border:3px solid {ORANGE};display:block;margin:0 auto;">
      </td></tr>
      <tr><td align="center" style="padding:6px 40px 2px;text-align:center;font-family:{_FONT_DISPLAY};font-weight:700;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:{NAVY};">
        Anthony J. Martin
      </td></tr>
      <tr><td align="center" style="padding:0 40px 14px;text-align:center;font-family:{_FONT_BODY};font-size:13px;color:{SLATE};">
        AJMfit — ISSA Certified Personal Trainer<br>
        <a href="{IG_URL}" target="_blank" style="color:{BLUE};text-decoration:none;">@anthony.j.martin</a>
        &nbsp;·&nbsp;
        <a href="{SITE}" target="_blank" style="color:{BLUE};text-decoration:none;">ajmfit.com</a>
      </td></tr>
    </table>

  </td></tr>
</table>
</body>
</html>"""


def _esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


if __name__ == "__main__":  # quick local preview
    import pathlib
    sample = ("<p>Welcome to <strong>Brains &amp; Gains</strong>. Every Thursday, "
              "one idea from the ISSA cert — read in 90 seconds.</p>"
              "<ul><li><strong>Science, not bro-myths</strong></li>"
              "<li><strong>Mindset for the long game</strong></li></ul>"
              "<p>Talk soon,<br>Anthony</p>")
    out = pathlib.Path(__file__).resolve().parents[1] / ".tmp" / "email-preview.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(render(sample, preheader="You're in. Here's the standard."),
                   encoding="utf-8")
    print("wrote", out)
