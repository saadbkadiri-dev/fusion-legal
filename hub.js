/* MARTINI FUSION FILMS, Legal Hub. Plain JS, no dependencies, works offline from file://.
   Interface language: Arabic by default, English toggle (data/i18n.js). Contract text is never translated. */
(() => {
'use strict';

const KEY = 'fusionLegalHub.v1', LANG_KEY = 'fusionLegalHub.lang';
const TPL = window.TEMPLATES || [];
const tplById = id => TPL.find(t => t.id === id);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- language ---------- */
let LANG = 'ar';
try { LANG = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'; } catch (e) { /* storage blocked */ }
const toArabicDigits = s => String(s ?? '')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const t = (k, v) => {
  let s = window.I18N[LANG][k] ?? window.I18N.en[k] ?? k;
  if (v) for (const x in v) s = s.split('{' + x + '}').join(toArabicDigits(v[x]));
  return s;
};
const tOr = (k, fallback) => window.I18N[LANG][k] ?? fallback;     // template metadata: Arabic in the dictionary, English fallback in the template
const STATUS_KEYS = ['draft', 'sent', 'signed', 'void'];
const stName = s => t('st.' + s);
const PAGE_WORDS = { 1: 'صفحة واحدة', 2: 'صفحتين', 3: 'ثلاث صفحات', 4: 'أربع صفحات', 5: 'خمس صفحات', 6: 'ست صفحات', 7: 'سبع صفحات', 8: 'ثماني صفحات', 9: 'تسع صفحات', 10: 'عشر صفحات' };
const pagesWords = n => LANG === 'ar' ? (PAGE_WORDS[n] || toArabicDigits(n) + ' صفحات') : (n === 1 ? 'page' : 'pages');
function applyLang() {
  const h = document.documentElement;
  h.lang = LANG; h.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app.title') + ' | MARTINI FUSION FILMS';
  $$('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  $$('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle); });
}
const tSummary = tp => tOr('tpl.' + tp.id + '.summary', tp.summary);
const tNotes = tp => (tp.notes || []).map((n, i) => tOr('tpl.' + tp.id + '.n' + (i + 1), n));
const tGroup = g => tOr('grp.' + g, g);
const tCat = c => tOr('cat.' + c, c);
const tHint = f => (f.hint ? tOr('hint.' + f.id, f.hint) : '');
const fieldLabels = f => (LANG === 'ar' ? [f.ar || f.label, f.ar ? f.label : ''] : [f.label, f.ar || '']);   // [main, secondary]

/* ---------- storage ---------- */
let memDB = null, storageWarned = false;
function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) { /* storage blocked */ }
  return memDB || { contracts: [], company: {}, projects: [] };
}
let DB = load();
window.DB = DB;
DB.contracts = DB.contracts || [];
function ensureSeedData() {
  if (!window.SEED_DATA) return;
  DB.projects = DB.projects || [];
  DB.contracts = DB.contracts || [];
  
  const existingRefs = new Set(DB.contracts.map(c => c.ref));
  const existingPrjNames = new Map();
  DB.projects.forEach(p => { if (p.name) existingPrjNames.set(p.name.trim().toLowerCase(), p); });

  let changed = false;
  (window.SEED_DATA.projects || []).forEach(sp => {
    const key = (sp.name || '').trim().toLowerCase();
    if (!existingPrjNames.has(key)) {
      const copy = JSON.parse(JSON.stringify(sp));
      DB.projects.push(copy);
      existingPrjNames.set(key, copy);
      changed = true;
    }
  });

  (window.SEED_DATA.contracts || []).forEach(sc => {
    if (!existingRefs.has(sc.ref)) {
      const copy = JSON.parse(JSON.stringify(sc));
      const pKey = (copy.project || '').trim().toLowerCase();
      const prj = existingPrjNames.get(pKey);
      if (prj) {
        copy.projectId = prj.id;
        copy.project = prj.name;
      }
      DB.contracts.push(copy);
      existingRefs.add(copy.ref);
      changed = true;
    }
  });

  DB.contracts.forEach(c => {
    if (!c.projectId && c.project) {
      const pKey = c.project.trim().toLowerCase();
      const prj = existingPrjNames.get(pKey);
      if (prj) c.projectId = prj.id;
    }
  });

  if (changed || (DB.migrated || 0) < 7) {
    DB.migrated = 7;
    save();
  }
}
ensureSeedData();
DB.company = Object.assign({}, window.COMPANY_DEFAULTS, DB.company || {});
// settings saved by an earlier version keep their old defaults; move them to the current ones once
if ((DB.migrated || 0) < 3) {
  const c = DB.company, d = window.COMPANY_DEFAULTS;
  if (!c.nameConfirmed) { c.name = d.name; c.nameConfirmed = d.nameConfirmed; }
  c.nameVariants = d.nameVariants;
  delete c.letterhead;
  const seq = {};
  DB.contracts.slice().sort((a, b) => a.created - b.created).forEach(x => {
    if (x.ref) return;
    const tp = window.TEMPLATES.find(p => p.id === x.tpl), y = new Date(x.created).getFullYear(), key = tp.code + y;
    seq[key] = (seq[key] || 0) + 1; x.ref = `MF-${tp.code}-${y}-${String(seq[key]).padStart(3, '0')}`;
  });
  DB.migrated = 3;
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage blocked */ }
}
if ((DB.migrated || 0) < 4) {   // Saad asked for the single-person LLC wording to be removed from the forms
  const c = DB.company, d = window.COMPANY_DEFAULTS;
  c.nameVariants = d.nameVariants;
  if (c.name) c.name = c.name.replace(/\s*ذات الشخص الواحد المحدودة المسؤولية\s*/g, ' ').trim();
  if (c.legalForm && c.legalForm.includes('ذات الشخص الواحد')) c.legalForm = '';
  DB.migrated = 4;
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage blocked */ }
}
if ((DB.migrated || 0) < 5) {   // Saad asked for contract reference prefix to be MF instead of FF
  (DB.contracts || []).forEach(x => {
    if (x.ref && x.ref.startsWith('FF-')) x.ref = 'MF-' + x.ref.slice(3);
  });
  DB.migrated = 5;
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage blocked */ }
}
if ((DB.migrated || 0) < 6) {   // Projects house contracts
  DB.projects = DB.projects || [];
  const known = new Map();
  DB.projects.forEach(p => { if (p.name) known.set(p.name.trim().toLowerCase(), p); });
  (DB.contracts || []).forEach(c => {
    const pName = (c.project || (c.values && c.values.series) || '').trim();
    if (!pName) return;
    const key = pName.toLowerCase();
    let prj = known.get(key);
    if (!prj) {
      prj = {
        id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: pName,
        code: (pName.slice(0, 4) || 'PRJ').toUpperCase(),
        type: 'series',
        year: new Date(c.created || Date.now()).getFullYear(),
        status: 'production',
        description: '',
        created: c.created || Date.now(),
        updated: c.updated || Date.now()
      };
      DB.projects.push(prj);
      known.set(key, prj);
    }
    c.projectId = prj.id;
    c.project = prj.name;
    if (c.values && c.values.series != null) c.values.series = prj.name;
  });
  DB.migrated = 6;
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage blocked */ }
}
function save() {
  memDB = DB;
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { if (!storageWarned) { storageWarned = true; toast(t('store.blocked')); } }
}
const co = () => DB.company;

let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

/* ---------- project & contract models ---------- */
const PROJECT_STATUSES = ['development', 'production', 'post', 'completed', 'archived'];
const PROJECT_TYPES = ['series', 'film', 'doc', 'commercial', 'other'];

const projectById = id => (DB.projects || []).find(p => p.id === id);
const projectOf = c => {
  if (c.projectId) {
    const p = projectById(c.projectId);
    if (p) return p.name;
  }
  return (c.project || val(c, 'series') || '').trim();
};
const contractsOfProject = (pid, includeArchived = false) => {
  const prj = projectById(pid);
  const pName = prj ? prj.name.trim().toLowerCase() : '';
  return (DB.contracts || []).filter(c => {
    if (!includeArchived && c.archived) return false;
    return c.projectId === pid || (pName && (c.project || '').trim().toLowerCase() === pName);
  });
};

function createProject(data) {
  const prj = {
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: (data.name || '').trim(),
    code: (data.code || '').trim(),
    type: data.type || 'series',
    year: parseInt(toArabicDigits(data.year), 10) || new Date().getFullYear(),
    status: data.status || 'production',
    description: (data.description || '').trim(),
    created: Date.now(),
    updated: Date.now()
  };
  DB.projects = DB.projects || [];
  DB.projects.push(prj);
  save();
  return prj;
}

function updateProject(id, data) {
  const prj = projectById(id);
  if (!prj) return null;
  const oldName = prj.name;
  Object.assign(prj, data, { updated: Date.now() });
  if (data.name && data.name !== oldName) {
    (DB.contracts || []).forEach(c => {
      if (c.projectId === id || (c.project && c.project.trim().toLowerCase() === oldName.trim().toLowerCase())) {
        c.projectId = id;
        c.project = data.name;
        if (c.values && c.values.series != null) c.values.series = data.name;
      }
    });
  }
  save();
  return prj;
}

function deleteProject(id) {
  const prj = projectById(id);
  if (!prj) return;
  if (!confirm(t('p.delConfirm', { name: prj.name }))) return;
  (DB.contracts || []).forEach(c => {
    if (c.projectId === id) c.projectId = null;
  });
  DB.projects = (DB.projects || []).filter(p => p.id !== id);
  save();
  if (location.hash.startsWith('#/project/')) {
    location.hash = '#/contracts';
  } else {
    vContracts();
  }
}

function nextRef(tpl) {
  const pre = `MF-${tpl.code}-${new Date().getFullYear()}-`;
  const max = DB.contracts.reduce((m, c) => (c.ref && c.ref.startsWith(pre) ? Math.max(m, parseInt(c.ref.slice(pre.length), 10) || 0) : m), 0);
  return pre + String(max + 1).padStart(3, '0');
}
function newContract(tpl, projectId = null) {
  const values = {};
  tpl.fields.forEach(f => {
    if (f.def != null) values[f.id] = f.def;
    if (f.optDef != null) values[f.id + '_type'] = f.optDef;
  });
  let pName = '';
  if (projectId) {
    const prj = projectById(projectId);
    if (prj) {
      pName = prj.name;
      if (values.series !== undefined || tpl.fields.some(f => f.id === 'series')) {
        values.series = prj.name;
      }
    }
  }
  return { id: uid(), tpl: tpl.id, ref: nextRef(tpl), created: Date.now(), updated: Date.now(), status: 'draft',
    projectId: projectId || null, project: pName, notes: '', sig: true,
    date: today(), values, schedule: tpl.schedule ? tpl.schedule.map(r => ({ ...r })) : null };
}
const stSelClass = status => status === 'signed' ? 'stsel st-signed' : 'stsel';
const stClass = status => 'st-' + (status || 'draft');
const val = (c, id) => {
  let v = c.values[id];
  if ((v == null || v === '') && id.endsWith('_type')) {
    const baseId = id.replace(/_type$/, '');
    const tpl = tplById(c.tpl);
    const f = tpl?.fields?.find(x => x.id === baseId);
    if (f?.optDef) return f.optDef;
    if (f?.options?.[0]?.value) return f.options[0].value;
  }
  return String(v ?? '').trim();
};
const partyOf = c => val(c, 'p2name') || val(c, 'actorName') || val(c, 'crewName') || val(c, 'receivingParty') || val(c, 'secondParty') || '';

const getRoleInfo = (c) => {
  if (!c) return { key: 'other', label: '', icon: '', cls: 'other' };
  const roleText = (val(c, 'role') || '').toLowerCase();
  const taskText = (val(c, 'task') || '').toLowerCase();
  const p2 = (partyOf(c) || '').toLowerCase();
  const hay = `${c.tpl || ''} ${taskText} ${roleText} ${p2}`.toLowerCase();

  const isMaleName = /(تيم|عبد|باسل|طارق|سامر|محمد|أحمد|عمر|علي|محمود|خالد|يوسف|حسن|حسين|جهاد|قصي|مكسيم|جمال|غسان|أيمن|سلوم|فايز|باسم|وسام|معتصم)/.test(p2);
  const isFemaleName = /(كاريس|سلافة|هند|نادين|رزان|ميريام|أمل|منى|ريم|رنا|ديما|وفاء|شكران|نسرين|سوزان|ميس|هيا|يارا|جيني|نور|لورا|كندا|روزينا|صفاء|صباح|سامية|فرح|سحر|عبير|نجلاء|رندة|تولين|ديمة|ماغي|ناديا|لونا|مروة|روعة|روان|هبة)/.test(p2);
  const isActressKeyword = /(ممثلة|actress)/.test(hay);
  const isFemale = !isMaleName && (isFemaleName || isActressKeyword);

  if (/(تصوير|dop|cinematograph|مدير تصوير)/.test(hay)) {
    return { key: 'dop', label: LANG === 'en' ? 'DoP' : 'مدير تصوير', icon: '', cls: 'dop' };
  }
  if (/(مخرج|إخراج|director)/.test(taskText) || c.tpl === 'director') {
    return { key: 'director', label: LANG === 'en' ? 'Director' : 'مخرج', icon: '', cls: 'director' };
  }
  if (/(صوت|sound|audio|مكساج)/.test(hay)) {
    return { key: 'sound', label: LANG === 'en' ? 'Sound' : 'مهندس صوت', icon: '', cls: 'sound' };
  }
  if (/(مونتاج|مونتير|editor|تلوين|مصحح ألوان)/.test(hay)) {
    return { key: 'editor', label: LANG === 'en' ? 'Editor' : 'مونتير', icon: '', cls: 'editor' };
  }
  if (/(إضاءة|gaffer|lighting)/.test(hay)) {
    return { key: 'gaffer', label: LANG === 'en' ? 'Gaffer' : 'إضاءة', icon: '', cls: 'gaffer' };
  }
  if (/(ديكور|art director|سينوغرافيا)/.test(hay)) {
    return { key: 'art_dir', label: LANG === 'en' ? 'Art Director' : 'مهندس ديكور', icon: '', cls: 'art_dir' };
  }
  if (/(سيناريو|سيناريست|مؤلف|كاتب|script|writer)/.test(hay)) {
    return { key: 'writer', label: LANG === 'en' ? 'Writer' : 'سيناريست', icon: '', cls: 'writer' };
  }
  if (/(مكياج|ماكياج|makeup)/.test(hay)) {
    return { key: 'makeup', label: LANG === 'en' ? 'Makeup' : 'ماكياج', icon: '', cls: 'makeup' };
  }
  if (/(ملابس|أزياء|costume|stylist)/.test(hay)) {
    return { key: 'costume', label: LANG === 'en' ? 'Costume' : 'تصميم أزياء', icon: '', cls: 'costume' };
  }
  if (/(مؤثرات|vfx|visual effects)/.test(hay)) {
    return { key: 'vfx', label: LANG === 'en' ? 'VFX' : 'مؤثرات بصرية', icon: '', cls: 'vfx' };
  }
  if (/(موسيقى|music|composer|ألحان)/.test(hay)) {
    return { key: 'music', label: LANG === 'en' ? 'Composer' : 'موسيقى تصويرية', icon: '', cls: 'music' };
  }
  if (c.tpl === 'actor' || /(ممثل|ممثلة|actor|actress)/.test(hay)) {
    if (isFemale) {
      return { key: 'actress', label: LANG === 'en' ? 'Actress' : 'ممثلة', icon: '', cls: 'actress' };
    }
    return { key: 'actor', label: LANG === 'en' ? 'Actor' : 'ممثل', icon: '', cls: 'actor' };
  }
  if (c.tpl === 'nda') {
    return { key: 'nda', label: LANG === 'en' ? 'NDA' : 'اتفاقية سرية', icon: '', cls: 'nda' };
  }
  return { key: 'crew', label: LANG === 'en' ? 'Crew' : 'فني', icon: '', cls: 'crew' };
};

function checks(c) {
  const tpl = tplById(c.tpl);
  const missing = tpl.fields.filter(f => f.req !== false && !val(c, f.id));
  const total = c.schedule ? c.schedule.reduce((s, r) => s + (Number(r.pct) || 0), 0) : null;
  return { missing, total, schedOff: total !== null && total !== 100 };
}

/* ---------- rendering the contract (always Arabic, never translated) ---------- */
function parseBody(body) {
  return body.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^([A-Z]+)(?:\?(\w+))?\|([\s\S]*)$/);
    if (!m) return { t: 'P', text: l };
    const [, tp, cond, rest] = m;
    if (tp === 'A' || tp === 'L') { const i = rest.indexOf('|'); return { t: tp, cond, label: rest.slice(0, i), text: rest.slice(i + 1) }; }
    return { t: tp, cond, text: rest };
  });
}

