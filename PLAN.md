# Blauwasser GM Tool — Implementierungsplan

Offline-first PWA für Spielleitung einer D&D-Kampagne auf einem iPad (kein Internet am Spielort). Einzelnutzer, ein Gerät im Spielbetrieb, Pflege der Datenbasis zusätzlich am PC. Dieses Dokument ist die verbindliche Spezifikation für die Umsetzung.

---

## 1. Ziele & Nicht-Ziele

**Ziele**
- Vollständig offline lauffähig (Boot ohne Netz), installierbar als PWA
- Canvas-zentrierte Bedienung: eine große navigierbare Fläche als Home, darin Karten, Encounter, Quests, NPCs, Gruppen
- Event-Sourcing als Fundament: jede Änderung ist ein Event, Historie & Time-Travel sind Kernfeature, kein Anbau
- JSON-Import/Export als Austauschformat für kollaborative Vorbereitung (KI liefert Encounter-/NPC-/Quest-Pakete, SL importiert)
- Touch-first UI (Finger, einhändig, dunkler Modus als Standard)

**Nicht-Ziele (bewusst ausgeschlossen)**
- Kein Mehrbenutzerbetrieb, kein Live-Sync zwischen Geräten
- Kein Würfeln, keine Spieler-HP-Verwaltung (Spieler tracken selbst)
- Keine Karten-Kalibrierung beim Bildtausch (Bild muss deckungsgleich eingefügt werden)
- Kein Löschen von Events — nur Korrektur-Events

---

## 2. Tech-Stack & Constraints

| Bereich | Entscheidung |
|---|---|
| Build | Vite, statisches Build-Verzeichnis, deploybar via GitHub Pages oder Datei-Kopie |
| UI | React + TypeScript |
| State | Redux Toolkit, zwei getrennte Slices-Gruppen: Game-State (event-sourced, persistiert) und Navigation-State (Session-flüchtig, grob persistiert für Restore) |
| Persistenz | IndexedDB (Event-Log, Snapshots, Assets als Blobs). `navigator.storage.persist()` beim Start anfordern |
| Canvas/Karte | SVG mit Pointer Events, eigene Pan/Zoom-Implementierung (kein Leaflet) |
| PWA | Service Worker + Manifest, Vollbild-Modus |
| Versionierung Projekt | Git (Code + exportierte JSON-Stände als committete Dateien) |
| Sprache | Code, Event-Typen, Schema-Felder: Englisch. Inhalte (Namen, Texte, Kommentare): Deutsch |

**Zielgerät-Warnung:** iPad Air 11" (M3). Alle Browser auf iPadOS nutzen WebKit — auch Chrome. Es wird faktisch gegen Safari/WebKit entwickelt und getestet. PWA-Installation über Safari ("Zum Home-Bildschirm"). Safari-Eigenheiten bei IndexedDB-Quota und Touch-Events (Pinch-Zoom der Seite unterbinden, `touch-action` sauber setzen) von Anfang an berücksichtigen. Sekundär: Desktop-Chrome am PC für Datenpflege.

---

## 3. Datenmodell

### 3.1 Grundprinzip: Event-Sourcing

- **Nichts ändert den Game-State direkt.** Jede Mutation ist ein Event: `{ id, campaignId, type, payload, realTime, gameTime, sessionId }`
- Events werden **sofort beim Entstehen** in IndexedDB geschrieben (kein Speichern-Button, kein ungespeicherter Zustand außer offenen Eingabefeldern)
- Aktueller State = Replay des Event-Logs (bzw. letzter Snapshot + Events danach)
- **Korrekturen:** Events werden nie gelöscht. `event.revoked` / `event.amended` referenzieren das Original; die State-Berechnung rechnet Korrekturen ein, die Timeline zeigt sie optional an
- **Snapshots:** periodisch (an Sessionsgrenzen) wird der berechnete State als Snapshot gespeichert. App-Start: letzter Snapshot + nachfolgende Events. Format von Anfang an vorsehen

### 3.2 Zwei getrennte Historien

