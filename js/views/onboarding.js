// Ersteinrichtung: Ziel, Körperdaten, Aktivität -> Kalorienziel
import { state, setWeight, todayKey, replaceAll } from "../store.js";
import { goalFor, ACTIVITY_LEVELS, fmt, bmi } from "../nutrition.js";
import { esc, toast } from "../ui.js";

export function runOnboarding() {
  return new Promise((resolve) => {
    const root = document.getElementById("view");
    const p = state.profile;
    let step = 0;
    const steps = ["welcome", "goal", "body", "target", "activity", "result"];

    const go = (n) => {
      const dir = n > step ? 1 : -1;
      step = n;
      if (steps[step] === "target" && p.goal === "keep") step += dir;
      draw();
    };

    function draw() {
      const s = steps[step];
      const pct = Math.round((step / (steps.length - 1)) * 100);
      let body = "", next = "Weiter", nextOk = true;
      if (s === "welcome") {
        root.innerHTML = `<div class="ob">
          <div class="ob-brand">Happen<span>.</span></div>
          <div class="body">
            <h2>Iss bewusst. Bissen für Bissen.</h2>
            <p class="muted">Kalorien zählen mit Barcode-Scanner, einer Datenbank mit Millionen aktueller Produkte, Fasten-Timer, Rezepten und Foto-Erkennung. Alles kostenlos, alles freigeschaltet, deine Daten bleiben auf deinem Handy.</p>
          </div>
          <button class="btn primary block" data-next>Los geht's</button>
          <label class="btn ghost block">Sicherung wiederherstellen<input type="file" accept="application/json,.json" hidden data-restore></label>
        </div>`;
        root.querySelector("[data-next]").onclick = () => go(1);
        root.querySelector("[data-restore]").onchange = async (e) => {
          try {
            const data = JSON.parse(await e.target.files[0].text());
            replaceAll(data);
            state.profile.onboarded = true;
            toast("Sicherung wiederhergestellt");
            resolve();
          } catch { toast("Diese Datei ist keine gültige Happen-Sicherung"); }
        };
        return;
      }
      if (s === "goal") {
        body = `<h2>Was ist dein Ziel?</h2>
          ${[["lose", "Abnehmen", "Gesund und dauerhaft Gewicht verlieren"], ["keep", "Gewicht halten", "Bewusster essen, Gewicht stabil halten"], ["gain", "Zunehmen", "Muskeln aufbauen oder Gewicht zulegen"]]
            .map(([v, t, d]) => `<button class="choice ${p.goal === v ? "on" : ""}" data-goal="${v}"><b>${t}</b><span>${d}</span></button>`).join("")}`;
      }
      if (s === "body") {
        body = `<h2>Ein paar Eckdaten</h2>
          <p class="muted small">Damit berechnen wir deinen Grundumsatz (Mifflin-St-Jeor-Formel).</p>
          <div class="seg" role="group" aria-label="Geschlecht">
            <button data-sex="f" class="${p.sex === "f" ? "on" : ""}">Weiblich</button><button data-sex="m" class="${p.sex === "m" ? "on" : ""}">Männlich</button>
          </div>
          <div class="grid2">
            <label class="field"><span>Geburtsjahr</span><input class="input" id="ob-year" type="number" inputmode="numeric" value="${p.birthYear}"></label>
            <label class="field"><span>Größe (cm)</span><input class="input" id="ob-height" type="number" inputmode="numeric" value="${p.heightCm}"></label>
          </div>
          <label class="field"><span>Aktuelles Gewicht (kg)</span><input class="input" id="ob-weight" type="number" inputmode="decimal" step="0.1" value="${p.startWeight}"></label>`;
      }
      if (s === "target") {
        const goalBmi = p.goalWeight / (p.heightCm / 100) ** 2;
        const unhealthy = p.goal === "lose" && goalBmi < 18.5;
        nextOk = !unhealthy && !(p.goal === "lose" && p.goalWeight >= p.startWeight) && !(p.goal === "gain" && p.goalWeight <= p.startWeight);
        body = `<h2>${p.goal === "lose" ? "Wie viel möchtest du wiegen?" : "Dein Zielgewicht"}</h2>
          <label class="field"><span>Wunschgewicht (kg)</span><input class="input" id="ob-goalw" type="number" inputmode="decimal" step="0.1" value="${p.goalWeight}"></label>
          <div class="notice warn" data-tw ${unhealthy || !nextOk ? "" : "hidden"}>${unhealthy ? "Dieses Gewicht läge unter dem gesunden Bereich (BMI unter 18,5). Wähle bitte ein höheres Ziel." : `Das Wunschgewicht sollte ${p.goal === "lose" ? "unter" : "über"} deinem aktuellen Gewicht liegen.`}</div>
          <span class="section-label">Tempo pro Woche</span>
          ${[[0.25, "Entspannt", "0,25 kg pro Woche – leicht durchzuhalten"], [0.5, "Empfohlen", "0,5 kg pro Woche – spürbar, aber gesund"]]
            .map(([v, t, d]) => `<button class="choice ${p.pace === v ? "on" : ""}" data-pace="${v}"><b>${t}</b><span>${d}</span></button>`).join("")}`;
      }
      if (s === "activity") {
        body = `<h2>Wie aktiv ist dein Alltag?</h2>
          ${ACTIVITY_LEVELS.map((a) => `<button class="choice ${p.activity === a.v ? "on" : ""}" data-act="${a.v}"><b>${a.label}</b><span>${a.hint}</span></button>`).join("")}`;
      }
      if (s === "result") {
        const g = goalFor(todayKey());
        const weeks = p.goal === "keep" ? 0 : Math.ceil(Math.abs(p.startWeight - p.goalWeight) / p.pace);
        const when = new Date(Date.now() + weeks * 7 * 864e5).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
        next = "Starten";
        body = `<h2>Dein Plan steht${p.name ? ", " + esc(p.name) : ""}.</h2>
          <div class="card" style="text-align:center">
            <small class="muted">Tägliches Kalorienziel</small>
            <div class="result-kcal num">${fmt(g.kcal)}</div>
            <small class="muted">kcal</small>
            <div class="macros">
              <div class="macro"><small>Kohlenhydrate</small><b class="num">${g.carbs} g</b></div>
              <div class="macro"><small>Eiweiß</small><b class="num">${g.protein} g</b></div>
              <div class="macro"><small>Fett</small><b class="num">${g.fat} g</b></div>
            </div>
          </div>
          ${weeks ? `<p class="muted">Bei diesem Tempo erreichst du ${fmt(p.goalWeight, 1)} kg voraussichtlich im <b style="color:var(--ink)">${when}</b>.</p>` : ""}
          <label class="field"><span>Wie dürfen wir dich nennen? (optional)</span><input class="input" id="ob-name" value="${esc(p.name)}" autocomplete="given-name"></label>
          <p class="muted small">Alle Werte kannst du später unter Profil → Ziele anpassen.</p>`;
      }
      root.innerHTML = `<div class="ob">
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="body">${body}</div>
        <div class="row-btns"><button class="btn ghost" data-back>Zurück</button><button class="btn primary" data-next ${nextOk ? "" : "disabled"}>${next}</button></div>
      </div>`;
      bind();
    }

    function readInputs() {
      const v = (id) => root.querySelector("#" + id)?.value;
      if (v("ob-year")) p.birthYear = Math.min(new Date().getFullYear() - 10, Math.max(1920, +v("ob-year")));
      if (v("ob-height")) p.heightCm = Math.min(250, Math.max(120, +v("ob-height")));
      if (v("ob-weight")) p.startWeight = Math.min(350, Math.max(30, +String(v("ob-weight")).replace(",", ".")));
      if (v("ob-goalw")) p.goalWeight = Math.min(350, Math.max(30, +String(v("ob-goalw")).replace(",", ".")));
      if (root.querySelector("#ob-name")) p.name = v("ob-name").trim().slice(0, 30);
    }

    function bind() {
      root.querySelectorAll("[data-goal]").forEach((b) => (b.onclick = () => {
        p.goal = b.dataset.goal;
        if (p.goal === "keep") p.goalWeight = p.startWeight;
        if (p.goal === "lose" && p.goalWeight >= p.startWeight) p.goalWeight = Math.round(p.startWeight - 5);
        if (p.goal === "gain" && p.goalWeight <= p.startWeight) p.goalWeight = Math.round(p.startWeight + 4);
        draw();
      }));
      root.querySelectorAll("[data-sex]").forEach((b) => (b.onclick = () => { readInputs(); p.sex = b.dataset.sex; draw(); }));
      root.querySelectorAll("[data-pace]").forEach((b) => (b.onclick = () => { readInputs(); p.pace = +b.dataset.pace; draw(); }));
      root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => { p.activity = +b.dataset.act; draw(); }));
      root.querySelector("#ob-goalw")?.addEventListener("input", () => {
        readInputs();
        const unhealthy = p.goal === "lose" && p.goalWeight / (p.heightCm / 100) ** 2 < 18.5;
        const wrongDir = (p.goal === "lose" && p.goalWeight >= p.startWeight) || (p.goal === "gain" && p.goalWeight <= p.startWeight);
        const w = root.querySelector("[data-tw]");
        w.hidden = !(unhealthy || wrongDir);
        w.textContent = unhealthy ? "Dieses Gewicht läge unter dem gesunden Bereich (BMI unter 18,5). Wähle bitte ein höheres Ziel." : `Das Wunschgewicht sollte ${p.goal === "lose" ? "unter" : "über"} deinem aktuellen Gewicht liegen.`;
        root.querySelector("[data-next]").disabled = unhealthy || wrongDir;
      });
      root.querySelector("[data-back]").onclick = () => { readInputs(); go(Math.max(0, step - 1)); };
      root.querySelector("[data-next]").onclick = () => {
        readInputs();
        if (steps[step] === "body") {
          if (p.goal === "lose" && p.goalWeight >= p.startWeight) p.goalWeight = Math.round(p.startWeight - 5);
          if (p.goal === "lose" && bmi(p.startWeight) < 18.5) {
            p.goal = "keep"; p.goalWeight = p.startWeight;
            toast("Dein Gewicht ist schon im unteren Bereich – Ziel auf „Gewicht halten“ gesetzt");
          }
          if (p.goal === "keep") p.goalWeight = p.startWeight;
        }
        if (steps[step] === "result") {
          setWeight(todayKey(), p.startWeight);
          state.goals.waterMl = Math.min(3500, Math.max(1500, Math.round((p.startWeight * 33) / 250) * 250));
          resolve();
          return;
        }
        go(step + 1);
      };
    }
    draw();
  });
}