function token(key, ctx) {
  if (key === '@pages') return esc(PAGE_WORDS[ctx.pages] || toArabicDigits(ctx.pages) + ' صفحات');
  if (key === '@on') return ctx.pages === 2 ? 'عليهما' : 'عليها';
  if (key === 'director_clause') {
    const d = val(ctx.c, 'director');
    if (!d) return '';
    return ctx.c.tpl === 'artistic'
      ? ` إخراج (<span class="fld" data-f="director">${esc(toArabicDigits(d))}</span>)`
      : `والذي هو من إخراج (<span class="fld" data-f="director">${esc(toArabicDigits(d))}</span>) `;
  }
  if (key.startsWith('c.')) {
    const v = String(co()[key.slice(2)] ?? '').trim();
    return v ? `<span class="co">${esc(toArabicDigits(v))}</span>` : '<span class="fld blank"></span>';
  }
  const v = val(ctx.c, key);
  return `<span class="fld${v ? '' : ' blank'}" data-f="${esc(key)}">${v ? esc(toArabicDigits(v)) : ''}</span>`;
}
function inline(text, ctx) {
  let out = '', last = 0, m;
  const re = /\{\{([@\w.]+)\}\}|\*\*(.+?)\*\*/g;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    out += m[2] !== undefined ? `<b class="lbl">${esc(m[2])}</b>` : token(m[1], ctx);
    last = re.lastIndex;
  }
  return out + esc(text.slice(last));
}

function renderDoc(tpl, c, pages) {
  const ctx = { c, pages };
  let n = 0, html = '';
  for (const b of parseBody(tpl.body)) {
    if (b.cond && !val(c, b.cond)) continue;
    switch (b.t) {
      case 'T': html += `<h1 class="ct">${inline(b.text, ctx)}</h1>`; break;
      case 'H': html += `<h2 class="ch" data-s="s${++n}">${inline(b.text, ctx)}</h2>`; break;
      case 'P': html += `<p>${inline(b.text, ctx)}</p>`; break;
      case 'A': html += `<p class="art" data-s="s${++n}"><b class="lbl">${esc(b.label)}</b> ${inline(b.text, ctx)}</p>`; break;
      case 'L': html += `<p class="li"><span class="mk">${esc(b.label)}</span>${inline(b.text, ctx)}</p>`; break;
      case 'S': (c.schedule || []).forEach(r => { html += `<p class="li sch"><span class="mk"><bdi>${esc(toArabicDigits(r.pct))}%</bdi></span>${esc(toArabicDigits(r.text))}</p>`; }); break;
      case 'SIGN':
        if (c.sig === false) break;
        html += `<div class="sign"><p class="sd">تحريراً في ${esc(co().city)} بتاريخ <span class="fld${c.date ? '' : ' blank'}" data-f="@date"><bdi>${esc(toArabicDigits(c.date))}</bdi></span></p>
          <div class="sigcols"><div><b>الفريق الأول</b><span>${esc(co().nameShort || 'شركة مرتيني فيوجن للإنتاج السينمائي')}</span><span>${esc(co().rep || 'مصطفى مرتيني')}</span><i></i></div>
          <div><b>الفريق الثاني</b><span>${esc(val(c, 'p2name'))}</span><i></i></div></div></div>`;
        break;
    }
  }
  return html;
}

/* Pagination. The whole contract is laid out in a tall multi-column strip (one column per A4 page).
   Each printed page then shows one column through a clipping window, so the preview, the printout and
   the "number of pages" clause always agree, and header and footer sit exactly on every page. */
const COL_MM = 174, GAP_MM = 12, PITCH_MM = COL_MM + GAP_MM;   // the gap keeps a neighbouring page's edge letters out of the window
function layout(tpl, c) {
  let pages = 3, N = 1, jump = {};
  for (let it = 0; it < 4; it++) {
    const m = document.createElement('div');
    m.className = 'measure';
    m.innerHTML = `<div class="flow" style="width:${COL_MM * 12 + GAP_MM * 11}mm;column-count:12"><div class="doc" dir="rtl" lang="ar">${renderDoc(tpl, c, pages)}</div></div>`;
    document.body.appendChild(m);
    const flow = $('.flow', m), doc = $('.doc', m), fr = flow.getBoundingClientRect(), colPx = fr.width / (COL_MM * 12 + GAP_MM * 11) * PITCH_MM;
    const pageAt = r => Math.max(0, Math.floor(((r.left + r.right) / 2 - fr.left) / colPx));
    const rs = doc.lastElementChild.getClientRects();
    N = pageAt(rs[rs.length - 1]) + 1;
    jump = {};
    $$('[data-s]', doc).forEach(e => { jump[e.dataset.s] = pageAt(e.getClientRects()[0]); });
    m.remove();
    if (N === pages) break;
    pages = N;
  }
  return { N, pages: N, jump };
}

function renderPages(tpl, c) {
  const { N, pages, jump } = layout(tpl, c);
  const k = co(), doc = renderDoc(tpl, c, pages), ph = k.contactConfirmed ? '' : ' ph';
  const logoSrc = window.LOGO_RED_URI || 'assets/logo-red.svg';
  const head = `<div class="lh"><img class="lh-logo" src="${logoSrc}" alt="MARTINI FUSION FILMS">
    <div class="lh-id"><b>${esc(k.nameShort)}</b>${k.legalForm ? `<span>${esc(k.legalForm)}</span>` : ''}<span>س.ت <bdi dir="ltr">${esc(toArabicDigits(k.register))}</bdi></span></div>
    <div class="lh-ref"><small>رقم العقد</small><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi></div></div>`;
  let out = '';
  for (let i = 0; i < N; i++) {
    out += `<section class="pg fc-${k.footerColor === 'ink' ? 'ink' : 'red'}">${head}
      <div class="win"><div class="flow" style="width:${COL_MM * N + GAP_MM * (N - 1)}mm;column-count:${N};transform:translateX(-${PITCH_MM * i}mm)"><div class="doc" dir="rtl" lang="ar">${doc}</div></div></div>
      <div class="fb"><span class="fb-t${ph}">${esc(k.footerAddress)}<i>&middot;</i>هاتف <bdi dir="ltr">${esc(toArabicDigits(k.phone))}</bdi><i>&middot;</i><bdi dir="ltr">${esc(k.email)}</bdi><i>&middot;</i><bdi dir="ltr">${esc(k.website)}</bdi></span><span class="fb-n"><bdi dir="ltr">${i + 1} / ${N}</bdi></span></div></section>`;
  }
  return { html: `<div class="pages">${out}</div>`, N, jump };
}

/* ---------- views ---------- */
const F = {
  q: '', status: 'all', group: 'project', cat: 'All', tq: '',
  pq: '', pStatus: 'all', pType: 'all',
  prjPage: 1, prjPageSize: 10,
  cPage: 1, cPageSize: 10,
  selectedContracts: new Set(), activeContractId: null,
  collapsedGroups: new Set(), allGroupKeys: []
};
window.F = F;

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(Math.max(1, page), totalPages);
  const start = (curPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pagedItems = items.slice(start, end);
  return {
    items: pagedItems,
    total,
    totalPages,
    curPage,
    pageSize,
    from: total === 0 ? 0 : start + 1,
    to: end
  };
}

function renderPaginationBar(pInfo) {
  if (pInfo.total === 0) return '';
  const pageSizes = [10, 20, 50];
  const sizeOptions = pageSizes.map(sz => `<option value="${sz}"${pInfo.pageSize === sz ? ' selected' : ''}>${toArabicDigits(sz)}</option>`).join('');
  
  let pageButtons = '';
  for (let p = 1; p <= pInfo.totalPages; p++) {
    if (pInfo.totalPages > 7) {
      if (p !== 1 && p !== pInfo.totalPages && Math.abs(p - pInfo.curPage) > 1) {
        if (p === 2 || p === pInfo.totalPages - 1) pageButtons += '<span class="pg-ellipsis">...</span>';
        continue;
      }
    }
    pageButtons += `<button class="pg-btn${p === pInfo.curPage ? ' on' : ''}" data-page="${p}">${toArabicDigits(p)}</button>`;
  }

  return `<div class="pagination-bar">
    <div class="pg-size-wrap">
      <span>${t('pg.perPage')}</span>
      <select class="pg-size-select" data-pg-size>${sizeOptions}</select>
    </div>
    <div class="pg-info-text">${t('pg.showing', { from: toArabicDigits(pInfo.from), to: toArabicDigits(pInfo.to), total: toArabicDigits(pInfo.total) })}</div>
    <div class="pg-nav-btns">
      <button class="pg-btn" data-page="${pInfo.curPage - 1}" ${pInfo.curPage <= 1 ? 'disabled' : ''}>${t('pg.prev')}</button>
      ${pageButtons}
      <button class="pg-btn" data-page="${pInfo.curPage + 1}" ${pInfo.curPage >= pInfo.totalPages ? 'disabled' : ''}>${t('pg.next')}</button>
    </div>
  </div>`;
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('ago.now'); if (m < 60) return t('ago.min', { n: m });
  const h = Math.round(m / 60); if (h < 24) return t('ago.hour', { n: h });
  const d = Math.round(h / 24);
  if (d < 30) return t('ago.day', { n: d });
  const dt = new Date(ts);
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}
function nameBanner() {
  const k = co(), todo = [];
  if (!k.nameConfirmed) todo.push(t('ban.name'));
  if (!k.contactConfirmed) todo.push(t('ban.contact'));
  return todo.length ? `<div class="banner"><b>${t('ban.h')}</b><span>${t('ban.body', { items: todo.join(t('ban.join')) })}</span></div>` : '';
}

/* ---------- modals ---------- */
function closeModal() {
  const m = $('#modalOverlay');
  if (m) m.remove();
}