1. **Event-History** (Spielgeschehen): persistiert, versioniert, Undo via Korrektur-Events, kontextbezogen (Undo im Encounter wirkt auf letzte Aktion dort)
2. **Navigations-History** (Viewport, Zoom, geöffnete Elemente): Stack von Viewport-Zuständen, Session-flüchtig, mit Schrittwahl navigierbar (wie Browser-Verlauf mit Dropdown). Letzter Zustand wird grob persistiert, damit ein Neustart im richtigen Kontext landet. Peek im Sidepanel verändert den Viewport nicht und landet nicht im Stack

### 3.3 Entitäten

Alle Verknüpfungen über IDs, n:m wo angegeben. Frische UUIDs bei Neuanlage und in Import-Paketen.

- **Campaign** — komplett eigener Namespace (eigene IndexedDB-Datenbank oder Namespace pro Kampagne), eigener Event-Log. Kampagnen-Wähler als Einstiegsbildschirm. Enthält die globale **Spielwelt-Uhr**: aktueller In-Game-Tag + Tageszeit (morgens/mittags/abends/nachts)
- **Area** — hierarchisch (parentId), z. B. Übersicht → Westliche Bucht → Stadt/Hafen → Taverne. Hat: Zone auf der Elternkarte ODER eigene Karte(n), Zoomschwellwert, konfigurierbares Badge (welche Infos nach oben durchgereicht werden: Questmarker, Encounter-Anzahl, Freitext — pro Bereich per Häkchen steuerbar)
- **MapImage** — Asset (Blob), gehört zu einer Area. Positionen darauf werden **normalisiert (0–1) bzw. als Grid-Koordinate** gespeichert, nie in Pixeln
- **Marker** — gehört zu einer Area, hat Position, Typ, Verknüpfungen (Encounter, NPC, Quest). Darstellung abhängig vom Zustand des Verknüpften (vorbereitet = hohl/gestrichelt, erlebt = gefüllt → Gedächtnispunkt)
- **Encounter** — Name, Beschreibung/Atmosphäre, verknüpfte Battlemap(s) (öffnen direkt aus dem Encounter), Gegnerliste, Zustand (`prepared` / `active` / `completed`), Abschluss-Kommentar (Gedächtnispunkt-Text), optional Marker-Verknüpfung. **Random-Pool:** Encounter ohne Ort leben in einem Pool und erhalten erst beim Einspeisen eine Position
- **Enemy** — Teil der Encounter-Vorbereitung: Name, Max-HP, aktuelle HP, Statuseffekte, tot/kampfunfähig-Flag. Bei gleichartigen Gruppen ("4 Piraten"): siehe offene Detailfrage in §8
- **Quest** — Status `open` / `active` / `completed`, Bauchgefühl-Fortschritt als Freitext (z. B. "1/3"), Kommentare, verknüpfte NPCs (n:m), verknüpfte Marker/Areas/Encounter
- **NPC** — eigenständige Entität: Name, Beschreibung, Heimat-Location (Area/Marker), verlinkbar an Marker **und** Quests gleichzeitig (n:m). Sidepanel zeigt rückwärts alle Vorkommen
- **Character** — Name, Klasse, Rasse, Level, Max-HP, Statuseffekte (freie Tags mit Vorschlagsliste: unconscious, prone, poisoned, …). Sheet-Versionen: Liste von PDF-Assets, Zeiger auf das aktive; Upload = Event, kein Löschen, nur Deaktivieren
- **Group** — Mitgliedschaft als Events (`character.joinedGroup` / `character.leftGroup`) → historische Gruppenkonstellation stimmt beim Zurückspulen. Neue Gruppen jederzeit erstellbar. Positions-Historie der Gruppe = Events; Reiselinie auf der Karte = gezeichnete Verbindung der Positionen, mit Tagesangabe pro Wegpunkt
- **Session** — Events `session.started` / `session.ended`; History nach Sessions filterbar, Snapshots an Sessionsgrenzen
- **Asset** — Blobs (Kartenbilder, Battlemaps, Sheet-PDFs). Bilder beim Import automatisch auf sinnvolle Maximalgröße skalieren. Speicheranzeige in den Einstellungen

### 3.4 Spielwelt-Uhr (global)

