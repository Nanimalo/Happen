// Kleine UI-Bausteine, die alle Ansichten nutzen.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const P = {
  sunrise: '<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v3M4.9 8.9l1.6 1.6M19.1 8.9l-1.6 1.6M2 21h20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  apple: '<path d="M12 7c-1-2-5-2.5-6.5.5S5 16 8 19c1.5 1.5 2.5 1 4 .4 1.5.6 2.5 1.1 4-.4 3-3 3.5-8.5 2-11.5S13 5 12 7zM12 7c0-2 1-3.5 3-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M17 8v8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a6 6 0 0 1 8 0l-2 3h-4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.2 1 2.1h5c0-.9.3-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="M6 21l3-6 3 2v5M9 15l1.5-5L15 9l3 4h3M10.5 10L7 11l-1 3"/>'
};
export const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`;

// ---------- Toast ----------
let toastTimer;
export function toast(msg, action) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
  t.hidden = false;
  t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
  if (action) t.querySelector("button").onclick = () => { action.run(); hide(); };
  clearTimeout(toastTimer);
  const hide = () => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 250); };
  toastTimer = setTimeout(hide, action ? 5000 : 2600);
}

// ---------- Bottom-Sheet ----------
const stack = [];
export function sheet({ title = "", body = "", full = false, cls = "", onMount, back = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById("sheet-root");
    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = `
      <div class="sheet-backdrop"></div>
      <section class="sheet ${full ? "full" : ""} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="sheet-head">
          <button type="button" class="icon-btn" data-close aria-label="${back ? "Zurück" : "Schließen"}">${icon(back ? "left" : "close")}</button>
          <h2>${esc(title)}</h2>
          <span class="sheet-slot"></span>
        </header>
        <div class="sheet-body">${body}</div>
      </section>`;
    root.appendChild(wrap);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => wrap.classList.add("open"));
    let done = false;
    const close = (value) => {
      if (done) return; done = true;
      wrap.classList.remove("open");
      stack.splice(stack.indexOf(close), 1);
      setTimeout(() => { wrap.remove(); if (!stack.length) document.body.classList.remove("no-scroll"); }, 260);
      cleanup?.();
      resolve(value);
    };
    stack.push(close);
    wrap.querySelector(".sheet-backdrop").onclick = () => close();
    wrap.querySelector("[data-close]").onclick = () => close();
    const s = wrap.querySelector(".sheet");
    let cleanup;
    if (onMount) cleanup = onMount(s, close);
  });
}
export const closeTopSheet = () => { const c = stack[stack.length - 1]; if (c) { c(); return true; } return false; };
export const closeAllSheets = () => { while (stack.length) stack[stack.length - 1](); };

export function ask(title, text, okLabel = "OK", danger = false) {
  return sheet({
    title,
    body: `<p class="muted">${esc(text)}</p><div class="row-btns"><button class="btn ghost" data-no>Abbrechen</button><button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(okLabel)}</button></div>`,
    onMount: (s, close) => { s.querySelector("[data-no]").onclick = () => close(false); s.querySelector("[data-yes]").onclick = () => close(true); }
  });
}

// ---------- Fortschrittsring ----------
export function ring(value, max, { size = 180, stroke = 14, cls = "", over = false } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  return `<svg class="ring ${cls} ${over ? "over" : ""}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

export function bar(value, max, cls = "") {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return `<div class="bar ${cls} ${max && value > max ? "over" : ""}"><i style="width:${p}%"></i></div>`;
}

export function nutriScore(g) {
  if (!g) return "";
  const L = ["a", "b", "c", "d", "e"];
  return `<span class="nutri" aria-label="Nutri-Score ${g.toUpperCase()}">${L.map((l) => `<b class="ns-${l} ${l === g ? "on" : ""}">${l.toUpperCase()}</b>`).join("")}</span>`;
}

export function foodThumb(f) {
  if (f.image) return `<img class="thumb" src="${esc(f.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  const letter = (f.name || "?").trim()[0] || "?";
  return `<span class="thumb ph cat-${esc((f.category || f.source || "").toLowerCase().replace(/[^a-z]/g, ""))}">${esc(letter.toUpperCase())}</span>`;
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export const dateLabel = (key, today) => {
  const d = new Date(key + "T12:00:00");
  const diff = Math.round((new Date(key + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5);
  if (diff === 0) return "Heute";
  if (diff === -1) return "Gestern";
  if (diff === 1) return "Morgen";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
};