function openProjectModal(existing = null, onSaved = null) {
  closeModal();
  const div = document.createElement('div');
  div.id = 'modalOverlay';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-card">
    <div class="modal-h">
      <h3>${esc(existing ? t('modal.p.edit') : t('modal.p.new'))}</h3>
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="fld-row">
        <label for="pm-name"><span>${t('modal.p.name')} <span class="req">*</span></span></label>
        <input class="in" id="pm-name" dir="auto" placeholder="${esc(t('modal.p.name.ph'))}" value="${existing ? esc(existing.name) : ''}">
      </div>
      <div class="fld-grid">
        <div class="fld-row">
          <label for="pm-code"><span>${t('modal.p.code')}</span></label>
          <input class="in" id="pm-code" dir="ltr" placeholder="${esc(t('modal.p.code.ph'))}" value="${existing ? esc(existing.code || '') : ''}">
        </div>
        <div class="fld-row">
          <label for="pm-type"><span>${t('modal.p.type')}</span></label>
          <select class="in" id="pm-type">
            ${PROJECT_TYPES.map(k => `<option value="${k}"${existing && existing.type === k ? ' selected' : ''}>${esc(t('ptyp.' + k))}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="fld-grid">
        <div class="fld-row">
          <label for="pm-status"><span>${t('modal.p.status')}</span></label>
          <select class="in" id="pm-status">
            ${PROJECT_STATUSES.map(k => `<option value="${k}"${(existing ? existing.status : 'production') === k ? ' selected' : ''}>${esc(t('pst.' + k))}</option>`).join('')}
          </select>
        </div>
        <div class="fld-row">
          <label for="pm-year"><span>${t('modal.p.year')}</span></label>
          <input class="in" id="pm-year" type="number" dir="ltr" value="${existing ? existing.year : new Date().getFullYear()}">
        </div>
      </div>
      <div class="fld-row">
        <label for="pm-desc"><span>${t('modal.p.desc')}</span></label>
        <textarea class="in" id="pm-desc" dir="auto" placeholder="${esc(t('modal.p.desc.ph'))}">${existing ? esc(existing.description || '') : ''}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" id="modalCancel">${t('modal.p.cancel')}</button>
      <button class="btn pri" id="modalSave">${t('modal.p.save')}</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  $('#pm-name').focus();
  $('#modalClose').onclick = $('#modalCancel').onclick = closeModal;
  div.onclick = e => { if (e.target === div) closeModal(); };
  $('#modalSave').onclick = () => {
    const name = $('#pm-name').value.trim();
    if (!name) { alert(t('modal.p.valName')); $('#pm-name').focus(); return; }
    const payload = {
      name,
      code: $('#pm-code').value.trim(),
      type: $('#pm-type').value,
      status: $('#pm-status').value,
      year: parseInt($('#pm-year').value, 10) || new Date().getFullYear(),
      description: $('#pm-desc').value.trim()
    };
    let res;
    if (existing) {
      res = updateProject(existing.id, payload);
    } else {
      res = createProject(payload);
    }
    closeModal();
    if (onSaved) onSaved(res);
    else route();
  };
}

function openAddContractModal(projectId) {
  closeModal();
  const prj = projectById(projectId);
  const div = document.createElement('div');
  div.id = 'modalOverlay';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-card" style="max-width:480px">
    <div class="modal-h">
      <h3>${esc(prj ? prj.name : '')}: ${t('ws.addContract')}</h3>
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px">${t('ws.selectTpl')}</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${TPL.map(tp => `<button class="btn" style="padding:12px 16px;text-align:start;display:flex;flex-direction:column;gap:3px;border-radius:8px" data-tpl-add="${tp.id}">
          <b style="font-size:14px;color:var(--ink)">${esc(tp.ar)}</b>
          <span style="font-size:12px;color:var(--muted)">${esc(tp.en)} &middot; ${t('tpl.articles', { n: tp.articles })}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" id="modalCancel">${t('modal.p.cancel')}</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  $('#modalClose').onclick = $('#modalCancel').onclick = closeModal;
  div.onclick = e => { if (e.target === div) closeModal(); };
  div.querySelectorAll('[data-tpl-add]').forEach(btn => {
    btn.onclick = () => {
      const tplId = btn.dataset.tplAdd;
      closeModal();
      const c = newContract(tplById(tplId), projectId);
      DB.contracts.push(c);
      save();
      nav();
      location.hash = '#/c/' + c.id;
    };
  });
}

function openSendModal(c, onDone = null) {
  closeModal();
  const tp = tplById(c.tpl);
  const prjName = projectOf(c);
  const p2 = partyOf(c);
  const defaultPhone = val(c, 'p2phone') || val(c, 'phone') || '';
  const defaultEmail = val(c, 'p2email') || val(c, 'email') || '';

  const msgText = `تحية طيبة،
من شركة مرتيني فيوجن للإنتاج السينمائي
نرسل لكم تفاصيل مسودة العقد:
- العقد: ${tp.ar}
- المرجع: ${c.ref}
- المشروع: ${prjName || t('no.project')}
- الطرف الثاني: ${p2 || t('no.party')}

يرجى مراجعة التفاصيل، ويسعدنا التنسيق معكم لاعتماد النسخة وتوقيعها.
مع التقدير،
شركة مرتيني فيوجن للإنتاج السينمائي`;

  const emailSubject = `مسودة: ${c.ref} - ${p2 || tp.ar} | شركة مرتيني فيوجن للإنتاج السينمائي`;

  let mode = 'wa';

  const div = document.createElement('div');
  div.id = 'modalOverlay';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-card">
    <div class="modal-h">
      <h3>${t('send.h')}: <bdi dir="ltr">${esc(c.ref)}</bdi></h3>
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="send-opt-box on" id="optWa">
          <b>${t('send.wa')}</b>
          <p>${t('send.wa.desc')}</p>
        </div>
        <div class="send-opt-box" id="optMail">
          <b>${t('send.mail')}</b>
          <p>${t('send.mail.desc')}</p>
        </div>
      </div>
      <div id="boxTarget">
        <div class="fld-row" id="rowPhone">
          <label for="sm-phone"><span>${t('send.phoneIn')}</span></label>
          <input class="in" id="sm-phone" dir="ltr" placeholder="+963900000000" value="${esc(defaultPhone)}">
        </div>
        <div class="fld-row" id="rowEmail" style="display:none">
          <label for="sm-email"><span>${t('send.emailIn')}</span></label>
          <input class="in" id="sm-email" dir="ltr" placeholder="example@domain.com" value="${esc(defaultEmail)}">
        </div>
      </div>
      <div>
        <label for="msgPrev" style="display:block;font-weight:600;font-size:12.5px;color:var(--ink2);margin-bottom:6px">${t('send.preview')}</label>
        <textarea class="send-msg-preview" id="msgPrev" dir="auto" rows="5">${esc(msgText)}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" id="modalCancel">${t('send.cancel')}</button>
      <button class="btn pri" id="btnDoSend">${t('send.openWa')}</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  $('#modalClose').onclick = $('#modalCancel').onclick = closeModal;
  div.onclick = e => { if (e.target === div) closeModal(); };

  const optWa = $('#optWa'), optMail = $('#optMail');
  const rowPhone = $('#rowPhone'), rowEmail = $('#rowEmail');
  const btnDoSend = $('#btnDoSend');

  optWa.onclick = () => {
    mode = 'wa';
    optWa.classList.add('on'); optMail.classList.remove('on');
    rowPhone.style.display = ''; rowEmail.style.display = 'none';
    btnDoSend.textContent = t('send.openWa');
  };
  optMail.onclick = () => {
    mode = 'mail';
    optMail.classList.add('on'); optWa.classList.remove('on');
    rowPhone.style.display = 'none'; rowEmail.style.display = '';
    btnDoSend.textContent = t('send.openMail');
  };

  btnDoSend.onclick = () => {
    const finalMsg = ($('#msgPrev').value || msgText).trim();
    if (mode === 'wa') {
      const raw = $('#sm-phone').value.trim();
      const clean = raw.replace(/[^0-9]/g, '');
      const waUrl = clean ? `https://wa.me/${clean}?text=${encodeURIComponent(finalMsg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(finalMsg)}`;
      window.open(waUrl, '_blank');
    } else {
      const em = $('#sm-email').value.trim();
      const mailUrl = `mailto:${encodeURIComponent(em)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(finalMsg)}`;
      window.open(mailUrl, '_blank');
    }
    c.status = 'sent';
    c.updated = Date.now();
    save();
    closeModal();
    if (onDone) onDone();
    else route();
  };
}
window.openSendModal = window.sendModal = openSendModal;

// 2026-09-23, Claude. html2canvas cannot correctly render this document's
// normal CSS multi-column pagination (column-count), see GEMINI_HANDOVER.md
// sections 19 to 20 for the full diagnosis. This builds a SEPARATE set of
// plain, single-column, pre-paginated page elements (one whole element per
// physical page, no column-count, no clip transform) purely for html2canvas
// to capture, by measuring each top-level clause/heading's real height at
// 174mm width and greedily packing whole elements into 238mm-tall pages, so
// an element is never split across two pages. Does not touch or replace
// renderPages()/layout(), which remain exactly as they were for the live
// editor and printContractDirect.
function buildExportPageEls(tpl, c) {
  const layoutInfo = layout(tpl, c);
  const N_hint = layoutInfo.N;
  const k = co();
  const docHtml = renderDoc(tpl, c, N_hint);
  const ph = k.contactConfirmed ? '' : ' ph';
  const logoSrc = window.LOGO_RED_URI || 'assets/logo-red.svg';
  const headHtml = `<div class="lh"><img class="lh-logo" src="${logoSrc}" alt="MARTINI FUSION FILMS">
    <div class="lh-id"><b>${esc(k.nameShort)}</b>${k.legalForm ? `<span>${esc(k.legalForm)}</span>` : ''}<span>س.ت <bdi dir="ltr">${esc(toArabicDigits(k.register))}</bdi></span></div>
    <div class="lh-ref"><small>رقم العقد</small><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi></div></div>`;

  const measureWrap = document.createElement('div');
  measureWrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:174mm;background:#fff;';
  measureWrap.innerHTML = `<div class="doc" dir="rtl" lang="ar">${docHtml}</div>`;
  document.body.appendChild(measureWrap);
  const docEl = measureWrap.querySelector('.doc');
  const children = [...docEl.children];
  const mmPerPx = 174 / measureWrap.getBoundingClientRect().width;
  const docTopPx = docEl.getBoundingClientRect().top;
  // Bottom edge of each element relative to the top of the flow, in mm.
  // getBoundingClientRect().height alone does NOT include the element's own
  // margin, and .doc has real margins between paragraphs/articles/headings
  // (.doc p, .doc .ch, .doc .art). Summing bare heights silently dropped
  // all of that spacing, which underestimated total content height enough
  // (tens of mm over ~20 elements) that later list items ended up rendered
  // past the footer's position and hidden behind it, confirmed empirically
  // against a real contract before this fix. Using each element's actual
  // flow position (its bottom edge, relative to the first element's top)
  // accounts for every margin correctly, since the browser already laid
  // it out for us; nothing here is estimated.
  const bottomsMm = children.map(el => (el.getBoundingClientRect().bottom - docTopPx) * mmPerPx);

  // Safety margin below the .win's real 238mm box: html2canvas cannot
  // capture an overflow:hidden position:absolute element at all (it comes
  // out blank, confirmed empirically), so .win is rendered without clipping
  // below. Packing to a slightly shorter budget keeps a real margin of error
  // against the actual footer position instead of relying on a hard clip.
  const MAX_H = 225;
  const bins = [];
  let cur = [], pageStartMm = 0;
  children.forEach((el, i) => {
    const relBottom = bottomsMm[i] - pageStartMm;
    if (cur.length && relBottom > MAX_H) { bins.push(cur); cur = []; pageStartMm = bottomsMm[i - 1]; }
    cur.push(i);
  });
  if (cur.length) bins.push(cur);
  const N = Math.max(1, bins.length);

  const footerColorCls = k.footerColor === 'ink' ? 'ink' : 'red';
  const pageEls = bins.map((idxArr, i) => {
    const section = document.createElement('section');
    section.className = `pg fc-${footerColorCls} pdf-export-pg`;
    section.insertAdjacentHTML('afterbegin', headHtml);
    const win = document.createElement('div');
    win.style.cssText = 'position:absolute;top:34mm;left:18mm;width:174mm;height:238mm;';
    const innerDoc = document.createElement('div');
    innerDoc.className = 'doc';
    innerDoc.dir = 'rtl';
    innerDoc.lang = 'ar';
    idxArr.forEach(ci => innerDoc.appendChild(children[ci].cloneNode(true)));
    innerDoc.querySelectorAll('.fld').forEach(f => {
      f.style.setProperty('background', 'none', 'important');
      f.style.setProperty('background-color', 'transparent', 'important');
      f.style.setProperty('outline', '0', 'important');
      f.style.setProperty('box-shadow', 'none', 'important');
      if (f.classList.contains('blank')) {
        f.style.setProperty('min-width', '7.5em', 'important');
        f.style.setProperty('border-bottom', '0.3mm dotted #333', 'important');
      }
    });
    win.appendChild(innerDoc);
    section.appendChild(win);
    const fb = document.createElement('div');
    fb.className = 'fb';
    fb.innerHTML = `<span class="fb-t${ph}">${esc(k.footerAddress)}<i>&middot;</i>هاتف <bdi dir="ltr">${esc(toArabicDigits(k.phone))}</bdi><i>&middot;</i><bdi dir="ltr">${esc(k.email)}</bdi><i>&middot;</i><bdi dir="ltr">${esc(k.website)}</bdi></span><span class="fb-n"><bdi dir="ltr">${i + 1} / ${N}</bdi></span>`;
    section.appendChild(fb);
    return section;
  });

  document.body.removeChild(measureWrap);
  return { pageEls, N, N_hint };
}

async function downloadPdfDirect(c) {
  if (!c) return;
  const tp = tplById(c.tpl);
  if (!partyOf(c).trim()) {
    toast(LANG === 'en' ? 'Cannot export PDF: Second party name is required' : 'لا يمكن تصدير العقد بدون اسم الفريق الثاني');
    return;
  }
  const ch = checks(c), msg = [];
  if (!co().nameConfirmed) msg.push(t('pr.name'));
  if (!co().contactConfirmed) msg.push(t('pr.contact'));
  if (ch.missing.length) msg.push(t('pr.blank', { n: toArabicDigits(ch.missing.length) }));
  if (ch.schedOff) msg.push(t('pr.sched', { total: toArabicDigits(ch.total) }));
  if (msg.length && !confirm(t('pdf.h') + '\n- ' + msg.join('\n- ') + '\n\n' + t('pdf.ask'))) return;

  if (!window.html2pdf) {
    toast(LANG === 'en' ? 'PDF library not loaded. Please refresh the page.' : 'تعذر تحميل مكتبة PDF، يرجى تحديث الصفحة.');
    return;
  }

  const rawFilename = `${c.ref || 'contract'} - ${partyOf(c) || tp.ar}.pdf`;
  const filename = rawFilename.replace(/[/\\?%*:|"<>]/g, '-');
  toast(LANG === 'en' ? 'Generating PDF...' : 'جاري إنشاء ملف PDF...');

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  document.body.appendChild(container);

  try {
    const { pageEls } = buildExportPageEls(tp, c);
    pageEls.forEach(el => container.appendChild(el));

    const opt = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const canvases = [];
    for (const el of pageEls) {
      const canvas = await window.html2pdf().set(opt).from(el).toCanvas().get('canvas');
      canvases.push(canvas);
    }
    const seedWorker = window.html2pdf().set(opt).from(pageEls[0]);
    await seedWorker.toPdf();
    const pdf = await seedWorker.get('pdf');
    while (pdf.internal.getNumberOfPages() > 1) pdf.deletePage(pdf.internal.getNumberOfPages());
    pdf.setPage(1);
    pdf.addImage(canvases[0].toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297);
    for (let i = 1; i < canvases.length; i++) {
      pdf.addPage();
      pdf.addImage(canvases[i].toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297);
    }
    pdf.save(filename);

    container.remove();
    toast(LANG === 'en' ? 'PDF downloaded successfully' : 'تم تحميل ملف PDF بنجاح');
  } catch (err) {
    console.error('PDF export error:', err);
    container.remove();
    toast(LANG === 'en' ? 'Failed to export PDF' : 'فشل تصدير PDF');
  }
}

function openPrintModal(c) {
  if (!c) return;
  const tp = tplById(c.tpl);
  if (!partyOf(c).trim()) {
    toast(LANG === 'en' ? 'Cannot print: Second party name is required' : 'لا يمكن طباعة العقد بدون اسم الفريق الثاني');
    return;
  }

  closeModal();
  const ch = checks(c), warnings = [];
  if (!co().nameConfirmed) warnings.push(t('pr.name'));
  if (!co().contactConfirmed) warnings.push(t('pr.contact'));
  if (ch.missing.length) warnings.push(t('pr.blank', { n: toArabicDigits(ch.missing.length) }));
  if (ch.schedOff) warnings.push(t('pr.sched', { total: toArabicDigits(ch.total) }));

  let copies = 2;

  const div = document.createElement('div');
  div.id = 'modalOverlay';
  div.className = 'modal-overlay';

  const updateModal = () => {
    const isWarn = warnings.length > 0;
    const auditHtml = isWarn
      ? `<div class="print-audit-box warn">
          <div style="font-weight:700;display:flex;align-items:center;gap:6px">
            <span>${t('pr.h')}</span>
          </div>
          <ul class="print-audit-list">
            ${warnings.map(w => `<li>${esc(w)}</li>`).join('')}
          </ul>
        </div>`
      : `<div class="print-audit-box ok">
          <div style="font-weight:700;display:flex;align-items:center;gap:6px">
            <span>${t('pr.readyToPrint')}</span>
          </div>
        </div>`;

    div.innerHTML = `<div class="modal-card" style="max-width:500px">
      <div class="modal-h">
        <h3>${t('pr.modalTitle')}</h3>
        <button class="modal-close" id="mClosePrint">&times;</button>
      </div>
      <div class="modal-body" style="gap:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#faf8f4;border:1px solid var(--line);border-radius:8px">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--ink)"><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi> &bull; ${esc(tp.ar)}</div>
            <div style="font-size:12.5px;color:var(--muted);margin-top:2px">${esc(partyOf(c))} ${projectOf(c) ? '&bull; ' + esc(projectOf(c)) : ''}</div>
          </div>
          <span class="pill st-${c.status}">${stName(c.status)}</span>
        </div>

        ${auditHtml}

        <div>
          <label style="display:block;font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">
            ${t('pr.copies')}
          </label>
          <div class="print-copies-ctrl">
            <button type="button" id="btnCopyMinus" aria-label="Decrease">&minus;</button>
            <input type="number" id="inPrintCopies" min="1" max="20" value="${copies}" readonly>
            <button type="button" id="btnCopyPlus" aria-label="Increase">+</button>
            <span style="font-size:13px;color:var(--muted);margin-inline-start:6px">
              ${t('pr.copiesHint', { n: toArabicDigits(copies) })}
            </span>
          </div>
          <div class="print-copies-presets">
            <button type="button" class="print-copies-preset${copies === 1 ? ' on' : ''}" data-cp="1">1 ${t('pr.copy1')}</button>
            <button type="button" class="print-copies-preset${copies === 2 ? ' on' : ''}" data-cp="2">2 ${t('pr.copy2')}</button>
            <button type="button" class="print-copies-preset${copies === 3 ? ' on' : ''}" data-cp="3">3 ${t('pr.copy3')}</button>
          </div>
        </div>
      </div>
      <div class="modal-foot" style="justify-content:space-between">
        <button class="btn sm ghost" id="btnCancelPrint">${t('send.cancel') || 'إلغاء'}</button>
        <button class="btn sm pri" id="btnExecutePrint">
          ${t('pr.btnExecute', { n: toArabicDigits(copies) })}
        </button>
      </div>
    </div>`;

    $('#mClosePrint', div).onclick = closeModal;
    $('#btnCancelPrint', div).onclick = closeModal;
    div.onclick = e => { if (e.target === div) closeModal(); };

    const setCopies = (n) => {
      copies = Math.max(1, Math.min(20, n));
      updateModal();
    };

    $('#btnCopyMinus', div).onclick = () => setCopies(copies - 1);
    $('#btnCopyPlus', div).onclick = () => setCopies(copies + 1);
    $$('.print-copies-preset', div).forEach(b => {
      b.onclick = () => setCopies(parseInt(b.dataset.cp, 10) || 1);
    });

    $('#btnExecutePrint', div).onclick = () => {
      closeModal();
      executePrint(c, copies);
    };
  };

  document.body.appendChild(div);
  updateModal();
}

function executePrint(c, copies) {
  if (!c) return;
  const tp = tplById(c.tpl);
  copies = Math.max(1, parseInt(copies, 10) || 1);

  const lay = renderPages(tp, c);
  let host = document.getElementById('printHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'printHost';
    host.className = 'print-host';
    document.body.appendChild(host);
  }

  let combinedPagesHtml = '';
  for (let i = 0; i < copies; i++) {
    combinedPagesHtml += lay.html;
  }

  host.innerHTML = combinedPagesHtml;
  document.body.classList.add('printing-direct');

  const oldTitle = document.title;
  document.title = [c.ref, partyOf(c) || tp.ar].filter(Boolean).join(' - ');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('printing-direct');
    host.innerHTML = '';
    document.title = oldTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 2000);
  }, 100);
}

function printContractDirect(c) {
  openPrintModal(c);
}

function exportPdfDirect(c) {
  downloadPdfDirect(c);
}
window.renderPages = renderPages;
window.downloadPdfDirect = downloadPdfDirect;
window.printContractDirect = printContractDirect;
window.tplById = tplById;

function vTemplates() {
  const cats = ['All', ...new Set(TPL.map(p => p.category))];
  const recent = [...DB.contracts].sort((a, b) => b.updated - a.updated).slice(0, 4);
  const totalTemplates = TPL.length;
  const activeProjects = (DB.projects || []).filter(p => p.status === 'production' || p.status === 'development').length;
  const totalContracts = DB.contracts.length;

  view.innerHTML = `<div class="page">
    ${nameBanner()}

    <div class="tpl-hero">
      <div class="tpl-hero-content">
        <span class="tpl-hero-tag">${t('tpl.hero.tag')}</span>
        <h1>${t('tpl.hero.h1')}</h1>
        <p>${t('tpl.hero.sub')}</p>
      </div>
      <div class="tpl-hero-stats">
        <div class="tpl-hero-stat-item">
          <div class="tpl-stat-val">${toArabicDigits(totalTemplates)}</div>
          <div class="tpl-stat-lbl">${t('tpl.stat.total')}</div>
        </div>
        <div class="tpl-hero-stat-item">
          <div class="tpl-stat-val">${toArabicDigits(activeProjects)}</div>
          <div class="tpl-stat-lbl">${t('tpl.stat.activePrj')}</div>
        </div>
        <div class="tpl-hero-stat-item">
          <div class="tpl-stat-val">${toArabicDigits(totalContracts)}</div>
          <div class="tpl-stat-lbl">${t('tpl.stat.drafts')}</div>
        </div>
      </div>
    </div>

    <div class="tools">
      <div class="search"><input id="tq" placeholder="${esc(t('tpl.search'))}" value="${esc(F.tq)}"></div>
      <div class="chips" id="cats">${cats.map(c => `<button class="chip${F.cat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(tCat(c))}</button>`).join('')}</div>
    </div>

    <div class="grid" id="tgrid"></div>

    ${recent.length ? `<div class="section-h">${t('tpl.recent')}</div>
      <div class="recent">${recent.map(c => {
        const tp = tplById(c.tpl);
        return `<a href="#/c/${c.id}">
          <b>${esc(tp.ar)}${partyOf(c) ? ' &middot; ' + esc(partyOf(c)) : ''}</b>
          <small><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi> &middot; ${esc(projectOf(c) || t('no.project'))} &middot; <span class="st-pill ${stClass(c.status)}">${stName(c.status)}</span> &middot; ${ago(c.updated)}</small>
        </a>`;
      }).join('')}</div>` : ''}

    <div class="quick-nav-strip">
      <div class="quick-nav-card">
        <div>
          <h4>${t('nav.projects')}</h4>
          <p>${t('p.sub')}</p>
        </div>
        <a href="#/projects" class="btn sm ghost">&larr; ${t('p.open')}</a>
      </div>
      <div class="quick-nav-card">
        <div>
          <h4>${t('nav.contracts')}</h4>
          <p>${t('c.sub')}</p>
        </div>
        <a href="#/contracts" class="btn sm ghost">&larr; ${t('c.h1')}</a>
      </div>
    </div>
  </div>`;

  const paint = () => {
    const q = F.tq.trim().toLowerCase();
    const list = TPL.filter(p => (F.cat === 'All' || p.category === F.cat) && (!q || [p.en, p.ar, p.category, tCat(p.category), p.summary, tSummary(p)].join(' ').toLowerCase().includes(q)));
    $('#tgrid').innerHTML = list.length ? list.map(p => {
      const nn = tNotes(p).length;
      return `<div class="card tpl-card">
        <div class="tpl-card-top">
          <span class="tag">${esc(tCat(p.category))}</span>
          <span class="tpl-code">${esc(p.id.toUpperCase())}</span>
        </div>
        <div class="ar">${esc(p.ar)}</div>
        <div class="en">${esc(p.en)}</div>
        <p>${esc(tSummary(p))}</p>
        <div class="meta">
          <span>${t('tpl.articles', { n: toArabicDigits(p.articles) })}</span>
          <span>${t('tpl.fields', { n: toArabicDigits(p.fields.filter(f => f.req !== false).length) })}</span>
          ${nn ? `<span class="warnpill">${t('tpl.notes', { n: toArabicDigits(nn) })}</span>` : ''}
        </div>
        <div class="act" style="margin-top:10px">
          <button class="btn pri" data-new="${p.id}" style="width:100%">+ ${t('tpl.create')}</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty"><h3>${t('tpl.none.h')}</h3>${t('tpl.none.p')}</div>`;
  };

  paint();
  $('#tq').oninput = e => { F.tq = e.target.value; paint(); };
  $('#cats').onclick = e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    F.cat = b.dataset.cat;
    $$('#cats .chip').forEach(x => x.classList.toggle('on', x === b));
    paint();
  };
  $('#tgrid').onclick = e => {
    const b = e.target.closest('[data-new]');
    if (b) create(b.dataset.new);
  };
}

