# Happen – Kalorienzähler als Handy-App

Happen ist eine installierbare Web-App (PWA). Sie läuft auf iPhone und Android, liegt wie eine normale App auf dem Startbildschirm, funktioniert offline und braucht keinen App Store.

## Funktionen

**Grundfunktionen**
- Ernährungstagebuch mit Frühstück, Mittag, Abend, Snacks, Kalorienring und Makros
- Barcode- & QR-Scanner über die Kamera (plus Foto wählen oder Nummer eintippen)
- Live-Produktdatenbank: Open Food Facts mit über 3 Mio. Produkten, jede Suche fragt den aktuellen Stand ab
- Rund 100 Grundnahrungsmittel ohne Barcode (Obst, Gemüse, Brot, Fleisch …)
- Favoriten, zuletzt gegessen, „Wie gestern“, Mahlzeiten speichern und kopieren
- Wasser, Gewicht, Aktivitäten und Schritte

**Alle Pro-Funktionen**
- Foto-Erkennung von Mahlzeiten per KI
- Intervallfasten mit Plänen (12:12 bis 23:1), Live-Timer, Phasen und Verlauf
- Rezepte (8 mitgeliefert) und eigener Rezept-Baukasten mit automatischer Nährwertberechnung
- Detaillierte Nährwerte: Zucker, Ballaststoffe, gesättigte Fette, Salz, 16 Vitamine & Mineralstoffe
- Körpermaße (Körperfett, Muskeln, Taille, Hüfte …) mit Verlauf
- Eigene Kalorien- und Makroziele, Ernährungsformen (Low Carb, High Protein …)
- Statistiken über 7/30/90 Tage, Makro-Verteilung, Coach mit Tipps (optional KI-Auswertung)
- Keine Werbung, Export als CSV und Sicherung

**Extra-Ideen**
- Nutri-Score, NOVA-Verarbeitungsgrad und Allergene beim Produkt
- Nährwerttabelle abfotografieren, wenn ein Produkt fehlt (KI liest die Werte)
- Flexible Wochenenden (unter der Woche etwas weniger, am Wochenende mehr)
- Wochenstreifen und Serien-Zähler, Hell-/Dunkelmodus, offline nutzbar

---

## 1. Online stellen (einmalig, kostenlos, ca. 10 Minuten)

Die Kamera funktioniert im Handy-Browser nur auf einer **https**-Adresse. Am einfachsten mit **GitHub Pages**:

1. Konto auf **github.com** anlegen.
2. Oben rechts **+ → New repository**, Name z. B. `happen`, auf **Public** stellen, **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken.
4. Den **Inhalt** des entpackten Ordners `happen` hineinziehen (also `index.html`, `sw.js`, die Ordner `css`, `js`, `data`, `icons` …, nicht den Ordner selbst). Unten **Commit changes**.
5. Im Repository **Settings → Pages**: bei *Branch* `main` und `/ (root)` wählen, **Save**.
6. Nach ein bis zwei Minuten steht oben die Adresse, z. B. `https://deinname.github.io/happen/`.

Alternative ohne Konto-Einrichtung: **app.netlify.com/drop** öffnen und den Ordner `happen` ins Fenster ziehen. Für Updates ist GitHub aber bequemer.

## 2. Aufs Handy installieren

- **iPhone:** Adresse in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**.
- **Android:** Adresse in **Chrome** öffnen → Menü **⋮** → **App installieren**.

Beim ersten Scannen fragt das Handy nach der Kamera-Erlaubnis.

## 3. Updates einspielen

1. Geänderte Dateien bei GitHub hochladen (**Add file → Upload files**, gleiche Namen überschreiben).
2. In `version.js` die Nummer erhöhen, z. B. `1.0.0` → `1.0.1`.
3. Beim nächsten Öffnen erscheint in der App „Neue Version verfügbar → Jetzt aktualisieren“. Die Daten der Nutzer bleiben erhalten.

Wenn du eine **neue Datei** anlegst, trag sie zusätzlich in die Liste in `sw.js` ein, damit sie offline verfügbar ist.

## Projektaufbau

| Datei / Ordner | Inhalt |
|---|---|
| `version.js` | Versionsnummer – bei jedem Update erhöhen |
| `css/app.css` | Design; Farben ganz oben als Variablen |
| `js/app.js` | Start, Navigation, Update-Hinweis |
| `js/store.js` | Datenspeicher auf dem Gerät, Migrationen für neue Felder |
| `js/nutrition.js` | Bedarf, Ziele, Nährstoffliste |
| `js/off.js` | Anbindung an die Produktdatenbank |
| `js/scanner.js` | Kamera-Scanner |
| `js/ai.js` | KI-Funktionen (optional) |
| `js/views/` | Die einzelnen Seiten (Tagebuch, Fasten, Rezepte, Verlauf, Profil …) |
| `data/` | Grundnahrungsmittel, Aktivitäten, mitgelieferte Rezepte – einfach erweiterbar |

## KI-Funktionen

Foto-Erkennung, Nährwerttabelle lesen und die KI-Auswertung nutzen die Claude-API. Jede Person hinterlegt unter **Profil → KI-Funktionen** einen eigenen API-Schlüssel von console.anthropic.com. Der Schlüssel bleibt auf dem Gerät. Ohne Schlüssel funktioniert alles andere ganz normal.

## Daten & Datenschutz

Alle Einträge liegen nur im Speicher des Handys. Unter **Profil → Sicherung speichern** lässt sich eine Sicherungsdatei erstellen, z. B. für einen Handywechsel. Produktdaten: © Open Food Facts, Open Database License.

Happen ersetzt keine ärztliche Beratung.
