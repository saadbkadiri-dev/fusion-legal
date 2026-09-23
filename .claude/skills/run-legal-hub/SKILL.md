---
name: run-legal-hub
description: "Run, smoke-test, screenshot, and export physical A4 PDFs for the Legal Hub contract management platform. Use when asked to run, start, test, or preview Legal Hub, verify RTL layout and Arabic typography, check for forbidden company suffixes, or validate physical A4 print pagination."
---

# /run-legal-hub

Static client-side legal contract platform (`index.html`, `hub.css`, `hub.js`, `data/company.js`, `data/templates.js`). No build step or package dependencies. All paths below are relative to `Fusion/Legal Hub/` (this skill lives at `.claude/skills/run-legal-hub/` inside `Legal Hub`).

**Driver: `.claude/skills/run-legal-hub/driver.py`** (Python/Playwright script).

## Prerequisites

Python `playwright` package and a Chromium browser (standard Google Chrome installed in macOS `/Applications/` or Playwright Chromium):

```bash
python3 -c "import playwright" && echo "Playwright OK"
```

## Commands

All commands can be executed from the `Legal Hub/` directory or root:

```bash
# 1. Start local server in background (default port 8735)
python3 .claude/skills/run-legal-hub/driver.py serve 8735

# 2. Run automated RTL smoke test and visual verification
python3 .claude/skills/run-legal-hub/driver.py smoke 8735 /tmp/legal_hub_smoke

# 3. Export physical A4 PDFs for core contract templates
python3 .claude/skills/run-legal-hub/driver.py export-a4 8735 /tmp/legal_hub_a4

# 4. Stop local server
python3 .claude/skills/run-legal-hub/driver.py stop 8735
```

## What the Smoke Test Verifies

1. **RTL Integrity:** Confirms `<html dir="rtl">` attribute is present and verifies sidebar navigation renders on the right side of the screen.
2. **Editor Layout:** Confirms the contract input form sits on the right pane, while the live A4 preview sheet sits on the left pane.
3. **Legal Compliance:** Scans both company settings and contract preambles to ensure the forbidden phrase `ذات الشخص الواحد المحدودة المسؤولية` is completely absent.
4. **Console Hygiene:** Intercepts browser console and page errors to ensure zero JavaScript runtime exceptions.
5. **Screenshots:** Captures screenshots across Templates, Contracts table, Company Profile, and Live Editor views.

## Physical A4 Print Rules

Per the `print-layout-engineer` guidelines:
- Sheet dimensions: 210mm x 297mm (A4 portrait).
- Margins: 14mm top, 18mm sides, 18mm bottom.
- Page break control: `break-inside: avoid` and `page-break-inside: avoid` enforced on signature blocks and clause headers (`break-after: avoid`).
- Page numbering: Rendered at `@bottom-center` with explicit Left-to-Right marker `\200E` to prevent reversed digits (`1 / 3` instead of `3 / 1`).
- Signature lines: Enforced `min-height: 20mm` and `border-bottom: 1.5px solid #222` to guarantee visibility on physical paper output.

