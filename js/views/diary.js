// Tagebuch: Tagesübersicht, Mahlzeiten, Wasser, Aktivitäten
import { state, ui, MEALS, day, peekDay, commit, todayKey, shiftDay, removeEntry, addEntry, uid, latestWeight, setWeight } from "../store.js";
import { goalFor, dayTotals, sumEntries, entryValues, fmt, fmt1 } from "../nutrition.js";
import { icon, esc, ring, bar, sheet, toast, dateLabel, foodThumb, ask } from "../ui.js";
import { openAdd } from "./add.js";
import { openEntry } from "./product.js";
import { ACTIVITIES, stepsKcal } from "../../data/activities.js";

export function streak() {
  let n = 0, k = todayKey();
  if (!dayTotals(k).count) k = shiftDay(k, -1);
  while (dayTotals(k).count) { n++; k = shiftDay(k, -1); }
  return n;
}

function tips(key, t, g) {
  const out = [];
  const h = new Date().getHours();
  const isToday = key === todayKey();
  if (!t.count) return out;
  if (t.protein < g.protein * 0.6 && (!isToday || h >= 17)) out.push(["bolt", "Eiweiß fehlt noch", `Noch ${fmt(g.protein - t.protein)} g bis zum Ziel. Quark, Skyr, Eier, Linsen oder Hähnchen helfen.`]);
  if ((t.water || 0) < g.water * 0.5 && (!isToday || h >= 14)) out.push(["drop", "Mehr trinken", `Erst ${fmt1((t.water || 0) / 1000)} von ${fmt1(g.water / 1000)} Litern. Stell dir ein Glas Wasser in Sichtweite.`]);
  if ((t.sugar || 0) > 50) out.push(["flame", "Viel Zucker heute", `${fmt(t.sugar)} g Zucker – die WHO empfiehlt höchstens 50 g am Tag.`]);
  if (t.fiber != null && t.fiber < 15 && (!isToday || h >= 18)) out.push(["apple", "Ballaststoffe", `${fmt(t.fiber)} g von 30 g. Vollkorn, Hülsenfrüchte, Gemüse und Beeren bringen viel davon.`]);
  if (t.kcal > g.kcal * 1.15) out.push(["heart", "Über dem Ziel", "Kein Problem – ein Tag ändert nichts. Morgen ist ein neuer Tag."]);
  return out.slice(0, 2);
}

