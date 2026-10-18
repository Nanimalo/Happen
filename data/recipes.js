// Mitgelieferte Rezepte. Zutaten verweisen auf data/basics.js (id, Gramm).
// Nährwerte werden automatisch berechnet. Neues Rezept = neuer Block.
export const BUILTIN_RECIPES = [
  {
    id: "overnight-oats", name: "Overnight Oats mit Beeren", servings: 1, minutes: 5, tags: ["Frühstück", "Vegetarisch"],
    ingredients: [["haferflocken", 50], ["skyr", 150], ["milch15", 100], ["heidelbeeren", 80], ["chia", 10], ["honig", 8]],
    steps: ["Haferflocken, Chiasamen, Skyr und Milch in einem Glas verrühren.", "Über Nacht in den Kühlschrank stellen.", "Morgens mit Heidelbeeren und Honig toppen."]
  },
  {
    id: "ruehrei-toast", name: "Rührei auf Vollkornbrot", servings: 1, minutes: 10, tags: ["Frühstück", "High Protein"],
    ingredients: [["ei", 110], ["vollkornbrot", 50], ["tomate", 100], ["butter", 5], ["spinat", 40]],
    steps: ["Butter in der Pfanne schmelzen, Spinat kurz andünsten.", "Eier verquirlen, dazugeben und bei mittlerer Hitze stocken lassen.", "Auf dem Brot mit Tomatenscheiben servieren."]
  },
  {
    id: "haehnchen-bowl", name: "Hähnchen-Reis-Bowl", servings: 2, minutes: 25, tags: ["Mittagessen", "High Protein"],
    ingredients: [["haehnchen", 300], ["reis", 400], ["brokkoli", 300], ["paprika", 160], ["olivenoel", 10]],
    steps: ["Reis nach Packungsangabe kochen.", "Hähnchen in Streifen schneiden und im Öl goldbraun braten, salzen und pfeffern.", "Brokkoli dämpfen, Paprika in Streifen schneiden.", "Alles auf zwei Schüsseln verteilen."]
  },
  {
    id: "linsen-curry", name: "Rotes Linsencurry", servings: 3, minutes: 30, tags: ["Abendessen", "Vegan"],
    ingredients: [["linsen", 450], ["kartoffeln", 300], ["zwiebel", 80], ["tomate", 300], ["spinat", 100], ["rapsoel", 10], ["reis", 450]],
    steps: ["Zwiebel würfeln und im Öl glasig dünsten, mit Currypulver bestäuben.", "Kartoffelwürfel, Tomaten und Linsen zugeben, mit Wasser bedecken und 20 Minuten köcheln.", "Spinat unterheben, abschmecken und mit Reis servieren."]
  },
  {
    id: "lachs-ofen", name: "Ofenlachs mit Süßkartoffel", servings: 2, minutes: 35, tags: ["Abendessen", "Omega-3"],
    ingredients: [["lachs", 250], ["suesskartoffel", 400], ["zucchini", 250], ["olivenoel", 15], ["zitrone", 40]],
    steps: ["Ofen auf 200 °C vorheizen. Süßkartoffel in Spalten schneiden, mit Öl mischen, 15 Minuten backen.", "Zucchini und Lachs dazulegen, mit Zitrone beträufeln.", "Weitere 15 Minuten backen."]
  },
  {
    id: "griechischer-salat", name: "Griechischer Salat", servings: 2, minutes: 10, tags: ["Mittagessen", "Vegetarisch", "Low Carb"],
    ingredients: [["gurke", 200], ["tomate", 300], ["paprika", 160], ["zwiebel", 40], ["feta", 100], ["olivenoel", 15]],
    steps: ["Gemüse in mundgerechte Stücke schneiden.", "Feta zerbröckeln und darübergeben.", "Mit Olivenöl, Salz, Pfeffer und Oregano anmachen."]
  },
  {
    id: "quark-bowl", name: "Proteinquark mit Obst", servings: 1, minutes: 3, tags: ["Snack", "High Protein"],
    ingredients: [["magerquark", 250], ["banane", 120], ["mandeln", 15], ["milch15", 50]],
    steps: ["Quark mit Milch glatt rühren.", "Banane in Scheiben schneiden und darauf verteilen.", "Mit gehackten Mandeln bestreuen."]
  },
  {
    id: "pasta-tomate", name: "Pasta mit Tomaten-Hack-Soße", servings: 3, minutes: 25, tags: ["Abendessen"],
    ingredients: [["nudeln-roh", 300], ["rinderhack", 300], ["tomate", 400], ["zwiebel", 80], ["karotte", 80], ["olivenoel", 10]],
    steps: ["Nudeln kochen.", "Zwiebel und Karotte fein würfeln, im Öl anschwitzen, Hack krümelig braten.", "Tomaten zugeben, 15 Minuten köcheln, würzen.", "Mit den Nudeln vermengen."]
  }
];
