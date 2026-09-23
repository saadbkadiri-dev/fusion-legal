# Legal Hub

Create and file contracts for MARTINI FUSION FILMS. Open `index.html` in Chrome. It works offline, needs no install, and keeps everything in the browser on this computer.

## What it does

| Page | Use |
|---|---|
| Templates (النماذج) | Pick a contract type. Each card shows the article count, fields to fill and review notes. |
| Contracts (العقود) | Everything created, searchable, filterable by status, grouped by production, type or status. Duplicate or delete from the row. |
| Company (بيانات الشركة) | The company's legal details, written once and filled into every contract. Pre-filled from the commercial registry certificate (register no. 0111023858). |
| Editor (محرر العقود) | Form on the reading-start side, live A4 preview beside it (right/left flip with the language). Click a highlighted field in the preview to edit it. The checklist shows blanks, payment totals and review notes. |

## Language

The whole interface is Arabic by default (right-to-left, Syrian legal terminology). The **English** button in the sidebar switches the interface to English (left-to-right) and back. The toggle changes the interface only. The contracts themselves (template `body`, company legal names, header, footer, signature block) are always Arabic and are never translated.

All interface text lives in `data/i18n.js`, once in Arabic and once in English. Never hard-code interface text in `hub.js`; add a key in both languages and use `t('key')`.

Print / Save PDF gives A4 pages with: the red logo top right, the company name and register number beside it, the contract reference number (`MF-ACT|ART|NDA-<year>-<number>`) at the far left, and a coloured full-width band at the very bottom of every page with the address, phone, email, website and "n / N" page number. The band colour (company red or charcoal) is a setting on the Company page. The "number of pages" clause fills itself in to match. In Chrome's print dialog choose "Save as PDF" and turn "Background graphics" on (the hub asks for it, but Chrome's dialog can override).

Each page is rendered as its own A4 sheet (the contract flows through one column per page), so the preview and the printout are identical.

## Back up

Work is saved in this browser only. Use **Back up (download)** in the sidebar now and then, and **Restore from backup** on another computer or browser. Restoring merges: contracts that exist in both keep the newer copy.

## Add a contract type

1. Copy `data/templates/nda.js` to `data/templates/<name>.js` and change it.
2. Add `<script src="data/templates/<name>.js"></script>` to `index.html`, before `hub.js`.

A template is one object: `id`, `category`, `en`, `ar`, `summary`, `articles`, `notes` (review notes shown in the checklist, never printed), `fields`, optional `schedule` (payment stages) and `body`.

`body` is one block per line:

```
T|Title                     centred title
H|Heading                   underlined heading
P|Paragraph                 plain paragraph
P?field|Paragraph           only printed if the field is filled
A|Article label:|text       article with an underlined label
L|1-|text                   numbered or lettered item
S|                          the payment schedule
SIGN|                       date and signature block
**bold underlined**         inline label
{{field}}                   a field from the form (blank line if empty)
{{c.name}} {{c.rep}} ...    company details (see data/company.js)
{{@pages}} {{@on}}          page count phrase, computed at print time
```

## How the three templates were checked

Each was typed from the PDF in `../Martini Contracts/`, then compared letter by letter against a repaired text extraction of that PDF (the PDFs store Arabic ligatures backwards, so the raw extraction is unusable). Differences are deliberate and limited to: obvious typos fixed (المسلس, صجفية, بمات, مقدراه, الهه, التصويت), hamza spelling standardised, one company name used everywhere, and the added signature block. Wording that looks wrong but is the original's (Article 5 and 9 of the actor agreement, Articles 2 and 5 of the artistic contract) is kept as is and flagged in the checklist.

Printed page counts match the originals: actor agreement 3, artistic contract 2, NDA 3.

## Known limits

- Pagination is measured in Chrome, so print from Chrome. Another browser may break lines slightly differently.
- The phone, email and website in the footer are placeholders until Saad enters the real ones on the Company page.
- The hub does not give legal advice. Templates reproduce the existing contracts; have counsel review before signing.
