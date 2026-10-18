// Aktivitäten mit MET-Wert (Energieumsatz-Faktor). kcal = MET × kg × Stunden
export const ACTIVITIES = [
  { id: "walk", name: "Spazieren gehen", met: 3.5 },
  { id: "walk-fast", name: "Zügiges Gehen", met: 4.8 },
  { id: "run-8", name: "Joggen (8 km/h)", met: 8.3 },
  { id: "run-10", name: "Laufen (10 km/h)", met: 9.8 },
  { id: "bike", name: "Radfahren (gemütlich)", met: 5.8 },
  { id: "bike-fast", name: "Radfahren (zügig)", met: 8 },
  { id: "swim", name: "Schwimmen", met: 6 },
  { id: "gym", name: "Krafttraining", met: 5 },
  { id: "hiit", name: "HIIT / Zirkeltraining", met: 8 },
  { id: "yoga", name: "Yoga", met: 2.5 },
  { id: "dance", name: "Tanzen", met: 5 },
  { id: "football", name: "Fußball", met: 7 },
  { id: "basketball", name: "Basketball", met: 6.5 },
  { id: "tennis", name: "Tennis", met: 7.3 },
  { id: "hike", name: "Wandern", met: 6 },
  { id: "climb", name: "Bouldern / Klettern", met: 7.5 },
  { id: "garden", name: "Gartenarbeit", met: 3.8 },
  { id: "clean", name: "Hausputz", met: 3.3 },
  { id: "stairs", name: "Treppensteigen", met: 8.8 },
  { id: "skate", name: "Inlineskaten", met: 7.5 }
];
// Schritte -> kcal (grobe Näherung, abhängig vom Körpergewicht)
export const stepsKcal = (steps, kg) => Math.round(steps * 0.0005 * kg);