- Kampagnenweiter aktueller Tag + Tageszeit, sichtbar in der Kopfleiste, Weiter-Button + direkte Tagwahl für Zeitsprünge
- **Jedes entstehende Event bekommt automatisch den aktuellen Spielwelt-Zeitstempel angeheftet** (zusätzlich zur Realzeit)
- Weiterstellen ist selbst ein Event (`world.dayAdvanced`) → versioniert und korrigierbar; Korrektur-Event kann betroffenen Events rückwirkend den richtigen Tag zuordnen
- Karten-History-Zeitregler hat zwei Modi: nach Session blättern / nach Spielwelt-Tag blättern (beides Filter auf denselben Log)

---

## 4. UI-Konzept

### 4.1 Canvas (Home)

- Große Pan/Zoom-Fläche, Vogelperspektive: Karten, Encounter-Kacheln, Random-Pool, Quest-Karten, Gruppen-/Charakter-Panel (einklappbar)
- **Semantisches Zoomen:** Bereiche blättern sich beim Reinzoomen auf (Zoomschwellwert), verdichten sich beim Rauszoomen zum konfigurierten Badge
- **Grid-Overlay** über Karten (Buchstabe+Zahl, z. B. F7), per Toggle ein/aus — gemeinsame Referenzsprache für Vorbereitung
- Pinch-Zoom/Pan mit zwei Fingern nur aufs Canvas wirken lassen, nie auf die Seite

### 4.2 Marker-Interaktion & Sidepanel

- Tipp auf Marker → generisches **Sidepanel** (Peek): zeigt Detailansicht von beliebigen Entitäten (Marker, Encounter, NPC, Gruppe, Quest) mit Name, Status, Kommentaren, letzten Events, Rückverweisen
- Aktion **"Goto"** im Panel → animierter Zoom auf Bereich/Marker (dieser Sprung landet im Navigationsstack, das Peeken nicht)

### 4.3 Navigation

- Verschachtelte Ebenen (Canvas → Gruppe → Mitglied → Sheet; Karte → Marker → Encounter)
- Zurück-Leiste oben bietet mehrere Ebenen gleichzeitig an ("← Gruppe | ← Karte | ← Übersicht") aus dem Navigationsstack
- Navigations-Undo mit Schrittwahl, getrennt vom Spiel-Undo

### 4.4 Kampfmodus

- Kampfzustand ist **Zustand des Encounters**, nicht global → mehrere parallel aktive Kämpfe möglich, Wechsel per Navigation, "Wer ist dran"-Marker lebt pro Kampf
- "Kampf starten" → Event + reduzierter Screen:
  - Initiative-Liste, vorbefüllt mit Gruppenmitgliedern + vorbereiteten Gegnern; gewürfelte Werte manuell eintippen, Liste sortiert sich selbst
  - Nachträgliches Hinzufügen spontaner Gegner mit einem Tipp
  - Gegner: HP-Zähler (antippen, Schaden eingeben), bei 0 automatisch tot/kampfunfähig (durchgestrichen, rutscht nach unten, bleibt in der Liste, Marker umschaltbar)
  - Statuseffekte als Tags an jedem Eintrag (Spieler wie Gegner)
  - "Wer ist dran"-Marker mit Weiterschalten, Rundenzähler zählt automatisch pro Durchlauf
- "Kampf beenden" → Kommentarfeld (Zusammenfassung) → Encounter wird Gedächtnispunkt; Kampfverlauf steckt automatisch in den Events und wird mit archiviert

### 4.5 Ergonomie

- Dunkler Modus als Standard, große Touch-Ziele, Wichtiges einhändig erreichbar
- Vollbild via PWA (keine Browserleiste)

---

## 5. Import/Export & Backup

