# Bundesliga Manager Hattrick – Remake

Ein Browser-Remake im Geist von *Bundesliga Manager Hattrick* (Software 2000,
1993): DOS-Retro-Look, drei Ligen, Stadionbau, Sponsoren, Transfermarkt und
Live-Spiele mit Eingriffsmöglichkeiten. Kein Server, kein Build: einfach
`index.html` im Browser öffnen (oder via GitHub Pages hosten).

## Features

### Ligen & Saison
- **3 Ligen**: 1. Bundesliga, 2. Bundesliga, 3. Liga – je 18 Vereine
- 34 Spieltage pro Liga (echter Round-Robin-Spielplan, Hin-/Rückrunde)
- **Auf- & Abstieg** (je 2 Plätze) am Saisonende mit Meldung
- Saisonübergang: Spieler altern, Karriereende, Jugendspieler rücken nach
- Spielstand wird automatisch gespeichert (localStorage)

### Spielbetrieb
- **Aufstellung**: 1 TW + 10 Feldspieler; Kader nach allen Spalten sortierbar
- **Taktik**: defensiv / normal / offensiv (auch LIVE im Match umschaltbar)
- **Live-Match** deines Spiels im ASCII-Spielfeld: Spielstand, Minute,
  Torschützen, Gelb-/Rote Karten, Verletzungen, Halbzeitpause
- **Eingreifen jederzeit**: Taktik wechseln, bis zu 3 Auswechslungen,
  Tempo beschleunigen oder Match sofort ausspielen; Gegner-KI wechselt selbst
- Form, Fitness, Skill-Entwicklung (Trainingseffekt), Alterung
- KI-Vereine rotieren ihre Aufstellung nach Fitness

### Wirtschaft
- **Stadionbau**: Kapazität ausbauen (+5k/+10k/+20k, 400 €/Platz),
  Dach bauen (+12% Einnahmen), Ticketeinnahmen je Liga, Wartungskosten
- **Sponsoren**: Vertrag, neue Angebote einholen und verhandeln
- **Transfermarkt**: freie Spieler kaufen (17 Angebote pro Spieltag)
- **Spielerverkauf** aus dem Kader an interessierte Vereine
- **Trainingslager** (1x pro Saison, Fitness +25/Form +1) und
  **Reha-Klinik** (Einzelspieler topfit, 100.000 €)
- Gehälter, Stadion-Unterhalt, Sponsorengelder pro Spieltag

## Spielanleitung
1. Beim ersten Start Liga und Verein per Klick wählen.
2. **Kader**: Startelf prüfen (Klick auf Spalten sortiert).
3. **Transfers/Stadion/Sponsoren/Training** nach Bedarf.
4. **▶ SPIELTAG**: dein Match läuft live – Taktik/Wechsel jederzeit möglich.
5. Nach 34 Spieltagen: Saisonende mit Auf-/Abstieg, dann geht's weiter.

Neues Spiel: oben rechts **⟲ NEU** (löscht den Spielstand).

## Technik
| Datei | Aufgabe |
|---|---|
| `index.html` | Screens: Büro, Tabelle, Spielplan, Kader, Transfers, Stadion, Sponsoren, Training, Match |
| `css/style.css` | VGA-Retro-Look (Blau/Gelb, Doppelrahmen, ASCII-Spielfeld) |
| `js/data.js` | 3 Ligen à 18 Vereine, Namen, Positionen, Sponsoren |
| `js/engine.js` | Simulation: Spielpläne, Match-Engine (KI + Live), Finanzen, Auf-/Abstieg |
| `js/ui.js` | Views, Live-Match-Orchestrierung, localStorage |

Vereinsnamen sind reine Text-Labels (keine Logos/Assets), alle Spieler
zufällig generiert – kein Marken-Asset, nur der Retro-Geist des Originals.

Viel Erfolg auf der Trainerbank!
