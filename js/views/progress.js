// Verlauf: Kalorien, Makros, Gewicht, Körpermaße, Nährstoffe, Coach
import { state, commit, todayKey, shiftDay, latestWeight, uid } from "../store.js";
import { goalFor, dayTotals, NUTRIENTS, fmt, fmt1, bmi } from "../nutrition.js";
import { icon, esc, sheet, toast } from "../ui.js";
import { weightSheet } from "./diary.js";
import { aiReady, coachAdvice } from "../ai.js";

let range = 7;
let bodyMetric = "waist";
const BODY = [
  { k: "fat", label: "Körperfett", unit: "%" },
  { k: "muscle", label: "Muskelanteil", unit: "%" },
  { k: "waist", label: "Taille", unit: "cm" },
  { k: "hip", label: "Hüfte", unit: "cm" },
  { k: "chest", label: "Brust", unit: "cm" },
  { k: "arm", label: "Oberarm", unit: "cm" },
  { k: "thigh", label: "Oberschenkel", unit: "cm" }
];

function barChart(days) {
  const W = 340, H = 150, padL = 30, padB = 20, top = 8;
  const max = Math.max(...days.map((d) => Math.max(d.kcal, d.goal)), 500) * 1.08;
  const y = (v) => top + (H - padB - top) * (1 - v / max);
  const bw = (W - padL) / days.length;
  const ticks = [0, max / 2, max].map((v) => Math.round(v / 100) * 100);
  const showLabel = (i) => days.length <= 7 || i % Math.ceil(days.length / 6) === 0 || i === days.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalorien pro Tag">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 4}" y="${y(t) + 3}" text-anchor="end">${t >= 1000 ? fmt1(t / 1000) + "k" : t}</text>`).join("")}
    ${days.map((d, i) => {
      const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
      const cls = !d.kcal ? "b-none" : d.kcal > d.goal * 1.05 ? "b-over" : "b-ok";
      const hgt = d.kcal ? Math.max(2, y(0) - y(d.kcal)) : 3;
      return `<rect class="${cls}" x="${x}" y="${y(0) - hgt}" width="${w}" height="${hgt}" rx="${Math.min(4, w / 3)}"/>${showLabel(i) ? `<text x="${x + w / 2}" y="${H - 5}" text-anchor="middle">${d.label}</text>` : ""}`;
    }).join("")}
    <polyline class="goal" fill="none" points="${days.map((d, i) => `${padL + i * bw},${y(d.goal)} ${padL + (i + 1) * bw},${y(d.goal)}`).join(" ")}"/>
  </svg>`;
}

function lineChart(points, goal, unit) {
  if (points.length < 2) return `<p class="muted small" style="margin:0">Trage mindestens zwei Werte ein, dann siehst du hier deinen Verlauf.</p>`;
  const W = 340, H = 150, padL = 34, padB = 20, top = 10;
  const vals = points.map((p) => p.v).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, 2); lo -= span * 0.15; hi += span * 0.15;
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime() || t0 + 1;
  const x = (d) => padL + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - padL - 8);
  const y = (v) => top + (H - padB - top) * (1 - (v - lo) / (hi - lo));
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const last = points[points.length - 1];
  const dl = (d) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 4}" y="${y(t) + 3}" text-anchor="end">${fmt1(t)}</text>`).join("")}
    ${goal != null ? `<line class="goal" x1="${padL}" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>` : ""}
    <path class="area" d="${path} L${x(last.date)},${H - padB} L${padL},${H - padB} Z"/>
    <path class="line" d="${path}"/>
    <circle class="dot" cx="${x(last.date)}" cy="${y(last.v)}" r="4.5"/>
    <text x="${padL}" y="${H - 4}">${dl(points[0].date)}</text><text x="${W - 4}" y="${H - 4}" text-anchor="end">${dl(last.date)}</text>
  </svg>`;
}

function rangeDays() {
  const today = todayKey();
  return Array.from({ length: range }, (_, i) => {
    const k = shiftDay(today, i - range + 1);
    const t = dayTotals(k);
    const d = new Date(k + "T12:00:00");
    return { key: k, t, kcal: t.kcal || 0, goal: goalFor(k).kcal, label: range <= 7 ? d.toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2) : d.getDate() + "." };
  });
}

function summaryText(days) {
  const logged = days.filter((d) => d.t.count);
  const avg = (k) => logged.reduce((s, d) => s + (d.t[k] || 0), 0) / Math.max(1, logged.length);
  const g = goalFor(todayKey());
  return `Ziel: ${g.kcal} kcal, ${g.protein} g Eiweiß, ${g.carbs} g KH, ${g.fat} g Fett, ${g.water} ml Wasser. Ziel: ${state.profile.goal === "lose" ? "abnehmen" : state.profile.goal === "gain" ? "zunehmen" : "halten"}.