- **Exportformat: ZIP** = `campaign.json` (Event-Log + Entitäten, vollständig) + Assets. Export ist immer der komplette Log → Backup = vollständige Kopie inkl. Historie; Import auf anderem Gerät = identischer Stand
- **Teilexport/-import** für einzelne Pakete (z. B. NPCs der nördlichen Stadt in andere Kampagne übernehmen)
- **Import ist additiv** und selbst nur ein Batch von Events. ID-Kollision → Konfliktdialog (nie stumm überschreiben). Gelieferte Pakete verwenden frische IDs für Neues und referenzieren Bestehendes nur per ID
- **Auto-Snapshots** in IndexedDB an Sessionsgrenzen (benannte Sicherungspunkte)
- Workflow: Session beendet → Export → Git-Commit (JSON-Stand im Repo) → Backup mit Historie außerhalb des Tablets; PC und iPad synchronisieren über Repo/Datei-Import
- Das JSON-Schema wird als TypeScript-Typen definiert und dient gleichzeitig als Doku für das Austauschformat (KI-gestützte Vorbereitung: Encounter mit Grid-Position, Gegnerliste inkl. HP, NPCs, Quests als fertiges Paket)

---

## 6. Meilensteine

**M1 — Fundament (zuerst!)**
1. TypeScript-Typen: alle Entitäten + Event-Format + Austauschformat (= Doku)
2. Vite-Projekt, Redux Toolkit-Grundgerüst (Game-Slice event-sourced, Nav-Slice getrennt)
3. IndexedDB-Anbindung: Event-Append sofort persistent, Replay beim Start, Snapshot-Format vorgesehen
4. Kampagnen-Wähler (mehrere Namespaces)

**M2 — Canvas & Karte**
5. SVG-Canvas mit Pan/Zoom, Touch-Gesten (WebKit-getestet)
6. Kartenbild-Import (Blob, Skalierung), Marker setzen/verschieben, normalisierte Koordinaten
7. Grid-Overlay mit Toggle
8. Sidepanel (Peek) + Goto + Navigationsstack mit Zurück-Leiste

**M3 — Entitäten & Verknüpfungen**
9. Areas mit Hierarchie, Zoomschwellwerten, Badges (semantisches Zoomen)
10. Encounter (inkl. Random-Pool, Battlemap-Verknüpfung), Quests, NPCs mit n:m-Links und Rückverweisen
11. Characters/Groups inkl. Sheet-Upload (PDF-Anzeige, Versionen, aktives Sheet), Gruppen-Events, Reiselinie

**M4 — Spielbetrieb**
12. Kampfmodus komplett (§4.4)
13. Spielwelt-Uhr + automatisches Anheften an Events + History-Zeitregler (Session/Tag)
14. Sessions, Korrektur-Events, kontextbezogenes Undo

**M5 — Rundum**
15. Import/Export (ZIP), Konfliktdialog, Teilimport
16. PWA (Manifest, Service Worker, storage.persist), dunkles Theme, Ergonomie-Feinschliff
17. Snapshots automatisiert, Speicheranzeige

Nach M2 gibt es bereits etwas Anfassbares auf dem iPad; jeder Meilenstein endet lauffähig.

---

## 7. Edge Cases (verbindlich abgedeckt)

1. Parallele Kämpfe → Kampfzustand pro Encounter (§4.4)
2. Tablet geht aus / Browser gekillt → sofortige Event-Persistenz + Nav-Restore (§3.1, §3.2)
3. PWA + `navigator.storage.persist()` gegen Datenverlust; Export bleibt echtes Backup (§5)
4. Fehleingaben in der Vergangenheit → Korrektur-Events (§3.1)
5. Kartenbild-Tausch → normalisierte Koordinaten überleben deckungsgleiche Bilder; keine Kalibrierung (bewusst)
6. Import-Konflikte → additiv, ID-Prüfung, Konfliktdialog (§5)
7. Speicher → Bild-Downscaling beim Import, Speicheranzeige
8. Langer Event-Log → Snapshot + Log-Rest reicht (ältere Sessions müssen nicht auf dem Tablet abrufbar sein)

---

## 8. Offene Detailfrage (bei Implementierung entscheiden)

- Gleichartige Gegner ("4 Piraten"): ein Sammeleintrag mit gemeinsamer Initiative und vier HP-Balken **oder** vier einzelne Einträge. Empfehlung: Datenmodell so bauen, dass ein Enemy-Eintrag `count > 1` mit individuellen HP-Slots haben kann und die Initiative wahlweise geteilt wird — dann sind beide Spielstile abgedeckt.