function create(tplId) {
  const c = newContract(tplById(tplId));
  DB.contracts.push(c);
  save();
  nav();
  location.hash = '#/c/' + c.id;
}

function vProjects() {
  const totalProjects = (DB.projects || []).length;
  const activeProjects = (DB.projects || []).filter(p => p.status === 'production' || p.status === 'development').length;
  const totalContracts = DB.contracts.length;
  const numCls = val => val > 0 ? 'm-num m-live' : 'm-num m-zero';

  view.innerHTML = `<div class="page">
    <div class="page-h">
      <div>
        <h1>${t('nav.projects')}</h1>
        <p>${t('p.sub')}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn pri" id="btnNewPrj">+ ${t('p.new')}</button>
        <a class="btn ghost" href="#/contracts" style="text-decoration:none">${t('nav.contracts')}</a>
      </div>
    </div>
    ${nameBanner()}

    <div class="metrics-row">
      <div class="metric-card m-projects" title="${t('p.stat.totalProjects')}">
        <div class="m-card-top">
          <span class="m-lbl">${t('p.stat.totalProjects')}</span>
        </div>
        <div class="${numCls(totalProjects)}">${toArabicDigits(totalProjects)}</div>
        <div class="m-sub">${toArabicDigits(activeProjects)} ${t('p.stat.activeProjects')}</div>
      </div>
      <div class="metric-card m-active" title="${t('p.stat.activeProjects')}">
        <div class="m-card-top">
          <span class="m-lbl">${t('p.stat.activeProjects')}</span>
        </div>
        <div class="${numCls(activeProjects)}">${toArabicDigits(activeProjects)}</div>
        <div class="m-sub">${t('p.stat.activeSub')}</div>
      </div>
      <div class="metric-card m-total" title="${t('p.stat.totalContracts')}">
        <div class="m-card-top">
          <span class="m-lbl">${t('p.stat.totalContracts')}</span>
        </div>
        <div class="${numCls(totalContracts)}">${toArabicDigits(totalContracts)}</div>
        <div class="m-sub">${t('p.stat.allSub')}</div>
      </div>
    </div>

    <div class="tools">
      <div class="search"><input id="pq" placeholder="${esc(t('p.search'))}" value="${esc(F.pq || '')}"></div>
      <div class="chips" id="pstc"></div>
      <select class="stsel" id="ptype">
        <option value="all">${t('ptyp.all')}</option>
        ${PROJECT_TYPES.map(k => `<option value="${k}"${F.pType === k ? ' selected' : ''}>${t('ptyp.' + k)}</option>`).join('')}
      </select>
    </div>

    <div id="pgrid"></div>
    <div id="pPagination"></div>
  </div>`;

  $('#btnNewPrj').onclick = () => openProjectModal(null, () => { nav(); vProjects(); });

  const counts = { all: (DB.projects || []).length };
  PROJECT_STATUSES.forEach(s => counts[s] = (DB.projects || []).filter(p => p.status === s).length);
  const activePStatuses = PROJECT_STATUSES.filter(s => (counts[s] || 0) > 0 || F.pStatus === s);
  const visiblePChips = activePStatuses.length ? ['all', ...activePStatuses] : ['all'];
  $('#pstc').innerHTML = visiblePChips.map(s => `<button class="chip${(F.pStatus || 'all') === s ? ' on' : ''}" data-ps="${s}">${t('pst.' + s)}<span class="c">${toArabicDigits(counts[s] || 0)}</span></button>`).join('');

  const renderGrid = () => {
    const q = (F.pq || '').trim().toLowerCase();
    const list = (DB.projects || []).filter(p => {
      const matchSt = !F.pStatus || F.pStatus === 'all' || p.status === F.pStatus;
      const matchType = !F.pType || F.pType === 'all' || p.type === F.pType;
      const matchQ = !q || [p.name, p.code, p.description, String(p.year)].join(' ').toLowerCase().includes(q);
      return matchSt && matchType && matchQ;
    });
    list.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));

    if (!DB.projects.length) {
      $('#pgrid').innerHTML = `<div class="empty"><h3>${t('p.empty.h')}</h3>${t('p.empty.p')}<br><br><button class="btn pri" id="emptyNewPrj">${t('p.empty.btn')}</button></div>`;
      const eb = $('#emptyNewPrj'); if (eb) eb.onclick = () => openProjectModal(null, () => { nav(); vProjects(); });
      $('#pPagination').innerHTML = '';
      return;
    }
    if (!list.length) {
      $('#pgrid').innerHTML = `<div class="empty"><h3>${t('p.none.h')}</h3>${t('p.none.p')}</div>`;
      $('#pPagination').innerHTML = '';
      return;
    }

    const pInfo = paginate(list, F.prjPage || 1, F.prjPageSize || 10);
    F.prjPage = pInfo.curPage;

    $('#pgrid').innerHTML = `<div class="pgrid">${pInfo.items.map(p => {
      const housed = contractsOfProject(p.id);
      const actN = housed.filter(c => c.tpl === 'actor').length;
      const artN = housed.filter(c => c.tpl === 'artistic').length;
      const ndaN = housed.filter(c => c.tpl === 'nda').length;
      const signedN = housed.filter(c => c.status === 'signed').length;
      const draftN = housed.filter(c => c.status === 'draft').length;

      return `<div class="p-card" data-pid="${p.id}">
        <div class="p-card-top">
          <div class="p-card-badges">
            <span class="p-type-badge p-type-${p.type || 'series'}">${t('ptyp.' + (p.type || 'series'))}</span>
            <span class="p-status-chip pst-${p.status || 'production'}">${t('pst.' + (p.status || 'production'))}</span>
          </div>
          ${p.year ? `<span class="p-year-chip">${toArabicDigits(p.year)}</span>` : ''}
        </div>
        <div class="p-card-title-row">
          <div class="p-card-title">${esc(p.name)}</div>
          ${p.code ? `<span class="p-code">${esc(p.code)}</span>` : ''}
        </div>
        ${p.description ? `<p class="p-desc">${esc(p.description)}</p>` : `<p class="p-desc p-desc-empty">${LANG === 'en' ? 'No project synopsis recorded.' : 'لا يوجد وصف للمشروع.'}</p>`}
        <div class="p-contracts-summary">
          <div class="p-cnt-row">
            <span class="p-cnt-lbl"><b>${t('ws.housed')}</b></span>
            <span class="p-cnt-val">${housed.length ? t('p.contractsCount', { n: toArabicDigits(housed.length) }) : t('p.noContracts')}</span>
          </div>
          <div class="p-cnt-chips">
            ${actN ? `<span class="cb-chip cb-actor">${toArabicDigits(actN)} ${t('tpl.tag.actor')}</span>` : ''}
            ${artN ? `<span class="cb-chip cb-artistic">${toArabicDigits(artN)} ${t('tpl.tag.artistic')}</span>` : ''}
            ${ndaN ? `<span class="cb-chip cb-nda">${toArabicDigits(ndaN)} ${t('tpl.tag.nda')}</span>` : ''}
            ${!housed.length ? `<span class="sub" style="font-size:11.5px">${t('p.noContracts')}</span>` : ''}
          </div>
          ${housed.length ? `<div class="p-status-breakdown"><span class="st-dot st-signed-dot"></span><span style="color:var(--green);font-weight:600">${toArabicDigits(signedN)} ${t('st.signed')}</span> &middot; <span class="st-dot st-draft-dot"></span><span>${toArabicDigits(draftN)} ${t('st.draft')}</span></div>` : ''}
        </div>
        <div class="p-card-acts">
          <a href="#/project/${p.id}" class="btn sm pri p-open-btn" style="text-decoration:none">${t('p.open')} <span class="arr">&larr;</span></a>
          <button class="btn sm p-add-c-btn" data-add-contract="${p.id}">${t('p.addContract')}</button>
          <button class="btn sm ghost p-icon-btn" data-edit-p="${p.id}" title="${t('p.edit')}"><span>${t('c.edit')}</span></button>
          <button class="btn sm ghost danger p-icon-btn" data-del-p="${p.id}" title="${t('p.del')}">&times;</button>
        </div>
      </div>`;
    }).join('')}</div>`;

    $('#pPagination').innerHTML = renderPaginationBar(pInfo);
  };

  renderGrid();
  $('#pq').oninput = e => { F.pq = e.target.value; F.prjPage = 1; renderGrid(); };
  $('#ptype').onchange = e => { F.pType = e.target.value; F.prjPage = 1; renderGrid(); };
  $('#pstc').onclick = e => {
    const b = e.target.closest('[data-ps]');
    if (!b) return;
    F.pStatus = b.dataset.ps;
    F.prjPage = 1;
    $$('#pstc .chip').forEach(x => x.classList.toggle('on', x === b));
    renderGrid();
  };
  $('#pgrid').onclick = e => {
    const addC = e.target.closest('[data-add-contract]');
    if (addC) { openAddContractModal(addC.dataset.addContract); return; }
    const editP = e.target.closest('[data-edit-p]');
    if (editP) { openProjectModal(projectById(editP.dataset.editP), () => { nav(); vProjects(); }); return; }
    const delP = e.target.closest('[data-del-p]');
    if (delP) { deleteProject(delP.dataset.delP); return; }
    const card = e.target.closest('.p-card');
    if (card && !e.target.closest('button') && !e.target.closest('a')) {
      location.hash = '#/project/' + card.dataset.pid;
    }
  };
  $('#pPagination').onchange = e => {
    if (e.target.matches('[data-pg-size]')) {
      F.prjPageSize = parseInt(e.target.value, 10) || 10;
      F.prjPage = 1;
      renderGrid();
    }
  };
  $('#pPagination').onclick = e => {
    const btn = e.target.closest('.pg-btn[data-page]');
    if (btn && !btn.disabled) {
      F.prjPage = parseInt(btn.dataset.page, 10) || 1;
      renderGrid();
    }
  };
}