Eingetragene Tage: ${logged.length} von ${days.length}.
Durchschnitt pro Tag: ${fmt(avg("kcal"))} kcal, ${fmt(avg("protein"))} g Eiweiß, ${fmt(avg("carbs"))} g KH, ${fmt(avg("fat"))} g Fett, ${fmt(avg("sugar"))} g Zucker, ${fmt(avg("fiber"))} g Ballaststoffe, ${fmt(avg("water"))} ml Wasser.
Gewicht: ${fmt1(latestWeight())} kg (Start ${fmt1(state.profile.startWeight)}, Ziel ${fmt1(state.profile.goalWeight)}).`;
}

export function render(root) {
  const days = rangeDays();
  const logged = days.filter((d) => d.t.count);
  const avg = (k) => logged.reduce((s, d) => s + (d.t[k] || 0), 0) / Math.max(1, logged.length);
  const inGoal = logged.filter((d) => d.kcal <= d.goal * 1.05 && d.kcal >= d.goal * 0.8).length;
  const mk = avg("carbs") * 4 + avg("protein") * 4 + avg("fat") * 9 || 1;
  const split = [["carbs", "Kohlenhydrate", avg("carbs") * 4 / mk], ["protein", "Eiweiß", avg("protein") * 4 / mk], ["fat", "Fett", avg("fat") * 9 / mk]];
  const weights = state.weights.filter((w) => w.date >= shiftDay(todayKey(), -Math.max(range, 30)));
  const p = state.profile;
  const w = latestWeight();
  const lost = p.startWeight - w;
  const toGo = Math.abs(w - p.goalWeight);
  const b = bmi();
  const bodyPts = state.body.filter((e) => e[bodyMetric] != null).map((e) => ({ date: e.date, v: e[bodyMetric] }));
  const lastBody = Object.fromEntries(BODY.map((m) => [m.k, [...state.body].reverse().find((e) => e[m.k] != null)?.[m.k]]));
  const micros = NUTRIENTS.filter((n) => n.group === "vit" || n.group === "min").map((n) => ({ n, v: avg(n.k) })).filter((x) => x.v > 0);

  root.innerHTML = `
    <header class="page-head"><h1>Verlauf</h1></header>
    <div class="seg">${[7, 30, 90].map((r) => `<button class="${r === range ? "on" : ""}" data-range="${r}">${r} Tage</button>`).join("")}</div>

    <div class="stat-grid">
      <div class="stat"><small>Ø Kalorien</small><b class="num">${fmt(avg("kcal"))}</b></div>
      <div class="stat"><small>Ø Eiweiß</small><b class="num">${fmt(avg("protein"))}<small> g</small></b></div>
      <div class="stat"><small>Im Zielbereich</small><b class="num">${inGoal}<small>/${logged.length}</small></b></div>
    </div>

    <section class="card">
      <div class="card-head"><h3>Kalorien</h3><div class="legend"><span><i style="background:var(--brand)"></i>im Ziel</span><span><i style="background:var(--danger)"></i>darüber</span><span><i style="background:var(--accent)"></i>Ziel</span></div></div>
      ${barChart(days)}
    </section>

    <section class="card">
      <div class="card-head"><h3>Makro-Verteilung</h3><span class="muted small">Ø der eingetragenen Tage</span></div>
      <div class="split-bar">${split.map(([k, , v]) => `<i style="width:${(v * 100).toFixed(1)}%;background:var(--${k})"></i>`).join("")}</div>
      <div class="legend" style="margin-top:10px">${split.map(([k, l, v]) => `<span><i style="background:var(--${k})"></i>${l} ${fmt(v * 100)} % <span class="muted">(Ziel ${state.goals[k + "Pct"]} %)</span></span>`).join("")}</div>
    </section>

    <section class="card">
      <div class="card-head"><h3>Gewicht</h3><button class="link" data-w>+ Eintragen</button></div>
      <div class="stat-grid" style="margin-bottom:10px">
        <div class="stat" style="box-shadow:none;background:var(--surface-2)"><small>Aktuell</small><b class="num">${fmt1(w)}<small> kg</small></b></div>
        <div class="stat" style="box-shadow:none;background:var(--surface-2)"><small>${lost >= 0 ? "Abgenommen" : "Zugenommen"}</small><b class="num">${fmt1(Math.abs(lost))}<small> kg</small></b></div>
        <div class="stat" style="box-shadow:none;background:var(--surface-2)"><small>Bis zum Ziel</small><b class="num">${fmt1(toGo)}<small> kg</small></b></div>
      </div>
      ${lineChart(weights.map((x) => ({ date: x.date, v: x.kg })), p.goalWeight)}
      <p class="muted small" style="margin:8px 0 0">BMI ${fmt1(b)} · ${b < 18.5 ? "Untergewicht" : b < 25 ? "Normalgewicht" : b < 30 ? "Übergewicht" : "Adipositas"} (BMI ist ein grober Richtwert und berücksichtigt keine Muskelmasse.)</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>Körpermaße</h3><button class="link" data-body>+ Messen</button></div>
      <div class="chips" style="margin-bottom:10px">${BODY.map((m) => `<button class="chip ${m.k === bodyMetric ? "on" : ""}" data-bm="${m.k}">${m.label}${lastBody[m.k] != null ? ` · ${fmt1(lastBody[m.k])} ${m.unit}` : ""}</button>`).join("")}</div>
      ${lineChart(bodyPts, null)}
    </section>

    <section class="card">
      <div class="card-head"><h3>Vitamine & Mineralstoffe</h3><span class="muted small">Ø pro Tag</span></div>
      ${micros.length ? `<div class="micro-list">${micros.map(({ n, v }) => {
        const pct = (v / n.ref) * 100;
        return `<div class="micro"><span>${n.label}</span><div class="bar ${pct >= 100 ? "" : "water"}"><i style="width:${Math.min(100, pct)}%"></i></div><b class="num">${fmt(pct)} %</b></div>`;
      }).join("")}</div><p class="muted small" style="margin:10px 0 0">Nur aus Lebensmitteln mit Angaben zu Mikronährstoffen – bei vielen Produkten fehlen diese, der echte Wert ist meist höher.</p>`
      : `<p class="muted small" style="margin:0">Sobald du Lebensmittel mit Vitaminangaben einträgst (z. B. Obst, Gemüse, Grundnahrungsmittel), erscheint hier deine Versorgung.</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h3>Dein Coach</h3><span class="pro-badge">PRO</span></div>
      <div data-coach>${localCoach(days)}</div>
      ${aiReady() ? `<button class="btn block" data-ai style="margin-top:10px">${icon("sparkle")} Persönliche KI-Auswertung</button>` : ""}
    </section>`;

  root.querySelectorAll("[data-range]").forEach((b) => (b.onclick = () => { range = +b.dataset.range; render(root); }));
  root.querySelectorAll("[data-bm]").forEach((b) => (b.onclick = () => { bodyMetric = b.dataset.bm; render(root); }));
  root.querySelector("[data-w]").onclick = () => weightSheet();
  root.querySelector("[data-body]").onclick = bodySheet;
  root.querySelector("[data-ai]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = "Werte deine Daten aus …";
    try {
      const txt = await coachAdvice(summaryText(days));
      root.querySelector("[data-coach]").innerHTML = `<p class="coach">${esc(txt)}</p>`;
      btn.remove();
    } catch (err) { toast(err.message); btn.disabled = false; btn.innerHTML = `${icon("sparkle")} Persönliche KI-Auswertung`; }
  });
}

