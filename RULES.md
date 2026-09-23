# Martini Fusion Legal Hub - Operational Rules & Standards

This document establishes the binding architectural, operational, and legal integrity rules for **Martini Fusion Films - Legal Hub**. All human developers and AI coding agents (Gemini, Claude, Antigravity, Cursor) must comply strictly with these rules.

---

## 1. Company Identity & Legal Baseline
- **Company Name (Arabic)**: شركة مرتيني فيوجن للإنتاج السينمائي
- **Company Name (English)**: Martini Fusion Film Production
- **Commercial Register**: 21396 (دمشق - الجمهورية العربية السورية)
- **Principal Owner**: Mustafa Martini (دمشق)
- **Legal Form Display**: The phrase "ذات الشخص الواحد المحدودة المسؤولية" and suffix "O.P.L.L.C" are omitted from public interface forms and display per explicit client instruction.
- **Reference Serial**: Contract reference codes strictly follow the pattern `MF-<code>-<year>-<number>` (e.g. `MF-ACT-2026-001`, `MF-ART-2026-001`, `MF-NDA-2026-001`).

---

## 2. Agent Coordination Protocol (Zero Collisions)
1. **Coordinate First**: Before making edits to any files under `Legal Hub/`, read `GEMINI_HANDOVER.md` Section 0. Add an entry describing the task and files touched, and mark `DONE` upon completion.
2. **Roles**: Gemini leads implementation and code execution; Claude acts as advisor and reviewer.
3. **No Overwrites**: Prefer small, surgical edits over wholesale file replacements.
4. **Documentation Sync**: Any architectural change must update `RULES.md`, `AGENTS.md`, and the handover log.

---

## 3. Strict Typography & Formatting Constraints
- **ZERO Em Dashes**: Never use em dashes anywhere in code, comments, commit messages, or markdown documentation. Use hyphens (-), colons (:), or parentheses instead.
- **Standard Numerals**: All numbers across the interface, contract letterhead, references, and printed body must use standard numerals (0-9). Eastern Arabic/Indic digits (٠-٩) are normalized automatically via input sanitization.
- **Parentheses**: Standardize all contract template parentheses to strictly single `( )`. Never generate nested or double parentheses like `(( ))` or `((( )))`.
- **Clean Typography**: No underlines (`text-decoration: underline`) in contract document text. Titles, labels, and party headings must be bold without underlines.
- **Color Identity**:
  - Primary Brand Red: `#AF1717` (used for sidebar, primary buttons, letterhead highlights)
  - Primary Dark Charcoal: `#151517` (used for secondary buttons, modal backgrounds)
  - Cream Background: `#FBF9F5` (used for document canvases)

---

## 4. Bilingual UI vs. Invariant Arabic Contract Content
- **Arabic-First Interface**: Arabic is the default language. English is toggled via the sidebar button (`#btnLang`).
- **Translation Boundary**: Only interface strings belong in `data/i18n.js` accessed via `t('key')`. Never hard-code Arabic or English UI text in `hub.js`.
- **Contract Integrity**: The contract text itself (`body` in `data/templates/*.js`), the header, footer, official company names, and signature blocks are **strictly Arabic and must NEVER be translated**, regardless of the interface language.

---

## 5. Contract Safety, Archival & Deletion Rules
- **Sent/Signed Preservation**: Contracts in `sent` or `signed` status are legally binding documents and **MUST NEVER be deleted**.
- **Deletion Prevention Prompt**: Any attempt to delete a sent or signed contract must immediately block deletion and display the mandatory compliance prompt:
  > *"Sent and signed contracts cannot be deleted. Would you like to archive this contract instead?"*
  > *(العقود المرسلة أو الموقعة لا يمكن حذفها نهائياً حفاظاً على السجلات القانونية. هل ترغب في نقل هذا العقد إلى الأرشيف؟)*
- **Drafts Only**: Permanent deletion is strictly restricted to draft contracts (`status === 'draft'`).
- **Bulk Toolbar Exclusivity**: Delete and Archive operations are exclusively housed on the **Bulk Selection Toolbar** (`#bulkBarHost`). Individual contract table rows must only contain execution actions: Edit, Send, PDF, and Print.

---

## 6. Execution Pipelines
- **Print**: Every print button must route through `printContractDirect(c)` -> `openPrintModal(c)`. This opens the In-App Print Modal allowing the user to select the number of copies (1-20) and audit contract readiness before dispatching to `window.print()`.
- **Send**: Every send button must route through `openSendModal(c, ...)` offering WhatsApp and Email dispatch with automated status transition tracking.
- **Export PDF**: Every PDF button must route through `downloadPdfDirect(c)`. PDF downloads must be silent, clean, vector A4 documents without pink field highlights, and must never trigger the print dialog.

---

## 7. Deployment & Security Baseline
- **GitHub Repository**: `saadbkadiri-dev/fusion-legal` (branch: `main`)
- **Hosting Platform**: Vercel production deployment at `https://fusion-legal.vercel.app`
- **Access Authentication**: Full-screen gate (`#authGate`) protecting all routes.
  - Access Password: `martini2026`
  - Features: Show/hide password eye toggle, autofocus, shake animation on invalid entry.
  - Session Persistence: Authenticated session stored in browser storage.
  - Logout Control: Dedicated `#btnLogout` button in the sidebar footer allows locking the hub on demand.