function vContracts() {
  F.selectedContracts = F.selectedContracts || new Set();
  F.previewMode = F.previewMode || 'summary';
  const isRtl = document.documentElement.dir === 'rtl' || LANG === 'ar';

  view.innerHTML = `<div class="page">
    <div class="page-h">
      <div>
        <h1>${t('nav.contracts')}</h1>
        <p>${t('c.sub')}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <a class="btn pri" href="#/templates" style="text-decoration:none">+ ${t('c.new')}</a>
        <a class="btn ghost" href="#/projects" style="text-decoration:none">${t('nav.projects')}</a>
      </div>
    </div>
    ${nameBanner()}

    <div class="contracts-split">
      <div class="contracts-main-col">
        <div id="bulkBarHost"></div>
        <div class="tools">
          <div class="search"><input id="q" placeholder="${esc(t('c.search'))}" value="${esc(F.q)}"></div>
          <div class="chips" id="stc"></div>
          <select class="stsel" id="grp">
            <option value="project">${t('g.project')}</option>
            <option value="tpl">${t('g.tpl')}</option>
            <option value="status">${t('g.status')}</option>
            <option value="none">${t('g.none')}</option>
          </select>
        </div>
        <div id="clist"></div>
        <div id="cPagination"></div>
      </div>
      <aside class="contract-preview-pane" id="contractPreviewPane" aria-label="${esc(t('pv.previewTitle'))}">
        <div class="cp-header">
          <div class="cp-title-wrap">
            <span class="cp-tpl-name" id="cpTplName"></span>
            <span class="cp-ref" id="cpRef"></span>
            <span id="cpRoleBadge"></span>
            <span class="cp-party" id="cpParty"></span>
          </div>
        </div>
        <div class="cp-body" id="cpBody">
          <div class="cp-summary-wrap" id="cpSummary"></div>
        </div>
      </aside>
    </div>
  </div>`;

  $('#grp').value = F.group;

  const renderContractSummary = (c) => {
    const host = $('#cpSummary');
    if (!host) return;
    if (!c) {
      host.innerHTML = `<div class="cp-empty">${esc(t('c.empty.p'))}</div>`;
      return;
    }
    const tp = tplById(c.tpl);
    const p2 = partyOf(c) || t('no.party');
    const prj = c.project || t('no.project');
    const val = c.values || {};
    const roleInfo = getRoleInfo(c);
    const roleOrTask = val.role || val.task || (c.tpl === 'nda' ? (val.term ? (t('sum.term') + ': ' + val.term) : '') : '');
    const fee = val.fee || '';
    const dateFormatted = c.date || (c.created ? new Date(c.created).toLocaleDateString(LANG === 'ar' ? 'ar-SY' : 'en-US') : '');
    const sched = c.schedule || [];
    const ch = checks(c);

    host.innerHTML = `
      <div class="cp-sum-hero">
        <div class="cp-sum-hero-top">
          <div>
            <div class="cp-sum-party-title" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span>${esc(p2)}</span>
              <span class="role-badge ${roleInfo.cls}" style="font-size:11px;padding:1.5px 6px;">${esc(roleInfo.label)}</span>
            </div>
            <div class="cp-sum-badges">
              <span class="cp-sum-pill ref">${esc(toArabicDigits(c.ref))}</span>
              <span class="cp-sum-pill ref">${esc(LANG === 'en' ? tp.en : tp.ar)}</span>
              <span class="cp-sum-pill project">${esc(prj)}</span>
              ${roleOrTask && roleOrTask.toLowerCase() !== roleInfo.label.toLowerCase() ? `<span class="cp-sum-pill role">${esc(roleOrTask)}</span>` : ''}
              <span class="st st-${c.status}"><i></i>${stName(c.status)}</span>
            </div>
          </div>
        </div>

        <div class="cp-sum-actions">
          <button class="cp-sum-btn pri" id="sumActEdit" data-id="${esc(c.id)}">
            <span>${t('sum.openEd')}</span>
          </button>
          <button class="cp-sum-btn" id="sumActPdf" data-id="${esc(c.id)}">
            <span>${t('sum.download')}</span>
          </button>
          <button class="cp-sum-btn" id="sumActPrint" data-id="${esc(c.id)}">
            <span>${t('sum.print')}</span>
          </button>
          <button class="cp-sum-btn" id="sumActSend" data-id="${esc(c.id)}">
            <span>${t('sum.send')}</span>
          </button>
        </div>
      </div>

      <div class="cp-sum-card">
        <div class="cp-sum-head-section">
          <span>${t('sum.scope')}</span>
          <span style="font-size:11px;color:var(--muted);">${dateFormatted ? (LANG === 'en' ? 'Date: ' : 'تاريخ: ') + toArabicDigits(dateFormatted) : ''}</span>
        </div>
        <div class="cp-sum-grid">
          ${prj ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.project')}</span>
            <span class="cp-sum-val">${esc(prj)}</span>
          </div>` : ''}
          ${roleOrTask ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.role')}</span>
            <span class="cp-sum-val">${esc(roleInfo.label)}${roleOrTask && roleOrTask.toLowerCase() !== roleInfo.label.toLowerCase() ? ' - ' + esc(roleOrTask) : ''}</span>
          </div>` : ''}
          ${val.episodes ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.episodes')}</span>
            <span class="cp-sum-val">${esc(toArabicDigits(val.episodes))} ${LANG === 'en' ? 'Episodes' : 'حلقات'}</span>
          </div>` : ''}
          ${val.director ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.director')}</span>
            <span class="cp-sum-val">${esc(val.director)}</span>
          </div>` : ''}
          ${val.term ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.term')}</span>
            <span class="cp-sum-val">${esc(val.term)}</span>
          </div>` : ''}
          ${val.p2domicile ? `
          <div class="cp-sum-field">
            <span class="cp-sum-lbl">${t('sum.domicile')}</span>
            <span class="cp-sum-val">${esc(val.p2domicile)}</span>
          </div>` : ''}
        </div>
      </div>

      ${fee || (sched && sched.length) ? `
      <div class="cp-sum-card">
        <div class="cp-sum-head-section">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span>${t('sum.fee')}</span>
            ${fee ? `<b class="fee-highlight" style="font-size:12.5px;color:#166534;">(${esc(toArabicDigits(fee))})</b>` : ''}
          </div>
          ${val.royalty ? `<span class="cp-sum-pill role" style="font-size:10px;padding:1px 6px;">${t('sum.royalty')}: ${esc(toArabicDigits(val.royalty))}%</span>` : ''}
        </div>
        ${sched && sched.length ? `
        <div class="cp-sum-sched-list">
          ${sched.map(s => `
            <div class="cp-sum-sched-item">
              <span class="cp-sum-sched-pct">${toArabicDigits(s.pct)}%</span>
              <span class="cp-sum-sched-text">${esc(toArabicDigits(s.text))}</span>
            </div>
          `).join('')}
        </div>` : ''}
      </div>` : ''}

      <div class="cp-sum-card" style="padding:6px 10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font:700 11px 'Cairo',var(--head);color:var(--ink2)">${t('sum.readiness')}</span>
          ${ch.missing.length === 0 && !ch.schedOff ? `
            <span class="cp-sum-readiness ok" style="padding:2px 8px;font-size:10.5px;margin:0;">
              <i>✓</i> <span>${t('sum.readyOk', { n: toArabicDigits(tp.articles || 3), words: LANG === 'ar' ? 'مواد' : 'articles' })}</span>
            </span>
          ` : `
            <span class="cp-sum-readiness warn" style="padding:2px 8px;font-size:10.5px;margin:0;">
              <span>${ch.missing.length ? t('sum.readyMissing', { n: toArabicDigits(ch.missing.length) }) : t('sum.readySchedBad', { total: toArabicDigits(ch.total) })}</span>
            </span>
          `}
        </div>
        ${ch.missing.length > 0 ? `
          <div class="cp-sum-missing-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;padding-top:5px;border-top:1px dashed var(--line);">
            ${ch.missing.map(f => `
              <span class="cp-sum-missing-chip" data-fid="${esc(f.id)}" style="display:inline-flex;align-items:center;gap:3px;background:rgba(217,119,6,.08);color:#b45309;border:1px solid rgba(217,119,6,.22);border-radius:4px;padding:1px 6px;font-size:10.5px;font-weight:600;cursor:pointer;" title="${esc(t('sum.openEd'))}">
                <span style="color:#d97706">•</span> ${esc(fieldLabels(f)[0].replace(/ \(.*\)/, ''))}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>

      ${c.notes ? `
      <div class="cp-sum-card" style="padding:6px 10px;">
        <div class="cp-sum-head-section" style="margin-bottom:3px;padding-bottom:2px;">
          <span style="font-size:11px;">${t('sum.notesTitle')}</span>
        </div>
        <div class="cp-sum-memo" style="font-size:11px;padding:4px 8px;margin-top:2px;">${esc(c.notes)}</div>
      </div>` : ''}
    `;

    host.querySelectorAll('.cp-sum-missing-chip').forEach(chip => {
      chip.onclick = (e) => {
        e.stopPropagation();
        const fid = chip.getAttribute('data-fid');
        F.activeContractId = c.id;
        window._lastNonEditorHash = '#/contracts';
        location.hash = `#/c/${c.id}`;
        setTimeout(() => {
          const inp = document.querySelector(`input[data-f="${fid}"], select[data-f="${fid}"], textarea[data-f="${fid}"]`);
          if (inp) {
            inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inp.focus();
          }
        }, 200);
      };
    });

    const btnEdit = $('#sumActEdit');
    if (btnEdit) btnEdit.onclick = () => {
      F.activeContractId = c.id;
      window._lastNonEditorHash = '#/contracts';
      location.hash = `#/c/${c.id}`;
    };
    const btnPdf = $('#sumActPdf');
    if (btnPdf) btnPdf.onclick = () => { downloadPdfDirect(c); };
    const btnPrint = $('#sumActPrint');
    if (btnPrint) btnPrint.onclick = () => { printContractDirect(c); };
    const btnSend = $('#sumActSend');
    if (btnSend) btnSend.onclick = () => { openSendModal(c, () => paintTable()); };
  };

  let activePreviewContract = null;
  const renderContractPreview = (c) => {
    activePreviewContract = c;
    const pane = $('#contractPreviewPane');
    if (!pane) return;
    if (!c) {
      $('#cpTplName').textContent = '';
      $('#cpRef').textContent = '';
      $('#cpParty').textContent = '';
      const rBadge = $('#cpRoleBadge');
      if (rBadge) rBadge.innerHTML = '';
      $('#cpSummary').innerHTML = `<div class="cp-empty">${esc(t('c.empty.p'))}</div>`;
      return;
    }
    const tp = tplById(c.tpl);
    const roleInfo = getRoleInfo(c);
    $('#cpTplName').textContent = tp.ar;
    $('#cpRef').textContent = toArabicDigits(c.ref);
    $('#cpParty').textContent = partyOf(c) || t('no.party');
    const rBadge = $('#cpRoleBadge');
    if (rBadge) {
      rBadge.innerHTML = `<span class="role-badge ${roleInfo.cls}">${esc(roleInfo.label)}</span>`;
    }

    renderContractSummary(c);
  };

  const renderBulkBar = () => {
    let host = $('#bulkBarHost');
    if (!host) return;
    const selCount = F.selectedContracts.size;
    if (selCount === 0) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="bulk-bar">
      <div class="bulk-info">
        <span class="bulk-badge">${toArabicDigits(selCount)}</span>
        <span>${t('bulk.selected', { n: toArabicDigits(selCount) })}</span>
      </div>
      <div class="bulk-actions">
        <select id="bulkProject" class="stsel bulk-select">
          <option value="">${t('bulk.project')}</option>
          <option value="__none__">${t('bulk.projectNone')}</option>
          ${(DB.projects || []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
        </select>
        <select id="bulkStatus" class="stsel bulk-select">
          <option value="">${t('bulk.status')}</option>
          ${STATUS_KEYS.map(k => `<option value="${k}">${stName(k)}</option>`).join('')}
        </select>
        <button class="btn sm ghost" id="bulkArchive">${t('bulk.archive')}</button>
        <button class="btn sm danger" id="bulkDelete">${t('bulk.delete')}</button>
        <button class="btn sm ghost" id="bulkClear">${t('bulk.clear')}</button>
      </div>
    </div>`;
    $('#bulkClear').onclick = () => { F.selectedContracts.clear(); renderBulkBar(); paintTable(); };
    $('#bulkArchive').onclick = () => {
      if (!confirm(t('bulk.archiveConfirm', { n: toArabicDigits(selCount) }))) return;
      let count = 0;
      DB.contracts.forEach(c => {
        if (F.selectedContracts.has(c.id)) {
          c.archived = true;
          c.updated = Date.now();
          count++;
        }
      });
      F.selectedContracts.clear();
      save(); nav(); paintTable();
      toast(t('bulk.archivedDone', { n: toArabicDigits(count) }));
    };
    $('#bulkProject').onchange = e => {
      const pid = e.target.value;
      if (!pid) return;
      let count = 0;
      DB.contracts.forEach(c => {
        if (F.selectedContracts.has(c.id)) {
          if (pid === '__none__') {
            c.projectId = null;
            c.project = '';
          } else {
            const prj = projectById(pid);
            if (prj) {
              c.projectId = prj.id;
              c.project = prj.name;
            }
          }
          c.updated = Date.now();
          count++;
        }
      });
      save(); nav(); paintTable();
      toast(t('bulk.projectToast', { n: toArabicDigits(count) }));
    };
    $('#bulkStatus').onchange = e => {
      const st = e.target.value; if (!st) return;
      DB.contracts.forEach(c => { if (F.selectedContracts.has(c.id)) { c.status = st; c.updated = Date.now(); } });
      save(); nav(); paintTable();
    };
    $('#bulkDelete').onclick = () => {
      const selected = DB.contracts.filter(c => F.selectedContracts.has(c.id));
      if (!selected.length) return;

      const sentOrSigned = selected.filter(c => c.status === 'sent' || c.status === 'signed');
      const drafts = selected.filter(c => c.status !== 'sent' && c.status !== 'signed');

      let confirmMsg = '';
      if (sentOrSigned.length > 0 && drafts.length === 0) {
        confirmMsg = (sentOrSigned.length === 1)
          ? t('c.archiveConfirm')
          : t('bulk.signedNotAllowedArchive', { n: toArabicDigits(sentOrSigned.length) });
      } else if (drafts.length > 0 && sentOrSigned.length === 0) {
        confirmMsg = (drafts.length === 1)
          ? t('c.delConfirm', { with: partyOf(drafts[0]) ? t('c.delWith', { name: partyOf(drafts[0]) }) : '' })
          : t('bulk.delDraftsConfirm', { n: toArabicDigits(drafts.length) });
      } else {
        confirmMsg = t('bulk.mixedDelArchiveConfirm', {
          drafts: toArabicDigits(drafts.length),
          signed: toArabicDigits(sentOrSigned.length)
        });
      }

      if (!confirm(confirmMsg)) return;

      let delCount = 0;
      let archCount = 0;
      DB.contracts = DB.contracts.filter(c => {
        if (!F.selectedContracts.has(c.id)) return true;
        if (c.status === 'sent' || c.status === 'signed') {
          c.archived = true;
          c.updated = Date.now();
          archCount++;
          return true;
        } else {
          delCount++;
          return false;
        }
      });
      F.selectedContracts.clear();
      save(); nav(); paintTable();

      if (archCount > 0 && delCount === 0) {
        toast(archCount === 1 ? t('c.archivedToast') : t('bulk.archivedDone', { n: toArabicDigits(archCount) }));
      } else if (delCount > 0 && archCount === 0) {
        toast(delCount === 1 ? (currentLang === 'ar' ? 'تم حذف المسودة بنجاح' : 'Draft deleted successfully') : (currentLang === 'ar' ? `تم حذف ${toArabicDigits(delCount)} مسودات بنجاح` : `${delCount} drafts deleted successfully`));
      } else if (archCount > 0 && delCount > 0) {
        toast(t('bulk.archiveToast', { delCount: toArabicDigits(delCount), archCount: toArabicDigits(archCount) }));
      }
    };
  };

  const renderStatusChips = () => {
    const stc = $('#stc');
    if (!stc) return;
    const counts = {
      all: DB.contracts.filter(c => !c.archived).length,
      archived: DB.contracts.filter(c => c.archived).length
    };
    STATUS_KEYS.forEach(s => counts[s] = DB.contracts.filter(c => !c.archived && c.status === s).length);
    stc.innerHTML = ['all', ...STATUS_KEYS, 'archived'].map(s => `<button class="chip${F.status === s ? ' on' : ''}" data-s="${s}">${stName(s)}<span class="c">${toArabicDigits(counts[s] || 0)}</span></button>`).join('');
  };

  const paintTable = () => {
    renderStatusChips();
    renderBulkBar();
    const q = F.q.trim().toLowerCase();
    const list = DB.contracts.filter(c => {
      const tp = tplById(c.tpl);
      if (F.status === 'archived') {
        if (!c.archived) return false;
      } else {
        if (c.archived) return false;
        if (F.status !== 'all' && c.status !== F.status) return false;
      }
      if (!q) return true;
      const hay = [c.ref, partyOf(c), projectOf(c), tp.ar, tp.en, c.notes, val(c, 'role'), val(c, 'task'), val(c, 'purpose')].join(' ').toLowerCase();
      return hay.includes(q);
    });
    list.sort((a, b) => b.updated - a.updated);

    if (!DB.contracts.length) {
      F.activeContractId = null;
      renderContractPreview(null);
      $('#clist').innerHTML = `<div class="empty"><h3>${t('c.empty.h')}</h3>${t('c.empty.p')}<br><br><a class="btn pri" href="#/templates">${t('c.empty.btn')}</a></div>`;
      $('#cPagination').innerHTML = '';
      return;
    }
    if (!list.length) {
      F.activeContractId = null;
      renderContractPreview(null);
      $('#clist').innerHTML = `<div class="empty"><h3>${t('c.none.h')}</h3>${t('c.none.p')}</div>`;
      $('#cPagination').innerHTML = '';
      return;
    }

    const renderContractRow = c => {
      const isChecked = Boolean(F.selectedContracts && F.selectedContracts.has(c.id));
      const isSelected = c.id === F.activeContractId;
      const tp = tplById(c.tpl);
      const roleInfo = getRoleInfo(c);
      const roleOrTask = val(c, 'role') || val(c, 'task') || val(c, 'purpose');
      const isSentOrSigned = c.status === 'sent' || c.status === 'signed';
      return `<tr class="row${isSelected ? ' selected' : ''}" data-id="${c.id}">
        <td class="chk-col"><input type="checkbox" class="chk-contract" data-chk="${c.id}"${isChecked ? ' checked' : ''}></td>
        <td><div class="ar who">${esc(tp.ar)}</div><div class="sub"><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi></div></td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="who">${esc(partyOf(c) || t('no.party'))}</span>
            <span class="role-badge ${roleInfo.cls}">${esc(roleInfo.label)}</span>
          </div>
          <div class="sub">
            ${roleOrTask && roleOrTask.toLowerCase() !== roleInfo.label.toLowerCase() ? `<span class="row-role">${esc(roleOrTask)}</span>` : ''}
          </div>
        </td>
        <td>
          <select class="prjsel" data-cprj="${c.id}" title="${t('c.th.project')}">
            <option value="">${t('ed.projectNone')}</option>
            ${(DB.projects || []).map(p => `<option value="${esc(p.id)}"${c.projectId === p.id || (!c.projectId && projectOf(c).toLowerCase() === p.name.toLowerCase()) ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </td>
        <td>${c.archived
          ? `<span class="pill st-archived">${t('st.archived')}</span>`
          : `<select class="${stSelClass(c.status)}" data-st="${c.id}">${STATUS_KEYS.map(v => `<option value="${v}"${c.status === v ? ' selected' : ''}>${stName(v)}</option>`).join('')}</select>`
        }</td>
        <td class="sub">${ago(c.updated)}</td>
        <td>
          <div class="acts">
            <button type="button" class="btn sm act-btn-edit" data-edit="${c.id}" title="${esc(t('pv.openEditor'))}"><span>${esc(t('c.edit'))}</span></button>
            <button type="button" class="btn sm act-btn-send" data-send="${c.id}" title="${esc(t('c.send'))}"><span>${esc(t('c.send'))}</span></button>
            <button type="button" class="btn sm act-btn-pdf" data-pdf="${c.id}" title="${esc(t('ed.exportPdf'))}"><span>PDF</span></button>
            <button type="button" class="btn sm act-btn-print" data-print="${c.id}" title="${esc(t('c.print') || 'طباعة')}"><span>${esc(t('c.print') || 'طباعة')}</span></button>
          </div>
        </td>
      </tr>`;
    };

    const keyFn = { project: c => projectOf(c) || t('no.project'), tpl: c => tplById(c.tpl).ar, status: c => stName(c.status), none: () => '' }[F.group];
    let rows = '';
    let allChecked = false;
    let pInfo = null;

    if (F.group !== 'none') {
      const groups = new Map();
      list.forEach(c => {
        const k = keyFn(c);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      });

      F.allGroupKeys = [...groups.keys()];
      if (!F.collapsedGroups) F.collapsedGroups = new Set();

      if (F.activeContractId) {
        const activeC = list.find(c => c.id === F.activeContractId);
        if (activeC) F.collapsedGroups.delete(keyFn(activeC));
      } else {
        F.activeContractId = list[0]?.id || null;
      }

      allChecked = list.length > 0 && list.every(c => F.selectedContracts.has(c.id));

      for (const [k, items] of groups) {
        const isCollapsed = F.collapsedGroups.has(k);
        const caret = isCollapsed ? (document.dir === 'rtl' ? '◀' : '▶') : '▼';
        rows += `<tr class="grp" data-grp="${esc(k)}">
          <td colspan="7">
            <div class="grp-head">
              <div class="grp-left">
                <span class="grp-caret">${caret}</span>
                <bdi style="font-weight:700">${esc(k)}</bdi>
                <span class="grp-badge">${toArabicDigits(items.length)}</span>
              </div>
              <span class="grp-hint">${isCollapsed ? t('grp.clickExpand') : t('grp.clickCollapse')}</span>
            </div>
          </td>
        </tr>`;
        if (!isCollapsed) {
          rows += items.map(renderContractRow).join('');
        }
      }

      const totalCount = toArabicDigits(list.length);
      const groupCount = toArabicDigits(groups.size);
      $('#cPagination').innerHTML = `
        <div class="pagination-bar" style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#faf8f4;border:1px solid var(--line);border-radius:var(--r);margin-top:12px">
          <div style="font-size:13px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px">
            <span>${t('grp.summary', { total: totalCount, groups: groupCount })}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn sm ghost" id="btnExpandAll">${t('grp.expandAll')}</button>
            <button type="button" class="btn sm ghost" id="btnCollapseAll">${t('grp.collapseAll')}</button>
          </div>
        </div>
      `;
    } else {
      if (F.activeContractId) {
        const targetIndex = list.findIndex(c => c.id === F.activeContractId);
        if (targetIndex !== -1) {
          F.cPage = Math.floor(targetIndex / (F.cPageSize || 10)) + 1;
        }
      }

      pInfo = paginate(list, F.cPage || 1, F.cPageSize || 10);
      F.cPage = pInfo.curPage;

      if (!F.activeContractId || !pInfo.items.some(c => c.id === F.activeContractId)) {
        F.activeContractId = pInfo.items[0]?.id || null;
      }

      allChecked = pInfo.items.length > 0 && pInfo.items.every(c => F.selectedContracts.has(c.id));
      rows = pInfo.items.map(renderContractRow).join('');
      $('#cPagination').innerHTML = renderPaginationBar(pInfo);
    }

    $('#clist').innerHTML = `<table class="list">
      <thead>
        <tr>
          <th class="chk-col"><input type="checkbox" id="chkAll"${allChecked ? ' checked' : ''}></th>
          <th>${t('c.th.contract')}</th>
          <th>${t('c.th.party')}</th>
          <th>${t('c.th.project')}</th>
          <th>${t('c.th.status')}</th>
          <th>${t('c.th.updated')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

    const activeContract = DB.contracts.find(x => x.id === F.activeContractId);
    renderContractPreview(activeContract);

    if (F.activeContractId) {
      setTimeout(() => {
        const targetRow = $(`tr.row[data-id="${F.activeContractId}"]`);
        if (targetRow) {
          targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          targetRow.classList.add('flash-highlight');
          setTimeout(() => targetRow.classList.remove('flash-highlight'), 1400);
        }
      }, 50);
    }

    const chkAll = $('#chkAll');
    if (chkAll) {
      chkAll.onchange = () => {
        const targetItems = F.group !== 'none' ? list : (pInfo ? pInfo.items : list);
        if (chkAll.checked) {
          targetItems.forEach(c => F.selectedContracts.add(c.id));
        } else {
          targetItems.forEach(c => F.selectedContracts.delete(c.id));
        }
        paintTable();
      };
    }
  };

  paintTable();
  $('#q').oninput = e => { F.q = e.target.value; F.cPage = 1; paintTable(); };
  $('#grp').onchange = e => { F.group = e.target.value; F.collapsedGroups.clear(); F.cPage = 1; paintTable(); };
  $('#stc').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { F.status = b.dataset.s; F.cPage = 1; paintTable(); } };

  $('#cPagination').onchange = e => {
    if (e.target.matches('[data-pg-size]')) {
      F.cPageSize = parseInt(e.target.value, 10) || 10;
      F.cPage = 1;
      paintTable();
    }
  };
  $('#cPagination').onclick = e => {
    if (e.target.closest('#btnExpandAll')) {
      F.collapsedGroups.clear();
      paintTable();
      return;
    }
    if (e.target.closest('#btnCollapseAll')) {
      if (F.allGroupKeys) F.allGroupKeys.forEach(k => F.collapsedGroups.add(k));
      paintTable();
      return;
    }
    const btn = e.target.closest('.pg-btn[data-page]');
    if (btn && !btn.disabled) {
      F.cPage = parseInt(btn.dataset.page, 10) || 1;
      paintTable();
    }
  };

  $('#clist').onclick = e => {
    const grpRow = e.target.closest('tr.grp');
    if (grpRow) {
      const grpKey = grpRow.dataset.grp;
      if (grpKey !== undefined) {
        if (F.collapsedGroups.has(grpKey)) F.collapsedGroups.delete(grpKey);
        else F.collapsedGroups.add(grpKey);
        paintTable();
      }
      return;
    }
    const chk = e.target.closest('.chk-contract');
    if (chk) {
      const id = chk.dataset.chk;
      if (chk.checked) F.selectedContracts.add(id);
      else F.selectedContracts.delete(id);
      renderBulkBar();
      const allBox = $('#chkAll');
      if (allBox) {
        const visibleChecks = $$('.chk-contract', $('#clist'));
        allBox.checked = visibleChecks.length > 0 && visibleChecks.every(x => x.checked);
      }
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      F.activeContractId = edit.dataset.edit;
      window._lastNonEditorHash = '#/contracts';
      location.hash = '#/c/' + edit.dataset.edit;
      return;
    }
    const send = e.target.closest('[data-send]');
    if (send) {
      const c = DB.contracts.find(x => x.id === send.dataset.send);
      if (c) openSendModal(c, () => paintTable());
      return;
    }
    const pdf = e.target.closest('[data-pdf]');
    if (pdf) {
      const c = DB.contracts.find(x => x.id === pdf.dataset.pdf);
      if (c) downloadPdfDirect(c);
      return;
    }
    const prt = e.target.closest('[data-print]');
    if (prt) {
      const c = DB.contracts.find(x => x.id === prt.dataset.print);
      if (c) printContractDirect(c);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const s = DB.contracts.find(c => c.id === del.dataset.del);
      if (!s) return;
      if (s.status === 'sent' || s.status === 'signed') {
        if (s.archived) {
          toast(t('c.archivedToast'));
          return;
        }
        if (confirm(t('c.archiveConfirm'))) {
          s.archived = true;
          s.updated = Date.now();
          F.selectedContracts.delete(s.id);
          save();
          toast(t('c.archivedToast'));
          paintTable();
        }
        return;
      }
      if (confirm(t('c.delConfirm', { with: partyOf(s) ? t('c.delWith', { name: partyOf(s) }) : '' }))) {
        DB.contracts = DB.contracts.filter(c => c !== s);
        F.selectedContracts.delete(s.id);
        if (F.activeContractId === s.id) F.activeContractId = null;
        save(); nav(); paintTable();
      }
      return;
    }
    if (e.target.closest('select') || e.target.closest('a')) return;
    const row = e.target.closest('[data-id]');
    if (row) {
      const cid = row.dataset.id;
      if (window.innerWidth >= 900) {
        F.activeContractId = cid;
        $$('tr.row', $('#clist')).forEach(r => r.classList.toggle('selected', r.dataset.id === cid));
        const activeContract = DB.contracts.find(x => x.id === cid);
        renderContractPreview(activeContract);
      } else {
        location.hash = '#/c/' + cid;
      }
    }
  };

  $('#clist').ondblclick = e => {
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button') || e.target.closest('a')) return;
    const row = e.target.closest('[data-id]');
    if (row) {
      F.activeContractId = row.dataset.id;
      window._lastNonEditorHash = '#/contracts';
      location.hash = '#/c/' + row.dataset.id;
    }
  };

  $('#clist').onchange = e => {
    const prjSel = e.target.closest('[data-cprj]');
    if (prjSel) {
      const c = DB.contracts.find(x => x.id === prjSel.dataset.cprj);
      if (c) {
        const val = prjSel.value;
        if (!val) {
          c.projectId = null;
          c.project = '';
        } else {
          const prj = projectById(val);
          if (prj) {
            c.projectId = prj.id;
            c.project = prj.name;
          }
        }
        c.updated = Date.now();
        save();
        toast(t('c.projectChangeToast') || 'تم تحديث مشروع العقد بنجاح');
        paintTable();
      }
      return;
    }
    const s = e.target.closest('[data-st]');
    if (!s) return;
    const c = DB.contracts.find(x => x.id === s.dataset.st);
    c.status = s.value;
    c.updated = Date.now();
    s.className = stSelClass(s.value);
    save();
    if (s.value === 'sent') {
      openSendModal(c, () => paintTable());
    } else {
      paintTable();
    }
  };
}

function vProjectWorkspace(pid) {
  if (!pid) { location.replace('#/projects'); return; }
  const prj = projectById(pid);
  if (!prj) { location.replace('#/projects'); return; }

  const housed = contractsOfProject(prj.id);
  const actN = housed.filter(c => c.tpl === 'actor').length;
  const artN = housed.filter(c => c.tpl === 'artistic').length;
  const ndaN = housed.filter(c => c.tpl === 'nda').length;
  const signedN = housed.filter(c => c.status === 'signed').length;
  const draftN = housed.filter(c => c.status === 'draft').length;

  view.innerHTML = `<div class="page">
    <a class="back-link" href="#/projects"><span class="back-arrow">&rarr;</span> ${t('ws.back')}</a>
    
    <div class="ws-hero">
      <div class="ws-hero-top">
        <div class="ws-hero-meta">
          <div class="ws-meta-row">
            <span class="p-type-badge p-type-${prj.type || 'series'}">${t('ptyp.' + (prj.type || 'series'))}</span>
            <span class="p-status-chip pst-${prj.status || 'production'}">${t('pst.' + (prj.status || 'production'))}</span>
            ${prj.year ? `<span class="p-year-chip">${toArabicDigits(prj.year)}</span>` : ''}
          </div>
          <div class="ws-title-row">
            <h1 class="ws-title">${esc(prj.name)}</h1>
            ${prj.code ? `<span class="p-code">${esc(prj.code)}</span>` : ''}
          </div>
          ${prj.description ? `<p class="ws-desc">${esc(prj.description)}</p>` : `<p class="ws-desc ws-desc-empty">${LANG === 'en' ? 'No project synopsis recorded.' : 'لا يوجد وصف للمشروع.'}</p>`}
        </div>
        <div class="ws-acts">
          <button class="btn pri" id="wsAddContract">${t('ws.addContract')}</button>
          <button class="btn sm" id="wsEditPrj">${t('p.edit')}</button>
          <button class="btn sm ghost danger" id="wsDelPrj">${t('p.del')}</button>
        </div>
      </div>

      <div class="ws-metrics-row">
        <div class="ws-metric-card">
          <span class="m-num">${toArabicDigits(housed.length)}</span>
          <span class="m-lbl">${t('ws.meta.contracts')}</span>
        </div>
        <div class="ws-metric-card">
          <span class="m-num" style="color:var(--green)">${toArabicDigits(signedN)}</span>
          <span class="m-lbl">${t('p.stat.signedContracts')}</span>
        </div>
        <div class="ws-metric-card">
          <span class="m-num" style="color:var(--amber)">${toArabicDigits(draftN)}</span>
          <span class="m-lbl">${t('p.stat.draftContracts')}</span>
        </div>
        <div class="ws-metric-card ws-breakdown-card">
          <div class="p-cnt-chips">
            ${actN ? `<span class="cb-chip cb-actor">${toArabicDigits(actN)} ${t('tpl.tag.actor')}</span>` : ''}
            ${artN ? `<span class="cb-chip cb-artistic">${toArabicDigits(artN)} ${t('tpl.tag.artistic')}</span>` : ''}
            ${ndaN ? `<span class="cb-chip cb-nda">${toArabicDigits(ndaN)} ${t('tpl.tag.nda')}</span>` : ''}
            ${!housed.length ? `<span class="sub" style="font-size:12px">${t('p.noContracts')}</span>` : ''}
          </div>
          <span class="m-lbl">${t('ws.breakdown')}</span>
        </div>
      </div>
    </div>

    <div class="section-h">${t('ws.housed')} <span class="badge">${toArabicDigits(housed.length)}</span></div>
    <div id="wsContractList"></div>
  </div>`;

  $('#wsAddContract').onclick = () => openAddContractModal(prj.id);
  $('#wsEditPrj').onclick = () => openProjectModal(prj, () => vProjectWorkspace(pid));
  $('#wsDelPrj').onclick = () => deleteProject(prj.id);

  const paintList = () => {
    const list = contractsOfProject(prj.id);
    list.sort((a, b) => b.updated - a.updated);

    if (!list.length) {
      $('#wsContractList').innerHTML = `<div class="empty">
        <h3>${t('ws.empty.h')}</h3>
        <p>${t('ws.empty.p')}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap">
          <button class="btn pri" data-quick-tpl="actor">${t('tpl.tag.actor')} (${t('seen.actor')})</button>
          <button class="btn" data-quick-tpl="artistic">${t('tpl.tag.artistic')} (${t('seen.artistic')})</button>
          <button class="btn" data-quick-tpl="nda">${t('tpl.tag.nda')} (${t('seen.nda')})</button>
        </div>
      </div>`;
      $('#wsContractList').onclick = e => {
        const qb = e.target.closest('[data-quick-tpl]');
        if (qb) {
          const c = newContract(tplById(qb.dataset.quickTpl), prj.id);
          DB.contracts.push(c); save(); nav();
          location.hash = '#/c/' + c.id;
        }
      };
      return;
    }

    $('#wsContractList').innerHTML = `<table class="list">
      <thead>
        <tr>
          <th>${t('c.th.contract')}</th>
          <th>${t('c.th.party')}</th>
          <th>${t('c.th.status')}</th>
          <th>${t('c.th.updated')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => {
          const tp = tplById(c.tpl);
          const roleOrTask = val(c, 'role') || val(c, 'task') || val(c, 'purpose');
          const isSentOrSigned = c.status === 'sent' || c.status === 'signed';
          return `<tr class="row" data-id="${c.id}">
            <td><div class="ar who">${esc(tp.ar)}</div><div class="sub"><bdi dir="ltr">${esc(toArabicDigits(c.ref))}</bdi></div></td>
            <td>
              <div class="who">${esc(partyOf(c) || t('no.party'))}</div>
              <div class="sub">${roleOrTask ? `<span class="sub-role">${esc(roleOrTask)}</span>` : esc(projectOf(c))}</div>
            </td>
            <td>${c.archived
              ? `<span class="pill st-archived">${t('st.archived')}</span>`
              : `<select class="${stSelClass(c.status)}" data-st="${c.id}">${STATUS_KEYS.map(v => `<option value="${v}"${c.status === v ? ' selected' : ''}>${stName(v)}</option>`).join('')}</select>`
            }</td>
            <td class="sub">${ago(c.updated)}</td>
            <td>
              <div class="acts">
                <button type="button" class="btn sm act-btn-edit" data-edit="${c.id}" title="${esc(t('pv.openEditor'))}"><span>${esc(t('c.edit'))}</span></button>
                <button type="button" class="btn sm act-btn-send" data-send="${c.id}" title="${esc(t('c.send'))}"><span>${esc(t('c.send'))}</span></button>
                <button type="button" class="btn sm act-btn-pdf" data-pdf="${c.id}" title="${esc(t('ed.exportPdf'))}"><span>PDF</span></button>
                <button type="button" class="btn sm act-btn-print" data-print="${c.id}" title="${esc(t('c.print') || 'طباعة')}"><span>${esc(t('c.print') || 'طباعة')}</span></button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

    $('#wsContractList').onclick = e => {
      const edit = e.target.closest('[data-edit]');
      if (edit) {
        location.hash = '#/c/' + edit.dataset.edit;
        return;
      }
      const send = e.target.closest('[data-send]');
      if (send) {
        const c = DB.contracts.find(x => x.id === send.dataset.send);
        if (c) openSendModal(c, () => paintList());
        return;
      }
      const pdf = e.target.closest('[data-pdf]');
      if (pdf) {
        const c = DB.contracts.find(x => x.id === pdf.dataset.pdf);
        if (c) downloadPdfDirect(c);
        return;
      }
      const prt = e.target.closest('[data-print]');
      if (prt) {
        const c = DB.contracts.find(x => x.id === prt.dataset.print);
        if (c) printContractDirect(c);
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const s = DB.contracts.find(c => c.id === del.dataset.del);
        if (!s) return;
        if (s.status === 'sent' || s.status === 'signed') {
          if (s.archived) {
            toast(t('c.archivedToast'));
            return;
          }
          if (confirm(t('c.archiveConfirm'))) {
            s.archived = true;
            s.updated = Date.now();
            save();
            toast(t('c.archivedToast'));
            paintList();
          }
          return;
        }
        if (confirm(t('c.delConfirm', { with: partyOf(s) ? t('c.delWith', { name: partyOf(s) }) : '' }))) {
          DB.contracts = DB.contracts.filter(c => c !== s);
          save(); nav(); paintList();
        }
        return;
      }
      if (e.target.closest('select') || e.target.closest('a')) return;
      const row = e.target.closest('[data-id]');
      if (row) location.hash = '#/c/' + row.dataset.id;
    };

    $('#wsContractList').onchange = e => {
      const s = e.target.closest('[data-st]');
      if (!s) return;
      const c = DB.contracts.find(x => x.id === s.dataset.st);
      c.status = s.value;
      c.updated = Date.now();
      s.className = stSelClass(s.value);
      save();
      if (s.value === 'sent') openSendModal(c, () => paintList());
      else paintList();
    };
  };

  paintList();
}

function vSettings() {
  const c = co();
  const row = (id, extra = '') => `<div class="frow"><label for="co-${id}">${t('co.' + id)}<small>${t('co.' + id + '.h')}</small></label><div><input class="in" id="co-${id}" data-co="${id}" dir="auto" value="${esc(c[id])}">${extra}</div></div>`;
  view.innerHTML = `<div class="page">
    <div class="page-h">
      <div>
        <h1>${t('set.h1')}</h1>
        <p>${t('set.sub')}</p>
      </div>
    </div>
    ${nameBanner() || `<div class="banner ok-banner"><b>${t('ban.ok')}</b></div>`}

    <div class="settings-grid">
      <!-- Section 1: Official Identity & Letterhead -->
      <div class="settings-card">
        <div class="settings-card-h">
          <h2>${t('set.co.h')}</h2>
          <p>${t('set.co.sub')}</p>
        </div>
        <div class="panel">
          ${row('name', `<label class="check" style="margin-top:8px"><input type="checkbox" id="confirm"${c.nameConfirmed ? ' checked' : ''}><span>${t('co.confirmName')}</span></label>`)}
          ${['rep', 'repTitle', 'decisionNo', 'decisionDate', 'register', 'registerDate', 'domicile', 'registeredOffice', 'nameEn', 'city', 'whatsapp', 'dispatchEmail'].map(id => row(id)).join('')}
          <div class="section-h" style="margin:26px 0 12px">${t('co.hf')}</div>
          ${['nameShort', 'legalForm', 'footerAddress', 'phone', 'email', 'website'].map(id => row(id)).join('')}
          <div class="frow"><label for="co-footerColor">${t('co.footerColor')}<small>${t('co.footerColor.h')}</small></label><div><select class="in" id="co-footerColor" data-co="footerColor" style="max-width:240px"><option value="red"${c.footerColor !== 'ink' ? ' selected' : ''}>${t('fc.red')}</option><option value="ink"${c.footerColor === 'ink' ? ' selected' : ''}>${t('fc.ink')}</option></select></div></div>
          <label class="check"><input type="checkbox" id="confirmContact"${c.contactConfirmed ? ' checked' : ''}><span>${t('co.confirmContact')}</span></label>
        </div>

        <div class="section-h" style="margin:28px 0 12px">${LANG === 'en' ? 'Official Letterhead & Footer Preview' : 'معاينة الترويسة والتذييل الرسميين'}</div>
        <div class="letterhead-preview-box">
          <div class="lh" style="position:relative;top:auto;left:auto;right:auto;padding-bottom:10px">
            <img class="lh-logo" src="assets/logo-red.svg" alt="MARTINI FUSION FILMS">
            <div class="lh-id">
              <b>${esc(c.nameShort)}</b>
              ${c.legalForm ? `<span>${esc(c.legalForm)}</span>` : ''}
              <span>س.ت <bdi dir="ltr">${esc(toArabicDigits(c.register))}</bdi></span>
            </div>
            <div class="lh-ref">
              <small>رقم العقد</small>
              <bdi dir="ltr">MF-SAMPLE-2026</bdi>
            </div>
          </div>
          <div style="height:24px"></div>
          <div class="fb" style="position:relative;left:auto;right:auto;bottom:auto;--band:${c.footerColor === 'ink' ? '#151517' : '#AF1717'}">
            <span class="fb-t">${esc(c.footerAddress)}<i>&middot;</i>هاتف <bdi dir="ltr">${esc(toArabicDigits(c.phone))}</bdi><i>&middot;</i><bdi dir="ltr">${esc(c.email)}</bdi><i>&middot;</i><bdi dir="ltr">${esc(c.website)}</bdi></span>
            <span class="fb-n"><bdi dir="ltr">1 / 1</bdi></span>
          </div>
        </div>
      </div>

      <!-- Section 2: Data Management & Backup -->
      <div class="settings-card">
        <div class="settings-card-h">
          <h2>${t('set.data.h')}</h2>
          <p>${t('set.data.sub')}</p>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <button class="btn pri" id="setBtnBackup">${t('set.backupBtn')}</button>
          <button class="btn" id="setBtnRestore">${t('set.restoreBtn')}</button>
          <input type="file" id="setFileRestore" accept="application/json" hidden>
        </div>
      </div>

      <!-- Section 3: Interface Preferences & Language -->
      <div class="settings-card">
        <div class="settings-card-h">
          <h2>${t('set.pref.h')}</h2>
          <p>${t('set.pref.sub')}</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn" id="setBtnLang">${t('side.lang')}</button>
        </div>
        <p style="color:var(--muted);font-size:12.5px;margin-top:14px;line-height:1.5">${t('side.note')}</p>
      </div>
    </div>
  </div>`;

  view.oninput = view.onchange = e => {
    const k = e.target.dataset && e.target.dataset.co;
    if (k) {
      c[k] = e.target.value;
      if (k === 'name') { c.nameConfirmed = false; const cf = $('#confirm'); if (cf) cf.checked = false; }
      save(); nav();
    }
    if (e.target.id === 'confirmContact') {
      c.contactConfirmed = e.target.checked;
      save(); nav();
      toast(t(c.contactConfirmed ? 'co.toast.contact' : 'co.toast.contactOff'));
    }
    if (e.target.id === 'confirm') {
      c.nameConfirmed = e.target.checked;
      save(); nav();
      toast(t(c.nameConfirmed ? 'co.toast.name' : 'co.toast.nameOff'));
    }
  };

  $('#setBtnBackup').onclick = exportBackup;
  $('#setBtnRestore').onclick = () => $('#setFileRestore').click();
  $('#setFileRestore').onchange = e => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  };
  $('#setBtnLang').onclick = () => {
    save();
    LANG = LANG === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
    applyLang(); route();
  };
}
const vCompany = vSettings;

/* ---------- editor ---------- */
function vEditor(id) {
  const c = DB.contracts.find(x => x.id === id);
  if (!c) { location.replace('#/contracts'); return; }
  if (!c.project && val(c, 'series')) c.project = val(c, 'series');
  const tpl = tplById(c.tpl);
  const groups = [...new Set(tpl.fields.map(f => f.group))];
  const outline = parseBody(tpl.body).filter(b => b.t === 'A' || b.t === 'H');
  const projects = [...new Set(DB.contracts.map(projectOf).filter(Boolean))];

  const backTarget = window._lastNonEditorHash || (c.projectId ? '#/project/' + c.projectId : '#/contracts');
  let initialSnapshot = JSON.stringify({
    values: Object.assign({}, c.values),
    project: c.project,
    projectId: c.projectId,
    ref: c.ref,
    date: c.date,
    sig: c.sig,
    notes: c.notes,
    status: c.status
  });
  const isBrandNew = !partyOf(c).trim();
  const p2Name = partyOf(c).trim();

  view.innerHTML = `<div class="ed">
    <header class="ed-top">
      <div class="ed-top-start">
        <a class="ed-back-btn" id="btnEdBack" href="${backTarget}" title="${t('ed.back')}">
          <span>${t('ed.back')}</span>
        </a>
        <div class="ed-divider"></div>
        <div class="ed-title-group">
          <div class="ed-title-row">
            <span class="ed-tpl-title">${esc(tpl.ar)}</span>
            <span class="ed-ref-badge" id="edRefBadge"><bdi>${esc(c.ref)}</bdi></span>
          </div>
          <div class="ed-party-row" id="edPartyRow">
            ${p2Name ? `<span class="ed-party-tag"><span>${LANG === 'en' ? 'With:' : 'الطرف الثاني:'}</span> <b>${esc(p2Name)}</b></span>` : `<span class="ed-party-tag dim">${LANG === 'en' ? 'Second party not specified' : 'لم يُحدد اسم الفريق الثاني'}</span>`}
          </div>
        </div>
      </div>

      <div class="ed-top-center">
        <div class="ed-status-wrap">
          <select class="${stSelClass(c.status)}" id="status">${STATUS_KEYS.map(v => `<option value="${v}"${c.status === v ? ' selected' : ''}>${stName(v)}</option>`).join('')}</select>
        </div>
        <div class="ed-save-indicator" id="saved">${t('ed.saved')}</div>
      </div>

      <div class="ed-top-actions">
        <button type="button" class="ed-btn-action ed-btn-save" id="btnSaveDoc" title="${t('ed.save')}">
          <span>${t('ed.save')}</span>
        </button>
        <button type="button" class="ed-btn-action ed-btn-send" id="btnSendDoc" title="${t('ed.send')}">
          <span>${t('ed.send')}</span>
        </button>
        <button type="button" class="ed-btn-action ed-btn-pdf" id="btnExportPdf" title="${t('ed.exportPdf')}">
          <span>${t('ed.exportPdf')}</span>
        </button>
        <button type="button" class="ed-btn-action ed-btn-print" id="btnPrintDoc" title="${t('c.print') || 'طباعة'}">
          <span>${t('c.print') || 'طباعة'}</span>
        </button>
      </div>
    </header>
    <div class="ed-body"><div class="form-pane" id="form">
      <details class="fs checks-sec" open><summary class="checks-sum"><span>${t('ed.checks')}</span></summary><div class="checks" id="checks"></div></details>
      ${groups.map(g => `<div class="fs"><h3>${esc(tGroup(g))}</h3>${tpl.fields.filter(f => f.group === g).map(f => {
        const [main, alt] = fieldLabels(f);
        const curOpt = f.options ? (val(c, f.id + '_type') || f.optDef || f.options[0].value) : null;
        return `<div class="fld-row"><label for="f-${f.id}"><span>${esc(main)}${f.req === false ? '' : ' <span class="req">*</span>'}</span><span class="alt" dir="auto">${esc(alt)}</span></label>
        ${f.options ? `<div class="opt-pills" role="group" aria-label="${esc(main)}">${f.options.map(opt => {
          const isSel = curOpt === opt.value;
          const optLbl = LANG === 'ar' ? (opt.label || opt.value) : (opt.en || opt.label || opt.value);
          return `<button type="button" class="opt-pill${isSel ? ' on' : ''}" data-opt-for="${f.id}" data-opt-val="${esc(opt.value)}">${esc(optLbl)}</button>`;
        }).join('')}</div>` : ''}
        <input class="in" id="f-${f.id}" data-f="${f.id}" dir="auto" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" placeholder="${esc(f.options ? (curOpt === 'جواز السفر' ? 'رقم جواز السفر' : (curOpt === 'السجل التجاري' ? 'رقم السجل التجاري' : (curOpt === 'بطاقة الهوية' ? 'رقم بطاقة الهوية' : (f.ph || '')))) : (f.ph || ''))}" value="${esc(c.values[f.id] ?? '')}">${f.hint ? `<div class="hint">${esc(tHint(f))}</div>` : ''}</div>`;
      }).join('')}</div>`).join('')}
      ${c.schedule ? `<div class="fs"><h3>${t('ed.sched')}</h3><div class="sched" id="sched"></div><div class="sched-total" id="stot"></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm" id="addRow">${t('ed.add')}</button><button class="btn sm ghost" id="resetRows">${t('ed.reset')}</button></div></div>` : ''}
      <div class="fs"><h3>${t('ed.filing')}</h3>
        <div class="fld-row"><label for="m-ref"><span>${t('ed.ref')}</span><span class="alt">${t('ed.ref.h')}</span></label><input class="in" id="m-ref" dir="ltr" value="${esc(c.ref)}"></div>
        <div class="fld-row"><label for="m-project-sel"><span>${t('ed.projectSelect')}</span></label>
          <select class="in" id="m-project-sel">
            <option value="">${t('ed.projectNone')}</option>
            ${(DB.projects || []).map(p => `<option value="${esc(p.id)}"${c.projectId === p.id || (!c.projectId && projectOf(c).toLowerCase() === p.name.toLowerCase()) ? ' selected' : ''}>${esc(p.name)} (${t('ptyp.' + (p.type || 'series'))})</option>`).join('')}
            <option value="__new__">${t('ed.projectNew')}</option>
          </select>
        </div>
        <div class="fld-row"><label for="m-project"><span>${t('ed.project')}</span></label><input class="in" id="m-project" list="projects" dir="auto" placeholder="${esc(val(c, 'series') || t('ed.project.ph'))}" value="${esc(c.project || val(c, 'series'))}"><datalist id="projects">${(DB.projects || []).map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></div>
        <div class="fld-row"><label for="m-date"><span>${t('ed.date')}</span></label><input class="in" id="m-date" dir="ltr" value="${esc(c.date)}"></div>
        <label class="check" style="margin:4px 0 10px"><input type="checkbox" id="m-sig"${c.sig !== false ? ' checked' : ''}><span>${t('ed.sig')}</span></label>
        <div class="fld-row"><label for="m-notes"><span>${t('ed.notes')}</span><span class="alt">${t('ed.notes.h')}</span></label><textarea class="in" id="m-notes" dir="auto">${esc(c.notes)}</textarea></div></div>
      <div class="fs"><h3>${t('ed.jump')}</h3><div class="outline" id="outline">${outline.map((b, i) => `<button data-jump="s${i + 1}">${esc(b.t === 'A' ? b.label.replace(/:$/, '') : b.text.replace(/:$/, ''))}</button>`).join('')}</div></div>
    </div><div class="pv-pane" id="pv"><div class="pv-bar"><span id="pvinfo"></span></div><div id="paperHost"></div></div></div></div>`;

  const paperHost = $('#paperHost');
  const hasSecondParty = () => !!partyOf(c).trim();
  const setSaved = (s, isWarn = false) => {
    const el = $('#saved');
    if (el) {
      el.textContent = s;
      el.style.color = isWarn ? 'var(--red)' : 'var(--muted)';
      el.style.fontWeight = isWarn ? '700' : '500';
    }
  };
  const commit = debounce(() => {
    if (!hasSecondParty()) {
      setSaved(LANG === 'en' ? 'Second party name required' : 'مطلوب اسم الفريق الثاني للحفظ', true);
      return;
    }
    save();
    setSaved(t('ed.saved'), false);
  }, 350);
  const updateEdHeader = () => {
    const pEl = $('#edPartyRow');
    if (pEl) {
      const pName = partyOf(c).trim();
      pEl.innerHTML = pName
        ? `<span class="ed-party-tag"><span>${LANG === 'en' ? 'With:' : 'الطرف الثاني:'}</span> <b>${esc(pName)}</b></span>`
        : `<span class="ed-party-tag dim">${LANG === 'en' ? 'Second party not specified' : 'لم يُحدد اسم الفريق الثاني'}</span>`;
    }
    const rEl = $('#edRefBadge');
    if (rEl) rEl.innerHTML = `<bdi>${esc(c.ref)}</bdi>`;
  };
  const touch = () => {
    c.updated = Date.now();
    updateEdHeader();
    if (!hasSecondParty()) {
      setSaved(LANG === 'en' ? 'Second party name required' : 'مطلوب اسم الفريق الثاني للحفظ', true);
    } else {
      setSaved(t('ed.saving'), false);
      commit();
    }
    refresh();
  };
  if (!hasSecondParty()) {
    setSaved(LANG === 'en' ? 'Second party name required' : 'مطلوب اسم الفريق الثاني للحفظ', true);
  }
  let lay = { N: 1, jump: {} }, hl = null;
  function refresh() {
    const keepTop = $('#pv').scrollTop;
    lay = renderPages(tpl, c);
    paperHost.innerHTML = lay.html;
    $('#pvinfo').innerHTML = t('pv.info', { n: lay.N, words: pagesWords(lay.N) });
    fit(); drawChecks();
    if (hl) mark(hl, false);
    $('#pv').scrollTop = keepTop;
  }
  function fit() { const p = $('.pages', paperHost), w = $('#pv').clientWidth - 40; if (p) p.style.zoom = Math.min(1.2, w / 793.7); }
  // a field appears once per page clone; only one clone is inside its page's window
  const visibleFld = fid => $$(`.fld[data-f="${fid}"]`, paperHost).find(e => { const w = e.closest('.win').getBoundingClientRect(), r = e.getBoundingClientRect(); return r.right > w.left + 1 && r.left < w.right - 1; });
  function mark(fid, scroll = true) {
    hl = fid; $$('.fld.hl', paperHost).forEach(x => x.classList.remove('hl'));
    $$(`.fld[data-f="${fid}"], .fld[data-f="${fid}_type"]`, paperHost).forEach(x => x.classList.add('hl'));
    const v = visibleFld(fid) || visibleFld(fid + '_type');
    if (scroll && v) v.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function drawChecks() {
    const ch = checks(c), out = [];
    if (!co().nameConfirmed) out.push(`<div class="chk warn"><i></i><span>${t('chk.name')}</span></div>`);
    if (!co().contactConfirmed) out.push(`<div class="chk warn"><i></i><span>${t('chk.contact')}</span></div>`);
    if (ch.missing.length) out.push(`<div class="chk warn"><i></i><span>${t('chk.missing', { n: ch.missing.length, list: ch.missing.map(f => `<button data-goto="${f.id}">${esc(fieldLabels(f)[0].replace(/ \(.*\)/, ''))}</button>`).join(t('chk.join')) })}</span></div>`);
    else out.push(`<div class="chk"><i></i><span>${t('chk.ok')}</span></div>`);
    if (ch.total !== null) out.push(ch.schedOff ? `<div class="chk warn"><i></i><span>${t('chk.sched.bad', { total: ch.total })}</span></div>` : `<div class="chk"><i></i><span>${t('chk.sched.ok')}</span></div>`);
    tNotes(tpl).forEach(n => out.push(`<div class="chk note"><i></i><span>${esc(n)}</span></div>`));
    $('#checks').innerHTML = out.join('');
  }
  const sumOnly = () => { const s = c.schedule.reduce((a, r) => a + (Number(toArabicDigits(r.pct)) || 0), 0); $('#stot').className = 'sched-total ' + (s === 100 ? 'good' : 'bad'); $('#stot').innerHTML = `<span>${t('ed.total')}</span><span>${s}%</span>`; };
  function drawSched() {
    if (!c.schedule) return;
    $('#sched').innerHTML = c.schedule.map((r, i) => `<div class="r"><input class="in" data-sp="${i}" inputmode="numeric" value="${esc(r.pct)}" aria-label="${esc(t('ed.pct'))}"><input class="in" data-st="${i}" dir="rtl" value="${esc(r.text)}" aria-label="${esc(t('ed.stage'))}"><button data-sd="${i}" title="${esc(t('ed.remove'))}">&times;</button></div>`).join('');
    sumOnly();
  }

  const pSel = $('#m-project-sel');
  if (pSel) {
    pSel.onchange = e => {
      const v = e.target.value;
      if (v === '__new__') {
        openProjectModal(null, newPrj => {
          c.projectId = newPrj.id;
          c.project = newPrj.name;
          if (c.values.series !== undefined || tpl.fields.some(f => f.id === 'series')) {
            c.values.series = newPrj.name;
            const sIn = $('#f-series'); if (sIn) sIn.value = newPrj.name;
          }
          const pIn = $('#m-project'); if (pIn) pIn.value = newPrj.name;
          touch();
          pSel.innerHTML = `<option value="">${t('ed.projectNone')}</option>` +
            (DB.projects || []).map(p => `<option value="${esc(p.id)}"${c.projectId === p.id ? ' selected' : ''}>${esc(p.name)} (${t('ptyp.' + (p.type || 'series'))})</option>`).join('') +
            `<option value="__new__">${t('ed.projectNew')}</option>`;
        });
      } else if (!v) {
        c.projectId = null; c.project = '';
        const pIn = $('#m-project'); if (pIn) pIn.value = '';
        touch();
      } else {
        const prj = projectById(v);
        if (prj) {
          c.projectId = prj.id;
          c.project = prj.name;
          if (c.values.series !== undefined || tpl.fields.some(f => f.id === 'series')) {
            c.values.series = prj.name;
            const sIn = $('#f-series'); if (sIn) sIn.value = prj.name;
          }
          const pIn = $('#m-project'); if (pIn) pIn.value = prj.name;
          touch();
        }
      }
    };
  }

  $('#form').addEventListener('input', e => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (/[٠-٩۰-۹]/.test(el.value)) {
        const pos = el.selectionStart;
        el.value = toArabicDigits(el.value);
        if (pos !== null) el.setSelectionRange(pos, pos);
      }
    }
    if (el.dataset.f) {
      c.values[el.dataset.f] = el.value;
      el.classList.toggle('done', !!el.value.trim());
      if (el.dataset.f === 'series') {
        c.project = el.value;
        const pIn = $('#m-project');
        if (pIn) pIn.value = el.value;
        const matched = (DB.projects || []).find(p => p.name.trim().toLowerCase() === el.value.trim().toLowerCase());
        c.projectId = matched ? matched.id : null;
        if (pSel) pSel.value = c.projectId || '';
      }
      touch();
    }
    else if (el.id === 'm-ref') { c.ref = el.value; $('.ed-title small').innerHTML = `<bdi>${esc(c.ref)}</bdi>`; touch(); }
    else if (el.id === 'm-project') {
      c.project = el.value;
      const matched = (DB.projects || []).find(p => p.name.trim().toLowerCase() === el.value.trim().toLowerCase());
      c.projectId = matched ? matched.id : null;
      if (pSel) pSel.value = c.projectId || '';
      if (c.values.series !== undefined || tpl.fields.some(f => f.id === 'series')) {
        c.values.series = el.value;
        const sIn = $('#f-series'); if (sIn) sIn.value = el.value;
      }
      touch();
    }
    else if (el.id === 'm-date') { c.date = el.value; touch(); }
    else if (el.id === 'm-notes') { c.notes = el.value; c.updated = Date.now(); commit(); }
    else if (el.dataset.sp !== undefined) { c.schedule[+el.dataset.sp].pct = el.value; sumOnly(); touch(); }
    else if (el.dataset.st !== undefined) { c.schedule[+el.dataset.st].text = el.value; touch(); }
  });
  $('#form').addEventListener('change', e => { if (e.target.id === 'm-sig') { c.sig = e.target.checked; touch(); } });
  $('#form').addEventListener('focusin', e => { if (e.target.dataset.f) mark(e.target.dataset.f); });
  $('#form').addEventListener('click', e => {
    const optBtn = e.target.closest('[data-opt-for]');
    if (optBtn) {
      const fId = optBtn.dataset.optFor;
      const optVal = optBtn.dataset.optVal;
      c.values[fId + '_type'] = optVal;
      optBtn.parentElement.querySelectorAll('.opt-pill').forEach(b => b.classList.toggle('on', b === optBtn));
      const inp = $('#f-' + fId);
      if (inp) {
        if (optVal === 'جواز السفر') inp.placeholder = 'رقم جواز السفر';
        else if (optVal === 'السجل التجاري') inp.placeholder = 'رقم السجل التجاري';
        else if (optVal === 'بطاقة الهوية') inp.placeholder = 'رقم بطاقة الهوية';
        else inp.placeholder = 'رقم الهوية أو جواز السفر';
      }
      touch();
      return;
    }
    const j = e.target.closest('[data-jump]'), g = e.target.closest('[data-goto]'), sd = e.target.closest('[data-sd]');
    if (j) { const pg = $$('.pg', paperHost)[lay.jump[j.dataset.jump] || 0]; if (pg) pg.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (g) { const i = $('#f-' + g.dataset.goto); i.focus(); i.scrollIntoView({ block: 'center' }); }
    if (sd) { c.schedule.splice(+sd.dataset.sd, 1); drawSched(); touch(); }
  });
  if (c.schedule) {
    drawSched();
    $('#addRow').onclick = () => { c.schedule.push({ pct: 0, text: '' }); drawSched(); touch(); };
    $('#resetRows').onclick = () => { c.schedule = tpl.schedule.map(r => ({ ...r })); drawSched(); touch(); };
  }
  paperHost.addEventListener('click', e => {
    const f = e.target.closest('.fld'); if (!f) return;
    let id = f.dataset.f; if (id === '@date') { $('#m-date').focus(); return; }
    if (id && id.endsWith('_type')) id = id.replace(/_type$/, '');
    const i = $('#f-' + id); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); }
  });
  $('#status').onchange = e => {
    c.status = e.target.value;
    c.updated = Date.now();
    e.target.className = stSelClass(e.target.value);
    save();
    if (e.target.value === 'sent') openSendModal(c);
  };
  const btnSave = $('#btnSaveDoc');
  if (btnSave) {
    btnSave.onclick = () => {
      if (!hasSecondParty()) {
        toast(LANG === 'en' ? 'Cannot save: Second party name is required' : 'لا يمكن حفظ العقد بدون اسم الفريق الثاني');
        const inp = $('#f-p2name');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
          inp.style.borderColor = 'var(--red)';
        }
        return;
      }
      c.updated = Date.now();
      save(); nav();
      initialSnapshot = JSON.stringify({
        values: Object.assign({}, c.values),
        project: c.project,
        projectId: c.projectId,
        ref: c.ref,
        date: c.date,
        sig: c.sig,
        notes: c.notes,
        status: c.status
      });
      setSaved(t('ed.saved'), false);
      toast(LANG === 'en' ? 'Contract saved successfully' : 'تم حفظ العقد بنجاح');
    };
  }

  const handleBack = () => {
    F.activeContractId = c.id;
    if (!hasSecondParty()) {
      closeModal();
      const div = document.createElement('div');
      div.id = 'modalOverlay';
      div.className = 'modal-overlay';
      div.innerHTML = `<div class="modal-card" style="max-width:480px">
        <div class="modal-h">
          <h3 style="color:var(--red)">${LANG === 'en' ? 'Second Party Name Required' : 'اسم الفريق الثاني مطلوب'}</h3>
          <button class="modal-close" id="mCloseBack">&times;</button>
        </div>
        <div class="modal-body" style="font-size:14px;line-height:1.6">
          <p>${LANG === 'en'
            ? 'You cannot save this document without specifying the second party name (Actor / Crew / Recipient).'
            : 'لا يمكن حفظ هذا العقد بدون تحديد اسم الفريق الثاني (الممثل / الفني / المستلم).'}</p>
          <p style="color:var(--muted);font-size:13px">${LANG === 'en'
            ? 'Would you like to discard this contract and delete it, or stay to enter the name?'
            : 'هل ترغب في تجاهل هذا العقد وحذفه، أم البقاء لإدخال اسم الفريق الثاني؟'}</p>
        </div>
        <div class="modal-foot" style="justify-content:space-between">
          <button class="btn sm danger" id="btnDiscardEmpty">${LANG === 'en' ? 'Discard & Delete' : 'تجاهل وحذف العقد'}</button>
          <button class="btn sm pri" id="btnStayToEnter">${LANG === 'en' ? 'Stay & Enter Name' : 'البقاء لإدخال الاسم'}</button>
        </div>
      </div>`;
      document.body.appendChild(div);
      $('#mCloseBack').onclick = closeModal;
      div.onclick = e => { if (e.target === div) closeModal(); };
      $('#btnStayToEnter').onclick = () => {
        closeModal();
        const inp = $('#f-p2name');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
          inp.style.borderColor = 'var(--red)';
        }
      };
      $('#btnDiscardEmpty').onclick = () => {
        closeModal();
        if (isBrandNew) {
          DB.contracts = DB.contracts.filter(x => x.id !== c.id);
          save(); nav();
        }
        toast(LANG === 'en' ? 'Contract discarded' : 'تم تجاهل العقد');
        location.hash = backTarget;
      };
      return;
    }

    const currentSnapshot = JSON.stringify({
      values: Object.assign({}, c.values),
      project: c.project,
      projectId: c.projectId,
      ref: c.ref,
      date: c.date,
      sig: c.sig,
      notes: c.notes,
      status: c.status
    });

    if (currentSnapshot === initialSnapshot) {
      F.activeContractId = c.id;
      location.hash = backTarget;
      return;
    }

    closeModal();
    const div = document.createElement('div');
    div.id = 'modalOverlay';
    div.className = 'modal-overlay';
    div.innerHTML = `<div class="modal-card" style="max-width:480px">
      <div class="modal-h">
        <h3>${LANG === 'en' ? 'Return to List' : 'العودة إلى القائمة'}</h3>
        <button class="modal-close" id="mCloseBack">&times;</button>
      </div>
      <div class="modal-body" style="font-size:14px;line-height:1.6">
        <p>${LANG === 'en'
          ? 'Would you like to save your changes before exiting, discard them, or stay in the editor?'
          : 'هل ترغب في حفظ التعديلات والعودة، أم تجاهل التعديلات الأخيرة، أم البقاء في المحرر؟'}</p>
      </div>
      <div class="modal-foot" style="justify-content:space-between">
        <button class="btn sm danger ghost" id="btnDiscardChanges">${LANG === 'en' ? 'Discard Changes' : 'تجاهل التعديلات'}</button>
        <div style="display:flex;gap:8px">
          <button class="btn sm ghost" id="btnStay">${LANG === 'en' ? 'Stay' : 'البقاء'}</button>
          <button class="btn sm pri" id="btnSaveAndExit">${LANG === 'en' ? 'Save & Exit' : 'حفظ والعودة'}</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
    $('#mCloseBack').onclick = closeModal;
    div.onclick = e => { if (e.target === div) closeModal(); };
    $('#btnStay').onclick = closeModal;
    $('#btnSaveAndExit').onclick = () => {
      closeModal();
      c.updated = Date.now();
      save(); nav();
      F.activeContractId = c.id;
      toast(LANG === 'en' ? 'Contract saved' : 'تم حفظ العقد بنجاح');
      location.hash = backTarget;
    };
    $('#btnDiscardChanges').onclick = () => {
      closeModal();
      try {
        const snap = JSON.parse(initialSnapshot);
        c.values = snap.values;
        c.project = snap.project;
        c.projectId = snap.projectId;
        c.ref = snap.ref;
        c.date = snap.date;
        c.sig = snap.sig;
        c.notes = snap.notes;
        c.status = snap.status;
        save(); nav();
      } catch (e) {}
      F.activeContractId = c.id;
      toast(LANG === 'en' ? 'Changes discarded' : 'تم تجاهل التعديلات');
      location.hash = backTarget;
    };
  };

  const backBtn = $('#btnEdBack');
  if (backBtn) {
    backBtn.onclick = e => {
      e.preventDefault();
      handleBack();
    };
  }

  const btnSend = $('#btnSendDoc');
  if (btnSend) {
    btnSend.onclick = () => {
      if (!hasSecondParty()) {
        toast(LANG === 'en' ? 'Cannot send: Second party name is required' : 'لا يمكن إرسال العقد بدون تحديد اسم الفريق الثاني');
        const inp = $('#f-p2name');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
          inp.style.borderColor = 'var(--red)';
        }
        return;
      }
      c.updated = Date.now();
      save(); nav();
      openSendModal(c, () => {
        const stSel = $('#status');
        if (stSel) {
          stSel.value = c.status;
          stSel.className = stSelClass(c.status);
        }
      });
    };
  }

  const doDownloadPdf = () => {
    if (!hasSecondParty()) {
      toast(LANG === 'en' ? 'Cannot export PDF: Second party name is required' : 'لا يمكن تصدير العقد بدون اسم الفريق الثاني');
      const inp = $('#f-p2name');
      if (inp) {
        inp.focus();
        inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
        inp.style.borderColor = 'var(--red)';
      }
      return;
    }
    c.updated = Date.now();
    save(); nav();
    downloadPdfDirect(c);
  };

  const doPrintDoc = () => {
    if (!hasSecondParty()) {
      toast(LANG === 'en' ? 'Cannot print: Second party name is required' : 'لا يمكن طباعة العقد بدون اسم الفريق الثاني');
      const inp = $('#f-p2name');
      if (inp) {
        inp.focus();
        inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
        inp.style.borderColor = 'var(--red)';
      }
      return;
    }
    c.updated = Date.now();
    save(); nav();
    printContractDirect(c);
  };

  const btnExportPdf = $('#btnExportPdf');
  if (btnExportPdf) btnExportPdf.onclick = doDownloadPdf;
  const btnPrintDoc = $('#btnPrintDoc');
  if (btnPrintDoc) btnPrintDoc.onclick = doPrintDoc;
  const btnPrintOld = $('#btnPrint');
  if (btnPrintOld) btnPrintOld.onclick = doPrintDoc;
  window.onresize = debounce(fit, 80);
  refresh();
  if (window.__autoExportPdf) {
    delete window.__autoExportPdf;
    setTimeout(doDownloadPdf, 150);
  }
}

/* ---------- backup ---------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'fusion-legal-hub', version: 1, exported: new Date().toISOString(), projects: DB.projects || [], ...DB }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `legal-hub-backup-${today().replace(/\//g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result); if (d.app !== 'fusion-legal-hub') throw new Error('not a hub backup');
      const byId = new Map(DB.contracts.map(c => [c.id, c])); let added = 0, updated = 0;
      (d.contracts || []).forEach(c => { const ex = byId.get(c.id); if (!ex) { DB.contracts.push(c); added++; } else if ((c.updated || 0) > ex.updated) { Object.assign(ex, c); updated++; } });
      if (d.projects && Array.isArray(d.projects)) {
        const pById = new Map((DB.projects || []).map(p => [p.id, p]));
        d.projects.forEach(p => {
          const ex = pById.get(p.id);
          if (!ex) { DB.projects.push(p); }
          else if ((p.updated || 0) > (ex.updated || 0)) Object.assign(ex, p);
        });
      }
      if (d.company) DB.company = Object.assign({}, DB.company, d.company);
      save(); nav(); route(); toast(t('bk.ok', { a: added, u: updated }));
    } catch (e) { toast(t('bk.bad')); }
  };
  r.readAsText(file);
}

/* ---------- shell ---------- */
function nav() {
  const nP = $('#nProjects');
  if (nP) nP.textContent = toArabicDigits((DB.projects || []).length);
  const nC = $('#nContracts');
  if (nC) nC.textContent = toArabicDigits(DB.contracts.length);
  const dot = $('#dotCompany');
  if (dot) dot.style.display = co().nameConfirmed && co().contactConfirmed ? 'none' : '';
}
function route() {
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    let last = null;
    try { last = localStorage.getItem('fusionLegalHub.lastRoute'); } catch (e) {}
    if (last && last.startsWith('#/')) {
      location.replace(last);
      return;
    }
  }
  try { localStorage.setItem('fusionLegalHub.lastRoute', location.hash); } catch (e) {}
  const [a, b] = (location.hash.replace(/^#\/?/, '') || 'templates').split('/');
  if (a !== 'c') {
    window._lastNonEditorHash = location.hash || '#/contracts';
  }
  if (a === 'company') {
    location.replace('#/settings');
    return;
  }
  $$('.side nav a').forEach(x => {
    x.classList.toggle('on',
      x.dataset.r === a ||
      (a === 'c' && x.dataset.r === 'contracts') ||
      (a === 'project' && x.dataset.r === 'projects')
    );
  });
  window.onresize = null; view.oninput = view.onchange = null;
  ({
    templates: vTemplates,
    projects: vProjects,
    contracts: vContracts,
    settings: vSettings,
    company: vSettings,
    c: vEditor,
    project: vProjectWorkspace
  }[a] || vTemplates)(b);
  if (a !== 'contracts' || !F.activeContractId) {
    view.scrollTop = 0;
  }
}

const AUTH_KEY = 'fusionLegalHub.auth';
const AUTH_PASS = 'martini2026';

function isAuthed() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === AUTH_PASS || localStorage.getItem(AUTH_KEY) === AUTH_PASS;
  } catch (e) {
    return false;
  }
}

function showAuthGate() {
  const gate = $('#authGate');
  if (!gate) return;
  gate.style.display = 'flex';
  const inp = $('#authInput');
  const err = $('#authErr');
  const form = $('#authForm');
  if (err) err.style.display = 'none';
  if (inp) {
    inp.value = '';
    inp.placeholder = t('auth.passPlaceholder');
    setTimeout(() => inp.focus(), 60);
  }
  form.onsubmit = e => {
    e.preventDefault();
    if (inp.value === AUTH_PASS) {
      try {
        sessionStorage.setItem(AUTH_KEY, AUTH_PASS);
        localStorage.setItem(AUTH_KEY, AUTH_PASS);
      } catch (err) {}
      gate.style.display = 'none';
      applyLang();
      nav();
      route();
    } else {
      if (err) {
        err.style.display = 'block';
        err.classList.remove('shake');
        void err.offsetWidth;
        err.classList.add('shake');
      }
      inp.select();
    }
  };
}

function lockHub() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
  showAuthGate();
}

$('#btnLang').onclick = () => {
  save();
  LANG = LANG === 'ar' ? 'en' : 'ar';
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) { /* storage blocked */ }
  applyLang();
  if (isAuthed()) route();
  else showAuthGate();
};
const btnLock = $('#btnLock');
if (btnLock) btnLock.onclick = lockHub;
$('#btnBackup').onclick = exportBackup;
$('#fileRestore').onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; };
$('#btnRestore').onclick = () => $('#fileRestore').click();
window.addEventListener('hashchange', () => { if (isAuthed()) route(); });
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { const s = $('.search input'); if (s) { e.preventDefault(); s.focus(); } } });

applyLang();
if (!isAuthed()) {
  showAuthGate();
} else {
  nav();
  route();
}
})();