function localCoach(days) {
  const logged = days.filter((d) => d.t.count);
  if (logged.length < 2) return `<p class="muted small" style="margin:0">Trag ein paar Tage lang ein, was du isst – dann bekommst du hier Auswertungen und Tipps.</p>`;
  const avg = (k) => logged.reduce((s, d) => s + (d.t[k] || 0), 0) / logged.length;
  const g = goalFor(todayKey());
  const out = [];
  const diff = avg("kcal") - g.kcal;
  if (Math.abs(diff) < g.kcal * 0.07) out.push(["check", "Kalorien im Ziel", `Im Schnitt ${fmt(avg("kcal"))} kcal – genau richtig. Weiter so!`]);
  else if (diff > 0) out.push(["flame", "Etwas über dem Ziel", `Im Schnitt ${fmt(diff)} kcal über dem Ziel. Oft stecken die Extras in Getränken, Soßen und Snacks.`]);
  else out.push(["bulb", "Unter dem Ziel", `Im Schnitt ${fmt(-diff)} kcal unter dem Ziel. Zu wenig zu essen macht Heißhunger – iss ruhig bis zu deinem Ziel.`]);
  out.push(avg("protein") >= g.protein * 0.9
    ? ["bolt", "Eiweiß passt", `${fmt(avg("protein"))} g pro Tag – das hält satt und schützt die Muskeln.`]
    : ["bolt", "Mehr Eiweiß", `Ø ${fmt(avg("protein"))} von ${g.protein} g. Eine Portion Skyr, Quark oder Hülsenfrüchte am Tag schließt die Lücke.`]);
  if (avg("water") < g.water * 0.7) out.push(["drop", "Trinken nicht vergessen", `Ø ${fmt1(avg("water") / 1000)} l pro Tag. Ziel: ${fmt1(g.water / 1000)} l.`]);
  if (avg("fiber") > 0 && avg("fiber") < 20) out.push(["apple", "Ballaststoffe", `Ø ${fmt(avg("fiber"))} g – Ziel sind etwa 30 g. Vollkorn und Gemüse helfen.`]);
  out.push(["heart", "Dranbleiben", `Du hast an ${logged.length} von ${days.length} Tagen eingetragen.`]);
  return out.slice(0, 4).map(([ic, h, t]) => `<div class="tip">${icon(ic)}<div><b>${h}</b><div class="muted small">${t}</div></div></div>`).join("");
}

function bodySheet() {
  const today = todayKey();
  const ex = state.body.find((e) => e.date === today) || {};
  return sheet({
    title: "Körpermaße",
    body: `<p class="muted small" style="margin:0">Leere Felder werden nicht gespeichert. Miss am besten morgens, immer an der gleichen Stelle.</p>
      <div class="grid2">${BODY.map((m) => `<label class="field"><span>${m.label} (${m.unit})</span><input class="input" data-k="${m.k}" type="number" inputmode="decimal" step="0.1" value="${ex[m.k] ?? ""}"></label>`).join("")}</div>
      <button class="btn primary block" data-ok>Speichern</button>`,
    onMount: (s, close) => (s.querySelector("[data-ok]").onclick = () => {
      const e = { date: today, id: ex.id || uid() };
      let any = false;
      s.querySelectorAll("[data-k]").forEach((i) => { if (i.value !== "") { e[i.dataset.k] = +i.value.replace(",", "."); any = true; } });
      if (!any) return close();
      state.body = state.body.filter((x) => x.date !== today).concat(e).sort((a, b) => a.date.localeCompare(b.date));
      commit(); toast("Gespeichert"); close();
    })
  });
}