export function render(root) {
  const key = ui.date;
  const today = todayKey();
  const g = goalFor(key);
  const t = dayTotals(key);
  const d = peekDay(key);
  const burned = state.settings.addBurned === false ? 0 : t.burned;
  const budget = g.kcal + burned;
  const eaten = t.kcal || 0;
  const left = Math.round(budget - eaten);
  const st = streak();
  const initial = (state.profile.name || "?").trim()[0]?.toUpperCase() || "?";

  // Wochenstreifen
  const weekStart = shiftDay(key, -((new Date(key + "T12:00:00").getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));

  root.innerHTML = `
    <header class="page-head">
      <div class="date-nav">
        <button class="icon-btn" data-day="-1" aria-label="Vorheriger Tag">${icon("left")}</button>
        <button class="date" data-today>${dateLabel(key, today)}<span class="sub">${new Date(key + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</span></button>
        <button class="icon-btn" data-day="1" aria-label="Nächster Tag">${icon("right")}</button>
      </div>
      <a class="avatar" href="#profile" aria-label="Profil">${esc(initial)}</a>
    </header>

    <div class="week-strip" role="group" aria-label="Woche">
      ${week.map((k) => {
        const tt = dayTotals(k), gg = goalFor(k);
        const p = tt.kcal ? Math.min(1, tt.kcal / gg.kcal) : 0;
        return `<button class="wd ${k === key ? "on" : ""} ${k === today ? "today" : ""} ${tt.kcal > gg.kcal * 1.05 ? "over" : ""}" data-go="${k}">
          <small>${new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "narrow" })}</small>
          <span style="--p:${p}"><b>${new Date(k + "T12:00:00").getDate()}</b></span></button>`;
      }).join("")}
    </div>

    <section class="card">
      <div class="summary">
        <div class="side"><b class="num">${fmt(eaten)}</b><span>Gegessen</span></div>
        <div class="ring-box">
          ${ring(eaten, budget, { size: 168, stroke: 13, over: left < 0 })}
          <div class="center"><b class="num">${fmt(Math.abs(left))}</b><span>${left >= 0 ? "kcal übrig" : "kcal zu viel"}</span></div>
        </div>
        <div class="side"><b class="num">${fmt(t.burned)}</b><span>Verbrannt</span></div>
      </div>
      <div class="macros">
        ${[["carbs", "Kohlenhydrate"], ["protein", "Eiweiß"], ["fat", "Fett"]].map(([k, l]) => `
          <div class="macro"><small>${l}</small>${bar(t[k] || 0, g[k], k)}<div class="v num"><b>${fmt(t[k] || 0)}</b> / ${g[k]} g</div></div>`).join("")}
      </div>
      ${st > 1 ? `<p class="streak">${icon("flame")} <b>${st} Tage</b> in Folge eingetragen</p>` : ""}
    </section>

    ${MEALS.map((m) => {
      const list = d ? d.meals[m.id] : [];
      const s = sumEntries(list);
      const rec = Math.round(g.kcal * m.share);
      const y = peekDay(shiftDay(key, -1))?.meals[m.id] || [];
      return `<section class="card meal">
        <div class="meal-head">
          <span class="meal-ic">${icon(m.icon)}</span>
          <div class="t"><b>${m.label}</b><span class="num">${fmt(s.kcal || 0)} / ${fmt(rec)} kcal${list.length ? ` · KH ${fmt(s.carbs || 0)} · E ${fmt(s.protein || 0)} · F ${fmt(s.fat || 0)}` : ""}</span></div>
          ${list.length ? `<button class="icon-btn" data-mealmenu="${m.id}" aria-label="Optionen">${icon("copy")}</button>` : ""}
          <button class="add-btn" data-add="${m.id}" aria-label="${m.label} hinzufügen">${icon("plus")}</button>
        </div>
        ${list.length ? `<div class="entries">${list.map((e) => `
          <button class="entry" data-entry="${m.id}:${e.id}">
            ${foodThumb(e)}
            <span class="t"><b>${esc(e.name)}</b><span>${esc(e.brand ? e.brand + " · " : "")}${esc(e.amountLabel || fmt(e.grams) + " " + (e.unit || "g"))}</span></span>
            <span class="k num">${fmt(entryValues(e).kcal || 0)}</span>
          </button>`).join("")}</div>` : (y.length ? `<div class="meal-actions"><button class="chip" data-copyy="${m.id}">${icon("copy")} Wie gestern (${fmt(sumEntries(y).kcal || 0)} kcal)</button></div>` : "")}
      </section>`;
    }).join("")}

    <section class="card">
      <div class="card-head"><h3>Wasser</h3><span class="muted num">${fmt1((t.water || 0) / 1000)} / ${fmt1(g.water / 1000)} l</span></div>
      <div class="water-row">
        <div class="glasses">
          ${Array.from({ length: Math.max(Math.ceil(g.water / 250), Math.ceil((t.water || 0) / 250) + 1) }, (_, i) => {
            const full = i < Math.round((t.water || 0) / 250);
            const next = i === Math.round((t.water || 0) / 250);
            return `<button class="glass ${full ? "full" : ""} ${next ? "next" : ""}" data-glass="${i}" aria-label="${(i + 1) * 250} ml"></button>`;
          }).join("")}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h3>Aktivitäten</h3><button class="link" data-act>+ Hinzufügen</button></div>
      ${d && d.activities.length ? `<div class="list">${d.activities.map((a) => `
        <div class="item"><span class="meal-ic">${icon("run")}</span><span class="t"><b>${esc(a.name)}</b><span>${a.min ? a.min + " Min." : ""}${a.steps ? fmt(a.steps) + " Schritte" : ""}</span></span>
        <span class="k num">${fmt(a.kcal)} kcal</span><button class="icon-btn" data-delact="${a.id}" aria-label="Entfernen">${icon("trash")}</button></div>`).join("")}</div>`
        : `<p class="muted small" style="margin:0">Sport, Spaziergänge oder Schritte eintragen – die verbrannten Kalorien kommen zu deinem Tagesbudget dazu.</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h3>Gewicht</h3><button class="link" data-weight>Eintragen</button></div>
      <div class="weight-line"><b class="num">${fmt1(latestWeight())} kg</b><span class="muted">Ziel ${fmt1(state.profile.goalWeight)} kg</span></div>
    </section>

    ${tips(key, t, g).map(([ic, h, txt]) => `<section class="card tip-card"><div class="tip">${icon(ic)}<div><b>${h}</b><div class="muted small">${txt}</div></div></div></section>`).join("")}
  `;

  root.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { ui.date = shiftDay(ui.date, +b.dataset.day); render(root); }));
  root.querySelector("[data-today]").onclick = () => { ui.date = todayKey(); render(root); };
  root.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { ui.date = b.dataset.go; render(root); }));
  root.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => openAdd(b.dataset.add, key)));
  root.querySelectorAll("[data-entry]").forEach((b) => (b.onclick = () => {
    const [meal, id] = b.dataset.entry.split(":");
    const e = day(key).meals[meal].find((x) => x.id === id);
    if (e) openEntry(e, key, meal);
  }));
  root.querySelectorAll("[data-copyy]").forEach((b) => (b.onclick = () => {
    const m = b.dataset.copyy;
    const src = peekDay(shiftDay(key, -1)).meals[m];
    src.forEach(({ id, at, ...rest }) => day(key).meals[m].push({ ...rest, id: uid(), at: Date.now() }));
    commit();
    toast(`${src.length} Einträge übernommen`);
  }));
  root.querySelectorAll("[data-mealmenu]").forEach((b) => (b.onclick = () => mealMenu(key, b.dataset.mealmenu)));
  root.querySelectorAll("[data-glass]").forEach((b) => (b.onclick = () => {
    const i = +b.dataset.glass;
    const dd = day(key);
    const filled = Math.round(dd.water / 250);
    dd.water = i < filled ? i * 250 : (i + 1) * 250;
    if (dd.water > 0 && dd.water >= g.water && filled * 250 < g.water) toast("Trinkziel erreicht!");
    commit();
  }));
  root.querySelector("[data-act]").onclick = () => addActivity(key);
  root.querySelectorAll("[data-delact]").forEach((b) => (b.onclick = () => {
    const dd = day(key);
    dd.activities = dd.activities.filter((a) => a.id !== b.dataset.delact);
    commit();
  }));
  root.querySelector("[data-weight]").onclick = () => weightSheet(key);
}

function mealMenu(key, meal) {
  const label = MEALS.find((m) => m.id === meal).label;
  sheet({
    title: label,
    body: `<div class="list">
      <button class="menu-item" data-a="save">${icon("bookmark")}<span>Als Mahlzeit speichern</span></button>
      <button class="menu-item" data-a="tomorrow">${icon("copy")}<span>Nach morgen kopieren</span></button>
      <button class="menu-item" data-a="clear">${icon("trash")}<span>Alle Einträge löschen</span></button>
    </div>`,
    onMount: (s, close) => {
      s.querySelector('[data-a="save"]').onclick = async () => {
        close();
        const name = await sheet({
          title: "Mahlzeit speichern",
          body: `<label class="field"><span>Name</span><input class="input" id="sm-name" value="Mein ${esc(label)}"></label><button class="btn primary block" data-ok>Speichern</button>`,
          onMount: (s2, c2) => { const i = s2.querySelector("#sm-name"); i.select(); s2.querySelector("[data-ok]").onclick = () => c2(i.value.trim()); }
        });
        if (!name) return;
        const id = uid();
        state.savedMeals[id] = { id, name, items: day(key).meals[meal].map(({ id: _i, at, ...r }) => r) };
        commit();
        toast("Mahlzeit gespeichert – findest du beim Hinzufügen unter „Eigene“");
      };
      s.querySelector('[data-a="tomorrow"]').onclick = () => {
        const nk = shiftDay(key, 1);
        day(key).meals[meal].forEach(({ id, at, ...r }) => day(nk).meals[meal].push({ ...r, id: uid(), at: Date.now() }));
        commit(); close(); toast("Nach morgen kopiert");
      };
      s.querySelector('[data-a="clear"]').onclick = async () => {
        close();
        if (await ask("Alle Einträge löschen?", `${label} wird für diesen Tag geleert.`, "Löschen", true)) {
          const backup = [...day(key).meals[meal]];
          day(key).meals[meal] = [];
          commit();
          toast("Gelöscht", { label: "Rückgängig", run: () => { day(key).meals[meal] = backup; commit(); } });
        }
      };
    }
  });
}

function addActivity(key) {
  const kg = latestWeight();
  sheet({
    title: "Aktivität hinzufügen",
    full: true,
    body: `
      <div class="card form">
        <h3>Schritte</h3>
        <div class="grid2"><input class="input" id="steps" type="number" inputmode="numeric" placeholder="z. B. 8000"><button class="btn primary" data-steps>Eintragen</button></div>
      </div>
      <label class="field"><span>Dauer in Minuten</span><input class="input" id="act-min" type="number" inputmode="numeric" value="30"></label>
      <div class="list card">${ACTIVITIES.map((a) => `<button class="item" data-a="${a.id}"><span class="t"><b>${a.name}</b><span class="num">ca. ${fmt(a.met * kg * 0.5)} kcal in 30 Min.</span></span>${icon("plus")}</button>`).join("")}</div>
      <div class="card form"><h3>Eigene Aktivität</h3>
        <div class="grid2"><input class="input" id="own-name" placeholder="Name"><input class="input" id="own-kcal" type="number" inputmode="numeric" placeholder="kcal"></div>
        <button class="btn block" data-own>Hinzufügen</button></div>`,
    onMount: (s, close) => {
      const push = (a) => { day(key).activities.push({ id: uid(), ...a }); commit(); toast(`${a.name}: ${fmt(a.kcal)} kcal`); close(); };
      s.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
        const a = ACTIVITIES.find((x) => x.id === b.dataset.a);
        const min = Math.max(1, +s.querySelector("#act-min").value || 30);
        push({ name: a.name, min, kcal: Math.round(a.met * kg * (min / 60)) });
      }));
      s.querySelector("[data-steps]").onclick = () => {
        const n = +s.querySelector("#steps").value;
        if (n > 0) push({ name: "Schritte", steps: n, kcal: stepsKcal(n, kg) });
      };
      s.querySelector("[data-own]").onclick = () => {
        const n = s.querySelector("#own-name").value.trim(), k = +s.querySelector("#own-kcal").value;
        if (n && k > 0) push({ name: n, kcal: Math.round(k) });
      };
    }
  });
}

export function weightSheet(key = todayKey()) {
  const cur = state.weights.find((w) => w.date === key)?.kg ?? latestWeight();
  return sheet({
    title: "Gewicht eintragen",
    body: `<p class="muted small" style="margin:0;text-align:center">${dateLabel(key, todayKey())}</p>
      <div class="stepper" style="max-width:260px;margin:0 auto">
        <button data-d="-0.1" aria-label="weniger">${icon("minus")}</button>
        <input id="w-in" type="number" inputmode="decimal" step="0.1" value="${cur}">
        <button data-d="0.1" aria-label="mehr">${icon("plus")}</button>
      </div>
      <p class="muted small" style="text-align:center;margin:0">kg</p>
      <button class="btn primary block" data-ok>Speichern</button>`,
    onMount: (s, close) => {
      const i = s.querySelector("#w-in");
      s.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => (i.value = (Math.round((+i.value + +b.dataset.d) * 10) / 10).toFixed(1))));
      s.querySelector("[data-ok]").onclick = () => {
        const v = +String(i.value).replace(",", ".");
        if (v >= 30 && v <= 350) { setWeight(key, Math.round(v * 10) / 10); toast("Gewicht gespeichert"); close(); }
      };
    }
  });
}

// für andere Ansichten
export { addEntry, removeEntry };
