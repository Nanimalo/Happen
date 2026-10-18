// ============================================================
//  Garmin: verbrannte Kalorien übernehmen
//  1) Aktive Kalorien des Tages eintragen (aus der Garmin-Connect-App)
//  2) Aktivitäten-Export (CSV) von connect.garmin.com importieren
//  Eine direkte Live-Verbindung bietet Garmin für private Apps nicht an.
// ============================================================
import { day, uid, commit } from "./store.js";

// Robuster CSV-Leser (Anführungszeichen, Komma oder Semikolon)
export function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const pad = (n) => String(n).padStart(2, "0");

// "2025-10-18 07:30:12", "18.10.2025 07:30", "10/18/2025 7:30 AM" -> "2025-10-18"
export function parseDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  const d = new Date(s);
  return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "1,234" / "1.234" / "512" / "512,5" -> Zahl
export function parseNum(s) {
  s = String(s ?? "").trim().replace(/\s/g, "");
  if (!s || s === "--") return null;
  s = s.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Garmin-Aktivitäten-CSV -> [{date, name, kcal, min, gid}]
export function parseGarminCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("Die Datei enthält keine Aktivitäten.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const iDate = col(/^(date|datum)$/);
  const iKcal = col(/^(calories|kalorien|kcal)$/);
  const iType = col(/^(activity type|aktivitätstyp|aktivitätsart|typ)$/);
  const iTitle = col(/^(title|titel|name)$/);
  const iTime = col(/^(time|zeit|dauer|elapsed time|verstrichene zeit)$/);
  if (iDate < 0 || iKcal < 0) throw new Error("Das ist keine Garmin-Aktivitätenliste. Es fehlen die Spalten „Date“/„Datum“ und „Calories“/„Kalorien“.");
  const out = [];
  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate]);
    const kcal = parseNum(r[iKcal]);
    if (!date || !(kcal > 0)) continue;
    let min = null;
    const t = iTime >= 0 ? String(r[iTime] || "").match(/^(\d+):(\d{2})(?::(\d{2}))?/) : null;
    if (t) min = t[3] != null ? +t[1] * 60 + +t[2] : +t[1];
    const name = [r[iTitle], r[iType]].map((x) => (x || "").trim()).find(Boolean) || "Garmin-Aktivität";
    out.push({ date, name, kcal: Math.round(kcal), min, gid: `${String(r[iDate]).trim()}|${name}` });
  }
  return out;
}

// Importiert Aktivitäten ins Tagebuch, Duplikate werden übersprungen
export function importGarminActivities(list) {
  let added = 0, skipped = 0;
  const days = new Set();
  for (const a of list) {
    const d = day(a.date);
    if (d.activities.some((x) => x.gid === a.gid)) { skipped++; continue; }
    d.activities.push({ id: uid(), source: "garmin", gid: a.gid, name: a.name, kcal: a.kcal, ...(a.min ? { min: a.min } : {}) });
    days.add(a.date); added++;
  }
  commit();
  return { added, skipped, days: days.size };
}

// Aktive Kalorien eines Tages setzen (ersetzt einen früheren Garmin-Tageswert)
export function setGarminDay(dateKey, kcal) {
  const d = day(dateKey);
  d.activities = d.activities.filter((a) => a.source !== "garmin-day");
  if (kcal > 0) d.activities.push({ id: uid(), source: "garmin-day", name: "Garmin · aktive Kalorien", kcal: Math.round(kcal) });
  commit();
}
