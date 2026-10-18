// ============================================================
//  Barcode- & QR-Scanner über die Handykamera.
//  Android/Chrome: eingebauter BarcodeDetector (sehr schnell).
//  iPhone/andere oder wenn der eingebaute Scanner versagt:
//  ZXing-Bibliothek, wird bei Bedarf automatisch geladen.
// ============================================================
import { icon, esc } from "./ui.js";

const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js";
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];
const CAM_KEY = "happen.camera";

// ---------- ZXing (Ersatz-Scanner) ----------
let zxingPromise;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingPromise ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = ZXING_URL;
    s.onload = () => (window.ZXing ? res(window.ZXing) : rej(new Error("Scanner-Bibliothek fehlerhaft geladen.")));
    s.onerror = () => { zxingPromise = null; rej(new Error("Ersatz-Scanner konnte nicht geladen werden (offline?).")); };
    document.head.appendChild(s);
  });
  return zxingPromise;
}

let zx = null;
async function zxingDecoder() {
  if (zx) return zx;
  const Z = await loadZXing();
  const F = Z.BarcodeFormat;
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.QR_CODE]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // source: Video, Bild oder Canvas. crop: nur mittleren Bereich nehmen. rotate: 90° drehen
  zx = (source, { crop = true, maxW = 1000, rotate = false } = {}) => {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return null;
    const cw = crop ? Math.round(sw * 0.9) : sw, ch = crop ? Math.round(sh * 0.6) : sh;
    const scale = Math.min(1, maxW / Math.max(cw, ch));
    const w = Math.round(cw * scale), h = Math.round(ch * scale);
    canvas.width = rotate ? h : w; canvas.height = rotate ? w : h;
    ctx.save();
    if (rotate) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    ctx.restore();
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lum = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, width, height)));
      const r = reader.decodeWithState(bmp);
      return { text: r.getText(), format: String(r.getBarcodeFormat()) };
    } catch { return null; } finally { try { reader.reset(); } catch {} }
  };
  return zx;
}

