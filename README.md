# Bundesliga Manager – Browser Edition

Ein Fußballmanager im Stil von *Bundesliga Manager Hattrick* (Software 2000,
1993) – komplett im Browser spielbar. Kein Server, kein Build, keine
Abhängigkeiten: einfach `index.html` im Browser öffnen (oder z. B. über
GitHub Pages hosten).

## Features

- **Alle 18 Vereine** mit individuellen Kaderbudgets – du wählst deinen Club
- **34 Spieltage** mit echtem Round-Robin-Spielplan (Hin- und Rückrunde)
- **Aufstellung**: 1 Torwart + 10 Feldspieler, frei kombinierbar,
  Kader nach allen Spalten sortierbar (Klick auf Spaltenköpfe)
- **Taktik**: Defensive / Normal / Offensive (wirkt auf Chancenverteilung)
- **Transfermarkt**: 14 Spieler pro Spieltag, freie Agenten kaufen;
  Ablöse steckt in deinem Budget
- **Live-Spiel deines Matches** mit Spielfeld-Overlay (grün = dein Team, rot = Gegner):
  Spielverlauf Minute für Minute, Tore mit Schützen, Gelb-/Rote Karten,
  Verletzungen, Halbzeitpause – und du kannst **eingreifen**:
  Taktik live ändern, bis zu 3 Auswechslungen, Tempo beschleunigen oder
  das Spiel sofort abspielen lassen. Der Gegner wechselt automatisch.
- **Live-Ticker** mit allen Ergebnissen und Torschützen des Spieltags
- **Tabelle** mit CL-Plätzen (grün) und Abstiegszone (rot), dein Team
  wird hervorgehoben
- **Spielerentwicklung**: Form, Fitness, Skill (Training), Alterung,
  Karriereende ab ~35
- **Finanzen**: Stadioneinnahmen, Wochenbudget, Spielergehälter
- **Saisonübergang**: Sommerpause mit Alterung, Neuzugängen (Jugendspieler),
  neuem Spielplan, Platzierung wird gemeldet
- **Autosave** im Browser (localStorage) – Spielstand überlebt Reload

## Spielanleitung

1. Beim ersten Start Verein auswählen (z. B. *Hannover 96*).
2. Ansicht **Kader**: gewünschte Spieler per Button in die Startelf nehmen
   (1 TW + 10 Feldspieler = 11).
3. Ansicht **Transfermarkt**: Budget prüfen und Spieler kaufen.
4. Ansicht **Taktik**: Spielweise wählen.
5. Solange **▶ Spieltag spielen** drücken und in der **Tabelle** den
   Fortschritt verfolgen.

Neues Spiel: oben rechts **⟲ Neu** klicken (löscht den Spielstand).

## Technik

| Datei | Aufgabe |
|---|---|
| `index.html` | Struktur, Views (Büro, Tabelle, Spielplan, Kader, Transfers, Taktik) |
| `css/style.css` | Retro-Look (Monospace, Bundesliga-Rot/Gold) |
| `js/data.js` | Vereinsdaten, Namen, Positionen |
| `js/engine.js` | Simulations-Kern: Spielplan (Round-Robin), Match-Engine, Finanzen, Training, Transfers, Saisons |
| `js/ui.js` | Rendering, Navigation, Aktionen, localStorage-Speicherung |

Primär für den Browser entwickelt; die Engine (`js/engine.js`) läuft
entscheidungsfrei auch unter Node.js und wurde mit
`node --check` sowie kompletten Saison-Simulations-Läufen getestet.

## Hinweise

- Vereinsnamen sind als reine Text-Labels enthalten (keine Logos, keine
  Spielerrechte – alle Spieler sind zufällig generiert).
- Keine echten Marken-Assets, keine Namensrechts-Verletzung beabsichtigt;
  ein Themenableger lässt sich über `js/data.js` in eine Minute umbauen.

Viel Erfolg auf der Trainerbank!
