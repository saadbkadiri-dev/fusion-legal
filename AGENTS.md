# AGENTS.md - Repository Guidance for AI Assistants

This repository adheres to the **organizemyfiles** architecture standard, augmented by **Graphify** knowledge-graph intelligence.

---

## 1. Architecture Overview

```text
Legal Hub/
├── index.html            # Main SPA DOM entry point & auth gate overlay
├── hub.js                # Core controller, reactive state, routing, and render engines
├── hub.css               # Design system, responsive layouts, print media, brand tokens
├── data/
│   ├── i18n.js           # Bilingual dictionary (Arabic default, English toggle)
│   ├── company.js        # Official legal identities, commercial registry & letterhead data
│   ├── seed.js           # Default productions, sample agreements, and initialization data
│   └── templates/        # Business contract models and Arabic legal bodies
│       ├── actor.js      # Talent / Actor agreement template
│       ├── artistic.js   # Crew / Technician agreement template
│       └── nda.js        # Non-Disclosure Agreement template
├── assets/               # Brand assets (vector SVG logos in red, cream, charcoal) & PDF engine
├── graphify-out/         # Codebase knowledge graph & structural analysis
│   ├── graph.html        # Interactive visual network diagram
│   ├── graph.json        # Symbol and callflow dependency graph
│   └── GRAPH_REPORT.md   # Architectural community report & God Node index
├── RULES.md              # Binding operational and legal integrity rules
└── README.md             # Project documentation
```

---

## 2. Mandatory Agent Rules

1. **Check Handover Log First**: Always read and update `GEMINI_HANDOVER.md` Section 0 before and after file modifications.
2. **ZERO Em Dashes**: Never use em dashes anywhere. Use hyphens (-), colons (:), or parentheses instead.
3. **Contract Body Invariance**: The contract text in `data/templates/*.js` (`body`), headers, footers, company names, and signature blocks are strictly Arabic. Never translate them.
4. **All UI Text in i18n**: Never hardcode Arabic or English interface strings in `hub.js`. Always add keys to both `ar` and `en` dictionaries in `data/i18n.js`.
5. **Preserve Signed Contracts**: Never delete sent or signed contracts. Only drafts may be deleted. Deletion of signed contracts must prompt archiving instead.
6. **Unified Pipelines**:
   - Print -> `printContractDirect(c)` -> `openPrintModal(c)`
   - Send -> `openSendModal(c, ...)`
   - Export PDF -> `downloadPdfDirect(c)`
7. **Security & Deployment**:
   - Production URL: `https://fusion-legal.vercel.app`
   - Password: `martini2026`

---

## 3. Verification Commands

Before concluding any work, run the following verification checks:
```bash
# 1. Syntax & lint check
node -c "hub.js"
node -c "data/i18n.js"

# 2. Em dash audit (must return zero matches)
grep -n "—" hub.js hub.css index.html data/i18n.js

# 3. Graphify update (refresh knowledge graph)
graphify update .
```