// ---------- Eingebauter Android-Scanner ----------
let nativeDet;
async function nativeDecoder() {
  if (nativeDet !== undefined) return nativeDet;
  nativeDet = null;
  if (!("BarcodeDetector" in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (!formats.includes("ean_13")) return null;
    const det = new window.BarcodeDetector({ formats });
    nativeDet = async (source) => {
      const r = await det.detect(source);
      return r[0] ? { text: r[0].rawValue, format: r[0].format } : null;
    };
  } catch { nativeDet = null; }
  return nativeDet;
}

// Standbild (Foto) gründlich auswerten: eingebaut, dann ZXing in mehreren Größen und gedreht
async function decodeStill(img) {
  const nat = await nativeDecoder();
  if (nat) { try { const r = await nat(img); if (r) return r; } catch {} }
  const z = await zxingDecoder();
  for (const maxW of [1600, 1100, 700]) for (const rotate of [false, true]) {
    const r = z(img, { crop: false, maxW, rotate });
    if (r) return r;
  }
  return null;
}

// GS1 Digital Link (neue QR-Codes auf Verpackungen) -> EAN herausziehen
export function toBarcode(text) {
  const t = String(text).trim();
  if (/^\d{8,14}$/.test(t)) return t.length === 14 && t.startsWith("0") ? t.slice(1) : t;
  const m = t.match(/\/01\/(\d{14})/);
  if (m) return m[1].startsWith("0") ? m[1].slice(1) : m[1];
  return null;
}

// Rückkameras finden. Hauptkamera ist bei Android meist "camera2 0".
async function backCameras() {
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  const back = devs.filter((d) => /back|rear|rück|environment|hinten/i.test(d.label));
  const list = back.length ? back : devs;
  const n = (l) => { const m = l.match(/(\d+)/); return m ? +m[1] : 99; };
  return list.sort((a, b) => n(a.label) - n(b.label));
}
const savedCam = () => { try { return localStorage.getItem(CAM_KEY); } catch { return null; } };
const saveCam = (id) => { try { localStorage.setItem(CAM_KEY, id); } catch {} };

// Öffnet den Scanner. Ergebnis: { code } | { text } | { manual: true } | null
export function scanBarcode({ title = "Barcode scannen" } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "scanner";
    el.innerHTML = `
      <video playsinline muted autoplay></video>
      <div class="scan-shade"><div class="scan-frame"><i></i></div></div>
      <header class="scan-top">
        <button type="button" class="icon-btn on-dark" data-x aria-label="Schließen">${icon("close")}</button>
        <strong>${esc(title)}</strong>
        <button type="button" class="icon-btn on-dark" data-torch aria-label="Licht" style="visibility:hidden">${icon("bolt")}</button>
      </header>
      <div class="scan-msg"><p data-msg>Strichcode waagerecht in den Rahmen halten, etwa 15 cm Abstand</p><small data-engine></small></div>
      <footer class="scan-bottom">
        <div class="scan-tools">
          <button type="button" class="btn small on-dark" data-cam hidden>${icon("camera")} <span>Kamera wechseln</span></button>
          <button type="button" class="btn small on-dark" data-zoom hidden>1×</button>
        </div>
        <label class="btn on-dark">${icon("camera")} Foto aufnehmen<input type="file" accept="image/*" capture="environment" hidden></label>
        <button type="button" class="btn on-dark" data-manual>${icon("keyboard")} Nummer eingeben</button>
      </footer>`;
    document.body.appendChild(el);
    document.body.classList.add("no-scroll");
    const video = el.querySelector("video");
    const msg = el.querySelector("[data-msg]");
    const engineLabel = el.querySelector("[data-engine]");
    let stream, track, running = true, last = null, hits = 0;
    let cams = [], camIndex = 0, startedAt = Date.now(), hinted = false;
    let nativeErrors = 0, useNative = false, frame = 0, zxReady = null;

    const finish = (val) => {
      running = false;
      stream?.getTracks().forEach((t) => t.stop());
      el.classList.add("closing");
      setTimeout(() => { el.remove(); document.body.classList.remove("no-scroll"); }, 180);
      resolve(val);
    };
    const found = (r) => {
      if (!running) return;
      navigator.vibrate?.(60);
      el.classList.add("hit");
      const code = toBarcode(r.text);
      setTimeout(() => finish(code ? { code } : { text: r.text }), 160);
    };
    const setEngine = () => { engineLabel.textContent = "Erkennung: " + (useNative ? (zxReady ? "Android + Ersatz" : "Android") : "Ersatz-Scanner"); };

    el.querySelector("[data-x]").onclick = () => finish(null);
    el.querySelector("[data-manual]").onclick = () => finish({ manual: true });
    el.querySelector("input[type=file]").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      msg.textContent = "Foto wird ausgewertet …";
      try {
        const bmp = await createImageBitmap(file);
        const r = await decodeStill(bmp);
        if (r) found(r); else msg.textContent = "Kein Code im Foto gefunden. Fotografiere nur den Strichcode, scharf und formatfüllend.";
      } catch (err) { msg.textContent = err.message || "Foto konnte nicht gelesen werden."; }
      e.target.value = "";
    };

    async function openCamera(deviceId) {
      stream?.getTracks().forEach((t) => t.stop());
      const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size },
        audio: false
      });
      if (!running) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      const adv = [];
      if (caps.focusMode?.includes?.("continuous")) adv.push({ focusMode: "continuous" });
      if (adv.length) track.applyConstraints({ advanced: adv }).catch(() => {});

      const torch = el.querySelector("[data-torch]");
      torch.style.visibility = caps.torch ? "visible" : "hidden";
      torch.classList.remove("active");
      let on = false;
      torch.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); torch.classList.toggle("active", on); };

      // Zoom hilft, wenn die Kamera auf kurze Distanz nicht scharf stellt
      const zb = el.querySelector("[data-zoom]");
      const levels = caps.zoom ? [1, 1.5, 2, 3].filter((z) => z >= (caps.zoom.min || 1) && z <= caps.zoom.max) : [];
      zb.hidden = levels.length < 2;
      if (levels.length >= 2) {
        let zi = levels.includes(1.5) ? levels.indexOf(1.5) : 0;
        const apply = () => { track.applyConstraints({ advanced: [{ zoom: levels[zi] }] }).catch(() => {}); zb.textContent = String(levels[zi]).replace(".", ",") + "×"; };
        apply();
        zb.onclick = () => { zi = (zi + 1) % levels.length; apply(); };
      }
    }

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("nocam"), { name: "NotSupported" });
        const saved = savedCam();
        try { await openCamera(saved); } catch (e) { if (saved) await openCamera(null); else throw e; }
        if (!running) return;
        // Jetzt sind Kameranamen lesbar -> Hauptkamera wählen und Wechsel-Knopf anbieten
        cams = await backCameras().catch(() => []);
        const current = track.getSettings?.().deviceId;
        camIndex = Math.max(0, cams.findIndex((c) => c.deviceId === current));
        if (!saved && cams.length > 1 && cams[0].deviceId !== current) {
          try { await openCamera(cams[0].deviceId); camIndex = 0; } catch {}
        }
        const cb = el.querySelector("[data-cam]");
        if (cams.length > 1) {
          cb.hidden = false;
          const label = () => (cb.querySelector("span").textContent = `Kamera ${camIndex + 1}/${cams.length}`);
          label();
          cb.onclick = async () => {
            camIndex = (camIndex + 1) % cams.length;
            label();
            try { await openCamera(cams[camIndex].deviceId); saveCam(cams[camIndex].deviceId); startedAt = Date.now(); hinted = false; msg.textContent = "Kamera gewechselt – Strichcode in den Rahmen halten"; }
            catch { msg.textContent = "Diese Kamera lässt sich nicht öffnen. Tippe nochmal auf „Kamera wechseln“."; }
          };
        }
        useNative = !!(await nativeDecoder());
        if (!useNative) { msg.textContent = "Lade Scanner …"; await zxingDecoder(); zxReady = true; msg.textContent = "Strichcode waagerecht in den Rahmen halten, etwa 15 cm Abstand"; }
        setEngine();
      } catch (err) {
        const denied = err.name === "NotAllowedError" || err.name === "SecurityError";
        msg.textContent = denied
          ? "Kein Kamerazugriff. Erlaube die Kamera in den Browser-Einstellungen für diese Seite – oder nimm ein Foto auf bzw. gib die Nummer ein."
          : err.name === "NotSupported" ? "Dieses Gerät unterstützt keine Live-Kamera im Browser. Nimm ein Foto auf oder gib die Nummer ein."
          : err.name === "NotFoundError" ? "Keine Kamera gefunden. Nimm ein Foto auf oder gib die Nummer ein."
          : err.name === "NotReadableError" ? "Die Kamera wird gerade von einer anderen App benutzt. Schließe sie und versuch es erneut."
          : err.message || "Kamera konnte nicht gestartet werden.";
        el.classList.add("nocam");
        return;
      }

      const accept = (r) => {
        if (!r) return false;
        const qr = r.format?.toLowerCase().includes("qr");
        // Zweimal gleiches Ergebnis = sicher erkannt (QR-Codes haben eigene Prüfsummen)
        if (r.text === last || qr) hits++; else hits = 1;
        last = r.text;
        if (hits >= 2 || qr) { found(r); return true; }
        return false;
      };

      const loop = async () => {
        if (!running) return;
        frame++;
        if (video.readyState >= 2 && video.videoWidth) {
          const elapsed = Date.now() - startedAt;
          // Nach 5 s ohne Treffer zusätzlich den Ersatz-Scanner mitlaufen lassen
          if (useNative && !zxReady && elapsed > 5000 && zxReady !== false) {
            zxReady = false;
            zxingDecoder().then(() => { zxReady = true; setEngine(); }).catch(() => {});
          }
          try {
            if (useNative && (frame % 2 === 0 || !zxReady)) {
              try {
                if (accept(await nativeDet(video))) return;
                nativeErrors = 0;
              } catch {
                // Eingebauter Scanner nicht verfügbar -> dauerhaft auf Ersatz umschalten
                if (++nativeErrors >= 3) { useNative = false; msg.textContent = "Lade Ersatz-Scanner …"; await zxingDecoder(); zxReady = true; setEngine(); msg.textContent = "Strichcode waagerecht in den Rahmen halten"; }
              }
            } else if (zxReady) {
              if (accept(zx(video, { crop: true, maxW: 1000 }))) return;
            }
          } catch {}
          if (!hinted && elapsed > 8000) {
            hinted = true;
            msg.textContent = (cams.length > 1 ? "Unscharf? Tippe auf „Kamera wechseln“. " : "") + "Halte etwas mehr Abstand, sorg für Licht – oder nimm ein Foto auf.";
          }
        }
        setTimeout(loop, useNative ? 60 : 120);
      };
      loop();
    })();
  });
}

// Einfaches Foto aufnehmen (für die KI-Erkennung). Gibt ein Blob zurück.
export function takePhoto() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => resolve(input.files[0] || null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
