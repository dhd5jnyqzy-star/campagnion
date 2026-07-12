/**
 * Generator für das Blauwasser-ContentPackage (content/blauwasser-paket.json).
 *
 * Quelle: die fünf Vorbereitungs-PDFs (blauwasser.pdf, Encounter-Kompaktkarten,
 * Schiffsprüfungen, Cheatsheet, Überfahrtskarten) — vollständig transkribiert,
 * damit alles durchsuchbar, dunkelmodus-tauglich und auf dem Canvas platzierbar
 * ist. Ausführen:  node content/build-blauwasser.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Lesbare, eindeutige IDs (statt zufälliger UUIDs), damit das committete Paket
// diffbar bleibt; bei ID-Kollisionen greift ohnehin der Konfliktdialog.
const id = (slug) => `bw1-${slug}`;

const enemy = (slug, name, count, maxHp, extra = {}) => ({
  id: id(`en-${slug}`),
  name,
  count,
  maxHp,
  sharedInitiative: count > 1,
  slots: Array.from({ length: count }, () => ({ hp: maxHp, statusEffects: [], defeated: false })),
  ...extra,
});

// ---------------------------------------------------------------------------
// NSCs
// ---------------------------------------------------------------------------
const npc = (slug, name, description) => ({ id: id(`npc-${slug}`), name, description, comments: [] });

const npcs = [
  npc('brenna', 'Brenna Salzhand', 'Hafenmeisterin von Möwenhafen und Gerüchte-Drehscheibe. Vergibt die Öl-Quest: zwölf Fässer Leuchtfeueröl für drei Türme. Wichtig: Der Auftrag wird hier erteilt, aber das Öl lagert an den Wolfsklippen (Alter Wartturm).'),
  npc('alrik', 'Alrik Voss', 'Kaufmann in Möwenhafen — Agent des rätselhaften Gönners „R.". Drückt der Crew beiläufig den versiegelten Brief für Alva (Ringklippe) in die Hand: „eine alte Hafenschuld, geht euch nichts an." Nervös, verschweigt Details zur Kiste.'),
  npc('hanne', 'Hanne', 'Wirtin der „Grauen Möwe" in Möwenhafen. Seemannsgarn und Feature-Gerüchte — und die Aufhängerin der Wein-Nebenquest: erzählt vom legendären Sturmjahrgang, dessen letzte Fässer mit einem Schiff im Osten sanken.'),
  npc('corran', 'Corran', 'Versoffener Lotse in Möwenhafen. Faselt vom Riff — „da fährt keiner mehr". Kern des Riff-Gerüchts.'),
  npc('zwielicht', 'Zwielichtiger Kontakt', 'Namenloser Kontakt in Möwenhafen, der zu früh Interesse an „einer Kiste aus dem Osten" zeigt — Verbindung zum Messertrupp am Kai.'),
  npc('jarl', 'Jarl', 'Fallensteller am Klippenpfad der Wolfsklippen. Warnt vor dem Wolfsrudel und dem Braunbär; bestätigt, dass der Pfad frei und der Karren noch oben ist. Vom Alten Wartturm hält er sich fern.'),
  npc('tibbs', 'Old Tibbs', 'Wärter des Nordfeuers, dankbar für die Öl-Lieferung. Erzählt vom „Sand so weit das Auge reicht" im Osten, wo „etwas Wertvolles" liegen soll — der Keim der Fehlleitung (Sand-Trick). Warnt vor den Krabbenbänken.'),
  npc('maren', 'Maren Lichthüter', 'Wärterin des Klippenfeuers, dankbar fürs Öl. Verweist auf „den Kartenmann an der Ringklippe" (Alva) und warnt: Die Überfahrt nach Osten ist kein Kinderspiel — Nebel und ein Riff.'),
  npc('alva', 'Alva Rauk', 'Kartograph & Hehler an der Ringklippe — Kontaktperson für den Brief (Prüfung 1). Bei intaktem Siegel gibt er die schwarze Kiste, den zweiten Brief (für Marren) und die östliche Seekarte. Bei gebrochenem Siegel bleibt er freundlich, gibt die (scheinbar leere) Kiste — und merkt sich, wer zuerst nach dem Inhalt fragt. Hat Weinflaschen unter der Hand (Sturmjahrgang-Quelle).'),
  npc('perrin', 'Perrin', 'Verzauberter Matrose am Sirenenfels; befreibar. Nach der Rettung warnt er vor den „nassen Toten am Wrack" und dem Riff dahinter — und wird ein Verbündeter.'),
  npc('gwynn', 'Netz-Gwynn', 'Gestrandete Bergerin, haust auf einer Sandbank der östlichen Untiefe. Zeigt zum Wrack, erzählt von der Bergungsprämie in Osthafen und warnt vor Sahuagin, die über die Untiefen streifen.'),
  npc('nesa', 'Nesa Reet', 'Älteste der Klippendorf-Fischer. Die Fischer verlieren Boote an den Riffjäger — sie setzt das Kopfgeld auf den Riesenoktopus aus. Belohnung u. a. freie Bootsreparaturen und eine Perle aus dem Nest.'),
  npc('marren', 'Marren Voss', 'Werftmeister in Osthafen (alte Werft) — Kontakt B der Prüfung. Nimmt die schwarze Kiste entgegen, prüft Siegel und Scharniere und öffnet sie vor der Crew: die Übergabe der Morgenwind. Reagiert kühl, wenn das Siegel gebrochen oder gelogen wurde.'),
  npc('doran', 'Doran Kettel', 'Hafenmeister von Osthafen. Hat die Bergungsprämie fürs vermisste Ölboot ausgesetzt, bezahlt die dritte Öl-Lieferung ans Hafenfeuer und das Riffjäger-Kopfgeld. Bei ihm gibt es teuren Import-Wein (Nebenquest).'),
  npc('haldric', 'Reeder Haldric', 'Schiffseigner in Osthafen. Seine Frachter meiden das östliche Fahrwasser, seit der Meeresriese die Flussmündung hält — er setzt das Kopfgeld auf den Grottenhüter aus und zahlt für freie Durchfahrt (Erlegen oder Bestechung).'),
];

// ---------------------------------------------------------------------------
// Encounter (aus den Kompaktkarten, Statblocks transkribiert)
// ---------------------------------------------------------------------------
const encounter = (slug, name, description, enemies) => ({
  id: id(`enc-${slug}`),
  name,
  description,
  battlemapAssetIds: [],
  enemies,
});

const encounters = [
  encounter('krabben', 'Klippenkrabben',
`**Start:** Zwischen Felsen, Treibgut, Gezeitentümpeln — direkt an den Hafenpfählen von Möwenhafen. Der allererste Mini-Kampf, sanfter Einstieg.

**Riesenkrebs:** RK 15 · TP 13 · Bew 9 m, Schwimmen 9 m · STR 13, GES 15, KON 11, INT 1, WEI 9, CHA 3 · Blindsicht 9 m, Amphibisch
• Schere +3 — 1W6+1 Wucht; Ziel ist gepackt (Entkommen: STR/GES SG 11)

## Taktik
Nächstes Ziel angreifen, mit den Scheren packen und festhalten.

## Rückzug
Rückzug ins Wasser, sobald 2 Krabben besiegt sind.

## Nicht-Kampf
Abstand halten, Futter werfen, umgehen; Tierkunde/Naturkunde.

## Belohnung
Krebsfleisch zum Verkauf, ein paar Silbermünzen.`,
    [enemy('krabbe', 'Riesenkrebs', 4, 13)]),

  encounter('ratten', 'Hafenratten & Straßenpack',
`**Start:** Gasse, Kai, Lagerhaus, Tavernenhinterhof in Möwenhafen. Eine Schutzgeld-Nummer in dunkler Gasse — weicher zweiter Schritt mit vielen Nichtkampf-Lösungen.

**Bandit/Hafenschläger:** RK 12 · TP 11 · Bew 9 m · STR 11, GES 12, KON 12, INT 10, WEI 10, CHA 10
• Säbel/Knüppel +3 — 1W6+1
• Leichte Armbrust +3 — 1W8+1 Stich
**Variante Anführer:** TP 16 · Säbel +3, 1W6+1 Hieb (sonst wie Bandit)

## Taktik
Nahkämpfer vorne, Schütze hinten, Anführer macht Druck.

## Rückzug
Flucht, wenn der Anführer fällt oder 2 Banditen besiegt sind.

## Nicht-Kampf
Einschüchtern, Bestechen, Überreden, Wachen rufen.

## Belohnung
Kleine Börse, Diebesgut, ein Hinweis (Schmuggler/Kiste).`,
    [enemy('ratten-boss', 'Anführer', 1, 16), enemy('ratten-schuetze', 'Schütze', 1, 11), enemy('ratten-nah', 'Nahkämpfer', 2, 11)]),

  encounter('messertrupp', 'Messertrupp am Kai',
`**Start:** Lagerhaus, Kai, dunkle Gasse, Zollhaus — lauert NACHDEM die Gruppe die verschlossene Kiste trägt (alternativ Hinterhalt beim Ablegen an der Ringklippe). Verknüpft Kampf und Plot.

**Schmugglerboss (Scout):** RK 13 · TP 16 · Bew 9 m · STR 11, GES 14, KON 12, INT 11, WEI 13, CHA 11 · Naturkunde +4, Wahrnehmung +5, Heimlichkeit +6
• Mehrfachangriff: 2 Nahkampf- oder 2 Fernkampfangriffe
• Kurzschwert +4 — 1W6+2 Stich · Langbogen/Armbrust +4 — 1W8+2 Stich
**Bandit/Schläger:** RK 12 · TP 11 · Säbel/Knüppel +3 — 1W6+1 · Leichte Armbrust +3 — 1W8+1

## Taktik
Anführer bleibt beweglich, Fernkämpfer nutzen Deckung, Nahkämpfer blockieren Wege.

## Rückzug
Rückzug, wenn der Anführer fällt oder 3 Gegner besiegt sind.

## Nicht-Kampf
Bestechen, Einschüchtern, Beweise anbieten, Wachen rufen, Deal machen.

## Belohnung
Schmuggler-Börse (ordentlich Gold), Schmuggelware, Hinweis zur Kiste.`,
    [enemy('messer-boss', 'Schmugglerboss', 1, 16), enemy('messer-nah', 'Nahkämpfer', 2, 11), enemy('messer-fern', 'Fernkämpfer', 2, 11)]),

  encounter('woelfe', 'Wölfe auf der Klippe',
`**Start:** Gebüsch, Felsen, Klippenpfad, Nachtlager — auf dem Klippenpfad der Wolfsklippen, hin wie zurück (nachts).

**Wolf:** RK 13 · TP 11 · Bew 12 m · STR 12, GES 15, KON 12, INT 3, WEI 12, CHA 6 · Wahrn. +3, Heimlichkeit +4 · Scharfes Gehör & Geruch · Rudeltaktik
• Biss +4 — 2W4+2 Stich; bei Treffer STR-RW SG 11 oder Ziel fällt zu Boden

## Taktik
Rudel umkreist die Gruppe, 2 Wölfe greifen dasselbe Ziel an.

## Rückzug
Flucht, sobald 1–2 Wölfe schwer verletzt oder besiegt sind.

## Nicht-Kampf
Feuer, Futter, Lärm, langsamer Rückzug; Tierkunde.

## Belohnung
Wolfsfelle zum Verkauf.`,
    [enemy('wolf', 'Wolf', 5, 11)]),

  encounter('baer', 'Der hungrige Küstenbär',
`**Start:** Höhle am Bachlauf mit Fischresten, Dickicht — Wolfsklippen. Brüllt und droht zuerst; vermeidbar.

**Braunbär:** RK 11 · TP 34 · Bew 12 m, Klettern 9 m · STR 19, GES 10, KON 16, INT 2, WEI 13, CHA 7 · Wahrn. +3 · Scharfer Geruchssinn
• Mehrfachangriff: Biss + Klauen
• Biss +5 — 1W8+4 Stich · Klauen +5 — 2W6+4 Hieb

## Taktik
Brüllen, drohen, dann das nächste Ziel angreifen.

## Rückzug
Rückzug bei halben TP, wenn möglich.

## Nicht-Kampf
Futter, Rückzug, Feuer, Lärm, Tierkunde.

## Belohnung
Bärenfell; in der Höhle ein Münz-Cache früherer Opfer.`,
    [enemy('baer', 'Braunbär', 1, 34)]),

  encounter('beiboot', 'Piraten-Beiboot',
`**Start:** Beiboot im Nebel, beim Ankern, nahe Riff (Nebelbank). Leichtere Piratenszene als Aufwärmer.

**Pirat (Bandit):** RK 12 · TP 11 · Bew 9 m · STR 11, GES 12, KON 12, INT 10, WEI 10, CHA 10
• Entermesser/Säbel +3 — 1W6+1 Hieb · Leichte Armbrust/Wurfspeer +3 — 1W8+1 Stich
**Enterhaken:** Werfen +3 vs RK 12 · Lösen Aktion (STR SG 10) · Kappen mit Klinge · Rüberklettern = Bewegung (Wellengang: Athletik SG 10)

## Taktik
Fernkämpfer bleiben im Boot, Nahkämpfer entern.

## Rückzug
Flucht, wenn 2–3 Piraten besiegt sind.

## Nicht-Kampf
Verhandeln, Einschüchtern, Enterhaken kappen, Beiboot abdrängen. Piraten parlamentieren leichter mit einer berüchtigten Crew.

## Belohnung
Bescheidenes Gold, Bergegut.`,
    [enemy('beiboot-fern', 'Pirat (Fernkämpfer)', 2, 11), enemy('beiboot-enterer', 'Pirat (Enterer)', 3, 11)]),

  encounter('sirenen', 'Sirenenfelsen',
`**Start:** Felseninsel, Klippe, Nebelbank, Wrackmast. Gesang lockt Schiffe auf die Felsen; die Matrosen sind befreibar (nicht zwingend tödlich spielen).

**Harpyie/Sirene:** RK 11 · TP 38 · Bew 6 m, Fliegen 12 m · STR 12, GES 13, KON 12, INT 7, WEI 10, CHA 13 · Gemeinsprache
• Mehrfachangriff: Klauen + Knüppel · Klauen +3 — 2W4+1 Hieb · Knüppel +3 — 1W4+1 Wucht
• Lockender Gesang (90 m): WEI-RW SG 11, sonst bezaubert & bewegt sich zur Harpyie; Wurf-Wdh. bei Schaden/Zugende; Erfolg = 24 Std. immun
**Verzauberter Matrose (Bandit):** RK 12 · TP 11 · Entermesser/Knüppel +3 — 1W6+1 · bei Ende des Gesangs verwirrt/gebrochen

## Taktik
Harpyie singt und bleibt erhöht/außer Reichweite; Matrosen blockieren Wege.

## Rückzug
Harpyie flieht fliegend bei unter 15 TP oder wenn der Gesang wirkungslos bleibt.

## Nicht-Kampf
Ohren verstopfen, Matrosen befreien, Abstand, Verhandeln, Gesang unterbrechen.

## Belohnung
Münzen & ein Trinket aus dem Nest; befreite Matrosen (Perrin) als Verbündete.`,
    [enemy('harpyie', 'Harpyie (Sirene)', 1, 38), enemy('matrose', 'Verzauberter Matrose', 2, 11)]),

  encounter('untiefe', 'Krabbenschwarm / Sahuagin-Späher (Untiefe)',
`**Start:** Weite Sandbänke der östlichen Untiefe — Grundberührung ist eine echte Gefahr fürs Boot. Wahlweise ein größerer Klippenkrabben-Schwarm in den Tümpeln ODER erste Sahuagin-Späher als Vorboten des Riffs.

**Riesenkrebs:** RK 15 · TP 13 · Schere +3 — 1W6+1 Wucht (packt, Entkommen SG 11)
**Sahuagin:** RK 12 · TP 22 · Bew 9 m, Schwimmen 12 m · Blutraserei (Vorteil ggü. verletzten Zielen) · Biss/Klauen/Speer +3

## Taktik
Krabben: packen und festhalten. Sahuagin: aus dem Wasser, verwundete Ziele, wieder abtauchen.

## Nicht-Kampf
Vorsichtig navigieren (Untiefe!), Futter, Abstand, über Wrackgut verhandeln.`,
    [enemy('untiefe-krabbe', 'Riesenkrebs', 6, 13), enemy('untiefe-spaeher', 'Sahuagin-Späher', 2, 22)]),

  encounter('entertrupp', 'Piraten-Entertrupp',
`**Start:** Schiff an Schiff im Nebel nahe Riff (Anfahrt zum Wrack), Enterhaken am Geländer. Sechs Gegner — harter Kampf.

**Bootsmann (Scout):** RK 13 · TP 16 · Bew 9 m · Naturk. +4, Wahrn. +5, Heiml. +6
• Mehrfachangriff: 2 Nah- oder 2 Fernkampfangriffe · Kurzschwert/Entermesser +4 — 1W6+2 · Langbogen/Armbrust +4 — 1W8+2
**Pirat (Bandit):** RK 12 · TP 11 · Entermesser/Säbel +3 — 1W6+1 · Leichte Armbrust/Wurfspeer +3 — 1W8+1
**Enterhaken:** Werfen +3 vs RK 12 · Lösen Aktion (STR SG 10) · Kappen mit Klinge · Rüberklettern = Bewegung (Wellengang: Athletik SG 10)

## Taktik
Bootsmann kommandiert, Fernkämpfer decken, Enterer klettern an Bord.

## Rückzug
Flucht, wenn der Bootsmann fällt oder 3 Piraten besiegt sind.

## Nicht-Kampf
Einschüchtern, Verhandeln, Enterhaken kappen, Beiboot beschädigen, Wind/Manöver nutzen.

## Belohnung
Gold + **Salzzahn** (+1 Entermesser, beim Bootsmann).`,
    [enemy('entertrupp-boss', 'Bootsmann', 1, 16), enemy('entertrupp-fern', 'Pirat (Fernkämpfer)', 2, 11), enemy('entertrupp-enterer', 'Pirat (Enterer)', 3, 11)]),

  encounter('wrack', 'Nasse Tote am Wrack',
`**Start:** Wrack, Strand, nasser Laderaum, Gezeitenhöhle — das gestrandete Ölboot auf den Sandbänken am Riffrand.

**Ghoul:** RK 12 · TP 22 · Bew 9 m · Dunkelsicht 18 m · Immun: Gift; Zustandsimmun: bezaubert, erschöpft, vergiftet
• Biss +2 — 2W6+2 Stich · Klauen +4 — 2W4+2 Hieb; KON-RW SG 10 oder gelähmt (Elfen & Untote ausgenommen)
**Zombie:** RK 8 · TP 22 · Bew 6 m · Hieb +3 — 1W6+1 Wucht
• Untote Zähigkeit: bei 0 TP KON-RW SG 5+Schaden → bleibt bei 1 TP (nicht bei Strahlen/Krit)

## Taktik
Zombies binden vorne, der Ghoul greift verwundete oder isolierte Ziele an.

## Rückzug
Untote fliehen nicht — endet durch Zerstörung, Bannung oder Flucht der Gruppe.

## Nicht-Kampf
Heiliges Symbol, Ruhe gewähren, Wrack meiden, Zielgegenstand schnell bergen.

## Belohnung
Öl-Ladung (Quest!), Sturmjahrgang (Wein), **Wellenbrecher** (+1 Schild), Bergegut.`,
    [enemy('ghoul', 'Ghoul', 1, 22), enemy('wrack-zombie', 'Zombie', 3, 22)]),

  encounter('keller', 'Die nassen Toten',
`**Start:** Überfluteter Keller des Hafenfeuers (Osthafen) — hinter der verborgenen Tür, die der alte Wartturm-Schlüssel öffnet. Alternativ Strand bei Ebbe / altes Bootshaus am Friedhofsufer.

**Zombie:** RK 8 · TP 22 · Bew 6 m · Hieb +3 — 1W6+1 Wucht · Untote Zähigkeit (KON-RW SG 5+Schaden)
**Skelett:** RK 13 · TP 13 · Bew 9 m · Anfällig: Wucht · Immun: Gift
• Kurzschwert +4 — 1W6+2 Stich · Kurzbogen +4 — 1W6+2 Stich (24/96 m)

## Taktik
Zombies langsam nach vorne, Skelette schießen oder flankieren.

## Rückzug
Untote fliehen nicht — endet durch Zerstörung, Flucht oder Weihen/Schließen des Ortes.

## Nicht-Kampf
Tür blockieren, heiliges Symbol/Ritual, Wrack verlassen, Knochen-/Anker-Siegel zerstören.

## Belohnung
**Sternenkompass** (Plot-Hook: zeigt auf einen verborgenen Ort) + alter Wärter-Cache (Gold).`,
    [enemy('keller-zombie', 'Zombie', 3, 22), enemy('skelett', 'Skelett', 2, 13)]),

  encounter('sahuagin', 'Wasserwesen am Riff',
`**Start:** Wrack, Riff, halb überflutete Höhle, Lagune — Nest am Riff.

**Sahuagin:** RK 12 · TP 22 · Bew 9 m, Schwimmen 12 m · STR 13, GES 11, KON 12, INT 12, WEI 13, CHA 9 · Wahrn. +5, Dunkelsicht 36 m · Blutraserei (Vorteil ggü. verletzten Zielen) · begrenzte Amphibie · Hai-Telepathie
• Mehrfachangriff: Biss + Klauen oder Biss + Speer
• Biss +3 — 1W4+1 Stich · Klauen +3 — 1W4+1 Hieb · Speer +3 — 1W6+1 (zweihändig 1W8+1; geworfen 6/18 m)

## Taktik
Aus dem Wasser angreifen, verwundete Ziele fokussieren, Speere werfen, wieder abtauchen.

## Rückzug
Rückzug ins Wasser, wenn 1 Sahuagin fällt oder alle verwundet sind.

## Nicht-Kampf
Einschüchtern, Gebiet verlassen, Beute/Opfergabe, über Wrackgut verhandeln.

## Belohnung
**Mantarochen-Umhang** (Kapuze auf: Unterwasseratmung + Schwimmen 18 m) + Wrackgut/Gold.`,
    [enemy('sahuagin', 'Sahuagin', 3, 22)]),

  encounter('riffjaeger', 'Riffjäger — Riesenoktopus',
`**Start:** Unter Wrackteilen, im Riff, unter Steg, in Lagune/Grotte. Reißt Boote und Fischer unter Wasser — Kopfgeld in Klippendorf & Osthafen!

**Riesenoktopus:** RK 11 · TP 52 · Bew 3 m, Schwimmen 18 m · STR 17, GES 13, KON 13, INT 4, WEI 10, CHA 4 · Wahrn. +4, Heiml. +5, Dunkelsicht 18 m · Unterwassertarnung · Wasseratmung, hält 1 Std. Luft an
• Tentakel +5 — 2W6+3 Wucht (Reichw. 4,5 m); Ziel gepackt & festgesetzt (Entkommen SG 16)
• Sonderaktion: Tintenwolke (nur unter Wasser) → Rückzug

## Taktik
Aus dem Wasser greifen, Ziel packen, Richtung Tiefe/Deckung ziehen.

## Rückzug
Rückzug in Tinte/Spalte bei unter 20 TP.

## Nicht-Kampf
Futter abwerfen, Abstand, Wrack umgehen, Feuer/Lärm, Beute zurücklassen.

## Belohnung
Große Perle (wertvoll) + Münzen aus dem Nest. **Beweisstück fürs Kopfgeld: Schnabel und Tentakel mitnehmen!**`,
    [enemy('oktopus', 'Riesenoktopus', 1, 52)]),

  encounter('riese', 'Grottenhüter — Junger Meeresriese',
`**Start:** Grotte, Wrackteil, Riff — bewacht sein Revier an der Flussmündung (Flussgrotte). Der Zonen-Boss der Kampagne (HG 2).

**Meeresriese (Oger, maritim):** RK 11 · TP 59 · Bew 12 m · STR 19, GES 8, KON 16, INT 5, WEI 7, CHA 7 · Groß, Riese · Dunkelsicht 18 m · Riesisch, gebrochen Gemeinsprache
• Große Keule/Ankerstück +6 — 2W8+4 Wucht (Reichw. 1,5 m)
• Wurfspeer/Felsbrocken +6 — 2W6+4 Stich/Wucht (9/36 m)

**Aussehen:** graublaue Haut, Seetang im Haar, Muscheln an Schultern; Waffe = Ankerstück/Treibholzkeule. Spricht langsam, grob, kindlich-wütend.

## Taktik
Territorial & hungrig. Zu leicht → nutzt Wurfgeschosse, Deckung, Engstellen. Zu schwer → brüllt, droht, verschwendet Runden mit Imponiergehabe.

## Rückzug
Verfolgt nur bis zum Grotteneingang.

## Nicht-Kampf
Will Futter, glänzende Dinge — oder eine feine Flasche Wein (Sturmjahrgang-Quest!) — oder dass man sein Revier verlässt. Verhandelbar!

## Belohnung
Erlegen → **Ankerschlag** (+1 Kriegshammer, extra Schaden gegen Objekte & Strukturen) + Hort-Gold + Ankerstück (Kopfgeld-Beweis). Bestechung → glänzendes Fundstück + freie Durchfahrt (weniger Loot).`,
    [enemy('riese', 'Meeresriese', 1, 59)]),
];

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------
const quest = (slug, name, status, progressNote, description, npcSlugs, encounterSlugs) => ({
  id: id(`q-${slug}`),
  name,
  status,
  progressNote,
  description,
  comments: [],
  npcIds: npcSlugs.map((s) => id(`npc-${s}`)),
  areaIds: [],
  encounterIds: encounterSlugs.map((s) => id(`enc-${s}`)),
});

const quests = [
  quest('oel', 'Öl für die Leuchtfeuer (Haupt)', 'open', '0/3 Türme',
`Zwölf Fässer Lampenöl an drei Leuchttürme — vier pro Turm: Nordfeuer, Klippenfeuer, Hafenfeuer. Die schrumpfende Ladung ist der sichtbare Fortschrittsmarker.

• Auftrag in Möwenhafen (Brenna); das Öl liegt an den Wolfsklippen — aber nicht am üblichen Platz
• Der Alte Wartturm (außer Betrieb, angeblich spukt es) ist noch randvoll; Seeweg heikel (steiler Aufstieg, marode Treppe) → über Land
• Über den freien Klippenpfad hoch: dort steht ein zurückgelassener Karren für zwölf Fässer; unterwegs lauern die Wölfe (nachts) und der Bär (Bachlauf)
• Fässer NICHT den Hang hinunterrollen — sie zerbrechen (Ölverlust, Brandgefahr)
• Vollen Karren zurück nach Möwenhafen, dann per Boot: Nordfeuer (Öl 1), Klippenfeuer (Öl 2)
• Das Hafenfeuer liegt weit im Osten — erst nach der Ringklippe; Bezahlung bei Doran Kettel
• Das vermisste Versorgungsboot ist in Wahrheit das Wrack — dort wartet auch Öl-Ladung`,
    ['brenna', 'jarl', 'tibbs', 'maren', 'doran'], ['woelfe', 'baer', 'wrack']),

  quest('brief', 'Brief & Kiste — Die Prüfung (Haupt)', 'open', 'Brief unterwegs',
`Im Kern eine Prüfung der Crew, getarnt als Botengang. Am Ende gehört ihnen ihr Schiff — die Morgenwind.

• **Prüfung 1 — der Brief:** versiegelt zu Alva (Ringklippe). Siegel intakt → schwarze Kiste, zweiter Brief, östliche Karte. Gebrochen → scheinbar leere Kiste; Alva merkt sich, wer zuerst nach dem Inhalt fragt
• **Prüfung 2 — die Kiste:** ungeöffnet zu Marren Voss (Osthafen, alte Werft)
• **In der Kiste:** kein Gold — leere Schiffsplakette, Messingnägel, der zweite Brief. Die Kiste IST die Übergabe des Schiffs
• **Belohnung:** die Morgenwind + Balliste, Sturmsegel, Nebellaterne, Kartenkasten; Taufe (Name wird eingeschlagen)
• **Verdient oder gestohlen:** unberührt → warme Übergabe · geöffnet aber ehrlich → harte Prüfung, Chance zur Wiedergutmachung · gelogen/gestohlen → Schiff als Diebesgut + Piraten-Ruf (Piraten parlamentieren leichter, Osthafen wird kühler)

Details in den Handouts „Brief an Alva", „Brief an Marren" und „Die Prüfung".`,
    ['alrik', 'alva', 'marren', 'zwielicht'], ['messertrupp']),

  quest('wein', 'Der Sturmjahrgang (Wein, optional)', 'open', '0 Flaschen',
`Lockere Wein-Jagd durch die ganze Bucht. Ein Sammler zahlt fürstlich für eine echte Flasche des legendären Sturmjahrgangs — und ordentlich für jeden guten Tropfen.

• **Tischwein:** Graue Möwe, Möwenhafen (sicher, billig — der Einstieg)
• **Geschmuggelte Flaschen:** Ringklippe, Alva (verhandeln oder Gefallen)
• **Teurer Import:** Osthafen, Händler/Doran (sicher, teuer, Sammlerqualität)
• **Flasche im Hort:** Flussgrotte, Meeresriese (verhandelbar — er mag feine Tropfen!)
• **Der echte Sturmjahrgang:** im Laderaum des Wracks (Untote & Riff!)

**Boon:** einmal trinken → 1 Stunde Vorteil auf Rettungswürfe gegen Furcht ODER 2W4+2 temporäre TP.
**Clou:** Eine feine Flasche besticht den Meeresriesen — der Nichtkampf-Schlüssel zum härtesten Gegner.`,
    ['hanne', 'alva', 'doran'], ['wrack', 'riese']),

  quest('kopfgeld-oktopus', 'Kopfgeld: Der Riffjäger', 'open', undefined,
`Der Riesenoktopus reißt Boote und Fischer unter Wasser; das Riff-Revier wird gemieden.

• **Auftraggeber & Abgabe:** Nesa Reet (Klippendorf) und/oder Doran Kettel (Osthafen)
• **Beweisstück:** Schnabel und Tentakel (fällt beim Erlegen automatisch an — Kampf lohnt auch, wenn er zufällig zuerst passiert)
• **Belohnung:** Gold (nach Stufe) + freie Bootsreparaturen in Klippendorf, eine Perle aus dem Nest, sichere Fangründe
• **Gerüchte:** Klippendorf-Fischer, Netz-Gwynn, Perrin, Doran`,
    ['nesa', 'doran', 'gwynn', 'perrin'], ['riffjaeger']),

  quest('kopfgeld-riese', 'Kopfgeld: Der Grottenhüter', 'open', undefined,
`Reeder Haldrics Frachter meiden das östliche Fahrwasser, seit der junge Meeresriese die Flussmündung hält.

• **Zwei Wege:** erlegen ODER mit Wein/glänzenden Dingen bestechen, sodass er das Fahrwasser freigibt
• **Beweisstück:** Ankerstück (Kampf) oder glänzendes Fundstück / bestätigte freie Durchfahrt (Bestechung)
• **Belohnung:** Gold + Gunst — Rabatt oder Kreditbrief bei Haldric, ein Schmuckstück aus dem Hort; Erlegen → Ankerschlag (+1 Kriegshammer)
• **Hinweis:** Der Bestechungsweg spart den Kampf und verzahnt sich mit der Wein-Nebenquest`,
    ['haldric', 'doran'], ['riese']),
];

// ---------------------------------------------------------------------------
// Handouts
// ---------------------------------------------------------------------------
const handout = (slug, category, title, body) => ({
  id: id(`h-${slug}`),
  title,
  body,
  category,
  expanded: false,
});

const orte = [
  ['ort-01-moewenhafen', '1 · Möwenhafen — die Basis (Leicht)',
`Kompakte Inselstadt mitten in der Bucht (Mitte der linken Karte), nur über Steg und Boot erreichbar. Enge Gassen, teerige Kais, Steinhäuser um den Hafenplatz, windschiefe Holzbuden auf Pfählen. Hier bekommt die Gruppe die linke Karte und alle Aufträge.

## NSCs
• Brenna Salzhand (Öl-Quest; das Öl lagert an den Wolfsklippen!)
• Alrik Voss (versiegelter Brief → Ringklippe)
• Hanne, Graue Möwe (Seemannsgarn, Wein-Aufhänger)
• Corran, versoffener Lotse (Riff-Gerücht)
• Zwielichtiger Kontakt (zu früh interessiert an „einer Kiste aus dem Osten")

## Gerüchte & Kurs
• Öl-Auftrag → erst hoch zu den Wolfsklippen
• Brief zur Ringklippe — dort sitzt „der Kartenmann"
• Erste Andeutungen zu allen vier Features + der „Sand"-Haken

## Encounter
• Klippenkrabben (Einstieg) · Hafenratten & Straßenpack · Messertrupp am Kai (mit Kiste)

**Nächster Kurs:** Wolfsklippen (Öl abholen).`],
  ['ort-02-wolfsklippen', '2 · Wolfsklippen & Öl-Depot (Leicht–Mittel)',
`Nordwestliche Bucht, obere linke Ecke. Gezackte Steilküste mit schmalem Klippenpfad, Seevogelkolonien, Bachlauf mit kleiner Höhle, windschiefe Kiefern — der Wind heult durch die Felsen.

## Der Twist
Am gewohnten Lager ist das Öl alle — der Alte Wartturm (außer Betrieb, angeblich spukt es) ist noch randvoll. Seeweg: Anleger brauchbar, Verladekran kaputt, Treppe marode → zu riskant. **Landweg empfohlen:** freier Klippenpfad, oben steht ein zurückgelassener Karren für zwölf Fässer. Fässer nicht den Hang hinunterrollen!

Der „Spuk": nach Wahl bloße Atmosphäre — oder eine kleine echte Spukszene.

## Personalisierter Haken
Oben im Turm: ein alter, salzverkrusteter **Schlüssel mit Wärter-Marke** (für schlüsselsammelnde Charaktere). Passt später auf die verborgene Tür im Leuchtturm-Keller (→ „Die nassen Toten").

## NSCs
• Jarl, Fallensteller — warnt vor Rudel & Bär; Pfad frei, Karren steht

## Encounter
• Wölfe auf der Klippe (nachts) · Der hungrige Küstenbär (Höhle am Bach)

**Nächster Kurs:** Vollen Karren nach Möwenhafen, dann per Boot Nordfeuer & Klippenfeuer.`],
  ['ort-03-nordfeuer', '3 · Nordfeuer (Leicht)',
`Einzelner Turm auf dem Felsinselchen oben Mitte der linken Karte — kurzer Sprung von den Wolfsklippen nach Nordosten. **Erste Öl-Lieferung.**

## NSCs
• Old Tibbs, Wärter — dankbar fürs Öl. Erzählt vom „Sand so weit das Auge reicht" im Osten (Keim der Fehlleitung!). Warnt vor den Krabbenbänken.

## Gerüchte & Kurs
• „Östliche Bucht, endloser Sand" → die Gruppe soll (noch) glauben, es sei auf ihrer Karte
• Krabbenbänke, an denen Boote aufsetzen → deutet auf die Untiefe

**Nächster Kurs:** Klippenfeuer (Öl 2).`],
  ['ort-04-klippenfeuer', '4 · Klippenfeuer (Mittel)',
`Turm auf der unteren Westküste der linken Karte — auf dem Rückweg vom Nordfeuer. **Zweite Öl-Lieferung.**

## NSCs
• Maren Lichthüter, Wärterin — verweist auf „den Kartenmann an der Ringklippe" (Alva); warnt: Überfahrt nach Osten kein Kinderspiel — Nebel und ein Riff.

## Gerüchte & Kurs
• Wer nach Osten will, sollte vorher zur Ringklippe — Alva kennt die Gewässer
• Bestätigt Nebel- und Riff-Gerücht

**Nächster Kurs:** Zurück nach Möwenhafen, dann Ringklippe.`],
  ['ort-05-ringklippe', '5 · Ringklippe — der Tausch (Mittel)',
`Ring-/Atoll-Inselchen unten links (linke Karte). Abgelegen, von Bäumen gesäumt — ein guter Ort für diskrete Geschäfte.

## Wendepunkt: Prüfung 1 & die zweite Karte
• Brief unversehrt → Alva gibt die schwarze Kiste, den zweiten Brief (für Marren) UND die östliche Seekarte
• Siegel gebrochen → scheinbar leere Kiste; Alva bleibt freundlich und merkt sich, wer zuerst nach dem Inhalt fragt
• Ab jetzt löst sich der Sand-Trick: „östliche Bucht" = die ANDERE Bucht

## NSCs
• Alva Rauk, Kartograph & Hehler — warnt vor Riff und Nebelbank; hat Weinflaschen unter der Hand

## Encounter
• Optional: Messertrupp am Kai (falls noch nicht genutzt) — Hinterhalt beim Ablegen

**Nächster Kurs:** Überfahrt nach Osten → Nebelbank.`],
  ['ort-06-nebelbank', '6 · Nebelbank & Sirenenfels (Mittel)',
`Offenes Wasser im Übergang zur östlichen Bucht. Nebelband und Sirenenfels werden aus Gerüchten selbst eingezeichnet. Ein Rudel Felsen liegt mitten im Grau.

## NSCs
• Perrin, geretteter Matrose — warnt (nach Befreiung) vor den „nassen Toten am Wrack" und dem Riff dahinter

## Gerüchte & Kurs
• „Das Grau, das Schiffe schluckt" und der Gesang auf den Felsen → einzeichnen
• Hinter dem Nebel liegen Wrack und Riff — die gefährliche Zone

## Encounter
• Piraten-Beiboot (beim Ankern im Nebel) · Sirenenfelsen (Matrosen befreibar!)

**Nächster Kurs:** Östliche Untiefe / Wrack.`],
  ['ort-07-untiefe', '7 · Die östliche Untiefe — „Sand…" (Mittel–Schwer)',
`Die östliche Bucht (rechte Karte): weite Sandbänke, die Schiffe auflaufen lassen. Untiefe einzeichnen. Hier zahlt sich der Sand-Hinweis aus — **in Sichtweite liegt das gestrandete Ölboot.**

## NSCs
• Netz-Gwynn, gestrandete Bergerin — zeigt zum Wrack, erzählt von der Bergungsprämie in Osthafen, warnt vor Sahuagin

## Gerüchte & Kurs
• „Das, was im Sand liegt" ist das vermisste Ölboot — dort wartet auch die Öl-Ladung
• In Osthafen gibt es eine Bergungsprämie für das Boot

## Encounter
• Krabbenschwarm / Sahuagin-Späher — Grundberührung ist echte Gefahr fürs Boot

**Nächster Kurs:** Das Wrack, dann Osthafen.`],
  ['ort-08-wrack', '8 · Das Wrack (Schwer)',
`Auf den Sandbänken am Rand des Riffs (rechte Karte, Mitte). Wrack einzeichnen. Es ist das vermisste Ölboot — halb gesunken, nasser Laderaum, vom Riff aufgerissen.

## Wein-Payoff
Im Laderaum lagern neben dem Öl versiegelte Weinfässer — darunter der echte **Sturmjahrgang**.

## Beute & Plot
Öl-Ladung (Öl-Quest!), Sturmjahrgang (Wein), Hinweise zu Kiste und Osthafen, Bergungsgut für die Prämie.

## Encounter
• Piraten-Entertrupp (auf der Anfahrt, Schiff-an-Schiff im Nebel) · Nasse Tote am Wrack (Laderaum & Deck)

**Nächster Kurs:** Das Riff / Osthafen.`],
  ['ort-09-riff', '9 · Das Riff (Schwer)',
`Rechte Karte, offenes Wasser rechts unten: ein Unterwasser-Riff, das Schiffe seit Jahren verschlingt. Riff einzeichnen. Nahebei liegt **Klippendorf**, das Fischerdorf auf der Felsnase oben rechts.

## NSCs
• Klippendorf-Fischer (Älteste Nesa Reet) — verlieren Boote an den Riffjäger; Kopfgeld!

## Gerüchte & Kurs
• Der Riesenoktopus macht das Riff unsicher — für seinen Kopf zahlen Klippendorf und Osthafen
• Schnabel und Tentakel als Beweisstück mitnehmen, auch ohne den Auftrag

## Encounter
• Wasserwesen — Sahuagin (Nest am Riff) · Riffjäger — Riesenoktopus (TP 52, Lagune/Grotte)

**Nächster Kurs:** Flussgrotte (das Revier des Riesen).`],
  ['ort-10-flussgrotte', '10 · Flussgrotte — der Meeresriese (Schwer)',
`Am rechten Ufer der östlichen Bucht führt ein Fluss in einen verdächtigen Bergteil. Dahinter liegt, halb geflutet, die Grotte des jungen Meeresriesen — man watet nassen Fußes hinein. **Der Zonen-Boss der Kampagne.**

## Gerüchte & Kurs
• Kopfgeld: Reeder Haldric zahlt, wenn das Fahrwasser wieder sicher ist — Erlegen ODER Bestechung
• Beim Erlegen das Ankerstück als Trophäe mitnehmen; bei Bestechung gibt der Riese ein glänzendes Fundstück

## Encounter
• Grottenhüter — Junger Meeresriese (TP 59, HG 2) — verhandelbar: Futter, glänzende Dinge, eine feine Flasche Wein

**Nächster Kurs:** Osthafen (Abschluss).`],
  ['ort-11-osthafen', '11 · Osthafen — Hafenfeuer & Ziel (Abschluss)',
`Große Hafenstadt unten rechts (rechte Karte) mit eigenem Leuchtturm (Hafenfeuer), Friedhof am Wasser und alter Werft. Ziel der Kiste, der dritten Öl-Lieferung — und Ort der Schiffsübergabe.

## Prüfung 2 & Abschluss
Marren Voss nimmt die schwarze Kiste an der alten Werft entgegen, prüft Siegel und Scharniere, öffnet sie vor der Crew: leere Plakette, Messingnägel, der zweite Brief — **die Übergabe der Morgenwind.** Dann Balliste, Sturmsegel, Nebellaterne, Kartenkasten und die Taufe.

## NSCs
• Marren Voss, Werftmeister (Kiste, Schiffsübergabe)
• Doran Kettel, Hafenmeister (Bergungsprämie, Öl-Zahlung, Riffjäger-Kopfgeld, Import-Wein)
• Reeder Haldric (Grottenhüter-Kopfgeld, freie Durchfahrt)

## Encounter
• Die nassen Toten — im überfluteten Keller des Hafenfeuers, hinter der verborgenen Tür (Wartturm-Schlüssel!)`],
];

const kampagne = [
  ['kurs', 'Kurs auf einen Blick',
`Reihenfolge als Vorschlag, kein Zwang — die NSCs halten die Gruppe sanft auf Kurs.

• **1 Möwenhafen** (Leicht) — Krabben, Hafenratten, Messertrupp → Wolfsklippen
• **2 Wolfsklippen + Öl-Depot** (Leicht–Mittel) — Wölfe, Küstenbär → Nordfeuer & Klippenfeuer
• **3 Nordfeuer** (Leicht) — Öl-Lieferung 1 → Klippenfeuer
• **4 Klippenfeuer** (Mittel) — Öl-Lieferung 2 → Möwenhafen → Ringklippe
• **5 Ringklippe** (Mittel) — sozial; optional Messertrupp → Osten, Nebelbank
• **6 Nebelbank & Sirenenfels** (Mittel) — Piraten-Beiboot, Sirenen → Wrack/Untiefe
• **7 Östliche Untiefe** (Mittel–Schwer) — Krabbenschwarm/Sahuagin-Späher → Wrack/Osthafen
• **8 Das Wrack** (Schwer) — Entertrupp, Nasse Tote → Riff/Osthafen
• **9 Das Riff** (Schwer) — Sahuagin, Riffjäger → Flussgrotte
• **10 Flussgrotte** (Schwer) — Grottenhüter (HG 2) → Osthafen
• **11 Osthafen** (Abschluss) — Die nassen Toten; Kiste, Öl 3, Schiffsübergabe`],
  ['karten-regel', 'Karten-Regel & der Sand-Trick',
`## Karten-Regel
• Die linke Karte bekommt die Gruppe gleich in Möwenhafen; die rechte erst bei der Ringklippe
• Die vier versteckten Features (Untiefe, Nebelbank, Riff, Wrack) sind NICHT vorgezeichnet — die Gruppe zeichnet sie selbst ein, sobald sie genug Gerüchte gesammelt hat (zwei unabhängige Hinweise → einzeichnen)

## Der „Sand"-Trick (Fehlleitung)
„In der östlichen Bucht — Sand so weit das Auge reicht. Da soll etwas liegen."
• Mit nur der linken Karte deutet „östlich" auf den rechten Kartenrand (Felseninsel/Seenaht) — dort ist nur die kleine Gezeitenzone
• Erst mit der zweiten Karte fällt der Groschen: gemeint ist die ganz andere, östliche Bucht mit den riesigen Untiefen beim Riff
• „Das, was da liegt" ist das gestrandete Ölboot (das Wrack) samt Bergungsgut — die Belohnung fürs gelöste Rätsel`],
  ['geruechte', 'Gerüchte-Schnellübersicht',
`Wenn die Spieler sich umhören, gib das passende Gerücht. Zwei unabhängige Hinweise auf ein Feature → sie dürfen es einzeichnen.

• **Krabbenbänke, an denen Boote aufsetzen** (Fischer, Brenna, Old Tibbs) → Untiefe (Osten), nach 2 Hinweisen
• **Das Grau, das Schiffe schluckt; Gesang** (Hanne, Perrin) → Nebelbank/Sirenenfels, nach 2 Hinweisen
• **Ein Riff, das keiner mehr befährt** (Corran, Alva, Maren) → Riff, mit östl. Karte + Hinweis
• **Das vermisste Ölboot; Bergungsprämie** (Brenna, Netz-Gwynn, Doran) → Wrack, am Fundort
• **Sand so weit das Auge reicht** (Old Tibbs, Matrosen) → Untiefe (Osten) — Trick! Mit östl. Karte
• **Der beste Tropfen ging im Osten unter** (Hanne, Sammler) → Wein → Wrack (Sturmjahrgang)
• **Ein vielarmiges Ungeheuer reißt Boote unter** (Klippendorf, Perrin) → Kopfgeld Riffjäger
• **Ein Riese hält die Flussmündung** (Haldric, Netz-Gwynn) → Kopfgeld Grottenhüter`],
  ['belohnungen', 'Belohnungen & magische Gegenstände',
`Dichte bewusst mittel — harte Begegnungen im Osten geben verlässlich etwas. Goldwerte = Richtwerte Stufe 4–5.

## Feste Belohnungen
• Klippenkrabben → Krebsfleisch, Silber
• Hafenratten → kleine Börse, Diebesgut, Hinweis (Schmuggler/Kiste)
• Messertrupp → Schmuggler-Börse, Schmuggelware, Hinweis zur Kiste
• Wölfe → Felle · Küstenbär → Bärenfell + Münz-Cache
• Piraten-Beiboot → Gold, Bergegut
• Sirenenfelsen → Münzen, Trinket; Perrin als Verbündeter
• Piraten-Entertrupp → Gold + **Salzzahn** (+1 Entermesser)
• Nasse Tote am Wrack → Öl-Ladung, Sturmjahrgang, **Wellenbrecher** (+1 Schild)
• Die nassen Toten → **Sternenkompass** (Plot-Hook) + Wärter-Cache
• Sahuagin → **Mantarochen-Umhang** + Wrackgut
• Riffjäger → große Perle + Münzen
• Grottenhüter → Erlegen: **Ankerschlag** (+1 Kriegshammer) + Hort; Bestechung: Fundstück + Durchfahrt

## Magische Gegenstände
• **Mantarochen-Umhang** (ungewöhnlich): Kapuze auf → Unterwasseratmung + Schwimmen 18 m. Kein Kampfwert — Gold für Erkundung & kreative Lösungen
• **Salzzahn** (ungewöhnlich): +1 Entermesser/Kurzschwert
• **Wellenbrecher** (ungewöhnlich): +1 Schild (alter Wrackschild)
• **Sternenkompass** (ungewöhnlich): zeigt nicht nach Norden, sondern auf einen verborgenen Ort — reiner Plot-Hook
• **Ankerschlag** (selten): +1 Kriegshammer, extra Schaden gegen Objekte & Strukturen (Türen, Rümpfe)

## Frei verteilbarer Pool
Kleines Gold · Schiffskram (Reparatur-Kits, Ersatzsegel, Öl-Reserve, Laterne, Proviant) · 2–3 Heiltränke, Sturmwein-Boon, „Seebrise" (einmal Vorteil gg. Furcht/Seekrankheit) · Felle, Perle, Schmuggelware · Kartenfragmente als Hooks`],
  ['vorlesetext-brenna', 'Vorlesetext: Brennas Wegbeschreibung',
`Zwölf Fässer Leuchtfeueröl, drei Türme. Das Öl holt ihr an den Wolfsklippen — jedenfalls war das der Plan. Vor Ort werdet ihr hören: am üblichen Platz ist nichts mehr. Aber der Alte Wartturm, längst außer Betrieb, ist noch voll davon.

Neulich war einer oben — und ist Hals über Kopf abgehauen, weil es angeblich im Turm spukt. Alter Schisser, wenn ihr mich fragt.

Übers Wasser ginge es, aber ich würd's meiden. Der Anleger ist noch brauchbar, doch der Aufstieg ist steil, und den Treppen ist nicht mehr zu trauen.

Die gute Nachricht: Der Pfad oben an der Steilküste ist nicht zugewachsen. Der Kerl hat seinen Karren bis dort hochgezogen — und stehen lassen, als er das Weite suchte. Zwölf Fässer passen locker drauf.

Und versucht bloß nicht, die Dinger den Hang runterzurollen. Die Fässer sind alt.

Mein Rat: Nehmt den Landweg hin, ladet den Karren voll, bringt ihn hierher — dann fahrt ihr mit eurem Boot weiter und bestückt die Feuer.`],
];

const briefe = [
  ['brief-alva', 'Handout: Der erste Brief (an Alva)',
`Blaues Wachssiegel mit Wellensymbol.

Alva,

erreicht dich dieser Brief mit unversehrtem Siegel, so hat die neue Crew der Morgenwind ihre erste Prüfung bestanden. Übergib ihnen die schwarze Kiste für Marren Voss und lege den zweiten Brief hinein.

Ist das Siegel gebrochen, gib ihnen die leere Kiste. Sei freundlich. Lächle. Und merk dir gut, wer zuerst nach dem Inhalt fragt.

Die See zeigt jedem irgendwann, wie viel er wirklich wert ist.

— R.`],
  ['brief-marren', 'Handout: Der zweite Brief (an Marren)',
`Liegt in der schwarzen Kiste — eigentlich nicht für die Crew bestimmt.

Marren,

erreicht dich die Kiste verschlossen, hat die Crew der Morgenwind bestanden. Sie hielten Kurs, ohne die Siegel zu brechen.

Öffne sie vor ihnen. Die Plakette ist leer — der Name will verdient sein; die Nägel erst, wenn die Crew gewählt hat. Übergib, was bereitliegt: keine Belohnung, sondern Verantwortung.

Liest dies nicht Marren: ihr habt geöffnet. Besorgt euch eine schwarze Flagge — wer mit fremdem Erbe kommt, nenne sich ehrlich Pirat.

— R.`],
  ['pruefung', 'Die Prüfung: Brief, Kiste & die Morgenwind',
`Die zweite Hauptlinie ist eine Prüfung der Crew — getarnt als harmloser Botengang. Am Ende gehört ihnen ihr Schiff.

## Aufbau
• Die Gruppe ist die neue Crew der Morgenwind; der Erste Maat führt als amtierender Kapitän (NSC oder Spielercharakter)
• Alrik Voss (Agent des Gönners „R.") übergibt Öl-Auftrag und beiläufig den versiegelten Brief für Alva
• Ab hier liegt es an der Gruppe: ehrlich überbringen — oder öffnen, fälschen, an sich nehmen. Genau das ist der Test

## Was in der schwarzen Kiste steckt
Kein Gold: eine leere Schiffsplakette aus dunklem Holz, ein paar alte Messingnägel und der zweite Brief. Die Kiste ist die Übergabe des Schiffs.

## Belohnung
Die Morgenwind + kleine Balliste, Sturmsegel, Nebellaterne, Kartenkasten. Taufe: Name behalten oder neu — „Ein Name wird nicht gemalt, er wird eingeschlagen."

## Verdient oder gestohlen — das merkt sich die See
• Siegel & Kiste unberührt → volle, warme Übergabe
• Geöffnet, aber ehrlich zugegeben → Marren prüft hart, Chance zur Wiedergutmachung (z. B. erst Riff/dritten Turm meistern)
• Geöffnet, gelogen oder gestohlen → Schiff & Ausrüstung als Diebesgut + Piraten-Ruf
• Folgen: Piraten parlamentieren leichter („eine von uns"); Osthafen wird kühler (schlechtere Kopfgelder/Handel). Sirenen, Untote und den Riesen kümmert es nicht`],
  ['schluessel', 'Haken: Der alte Schlüssel',
`• Oben im Alten Wartturm findet die Gruppe — besonders ein schlüsselsammelnder Charakter — einen alten, salzverkrusteten Schlüssel mit Wärter-Marke. Wirkt wie Krimskrams, ist es aber nicht
• Später an einem Leuchtturm durchblicken lassen, dass es dort eine verborgene Tür gibt. Überraschung: Der Schlüssel passt
• Dahinter, im überfluteten Keller, wartet der Skelett-Encounter „Die nassen Toten". Standard: Keller des Hafenfeuers in Osthafen (Friedhofsnähe); alternativ das Klippenfeuer für eine frühere Auflösung
• Rein optional, an den Kämpfer-Steckbrief angedockt („sammelt alte Schlüssel"). Timing des Winks liegt bei dir`],
];

const schiff = [
  ['schiff-grundsatz', 'Schiffsprüfungen: Grundsatz & Auswertung',
`Einmal lernen, später nur bei Druck wieder würfeln.

## Grundsatz
Einmal geschafft = gelernt. Danach im Normalbetrieb keine Probe. **Wieder würfeln bei:** Sturm/Nebel/Nacht · Kampf oder Zeitdruck · Schaden am Schiff · unbekanntem Gewässer · besonders riskanter Idee.

## Fehlschlag
Nicht sofort hart bestrafen — Drama erzeugen: Zeitverlust · Kursabweichung · kleiner Schaden · jemand gerät in Gefahr · Notfallprüfung wird ausgelöst.

## Mini-Auswertung am Tisch
• **passend/kreativ** → Vorteil, SG senken oder bessere Position (Zeitgewinn, Gefahr früh erkannt, Respekt der Crew)
• **solide** → normal würfeln (Problem gelöst oder kleine Kosten)
• **riskant/halb passend** → kann klappen, Fehlschlag tut mehr weh (Kursabweichung, Schaden, Notfallprüfung)
• **ignoriert/keine Reaktion** → automatische Komplikation oder Nachteil (Zeitverlust, Gefahr, Begegnung)`],
  ['schiff-grund', 'Schiffsprüfungen: Grundprüfungen (1–7)',
`## 1 Leinen los
Hafen, Kai, Poller. „Leinen los heißt nicht: alles fallen lassen. Lösen, einholen, klarieren!"
• Festmacher lösen: Geschick/Athletik · Leinen einholen: Stärke/Athletik · Leinen klarieren: Geschick/Wasserfahrzeuge · Schiff vom Steg halten: Stärke/Geschick

## 2 Segel setzen / reffen
„Nicht gegen das Segel kämpfen. Mit dem Wind arbeiten!"
• Mast/Segel: Akrobatik oder Athletik · Leinen: Athletik · Koordination: Wahrnehmung, Überleben oder Wasserfahrzeuge

## 3 Raus aus dem Hafen
„Langsam ist sauber. Sauber ist schnell."
• Steuer: Wasserfahrzeuge/Geschick · Bugwache: Wahrnehmung · Leinen/Bootshaken: Athletik/Geschick

## 4 Ausguck
„Wer zuerst sieht, lebt länger."
• Gefahr erkennen: Wahrnehmung · Wetter deuten: Natur/Überleben · Riff/Strömung: Überleben/Wasserfahrzeuge · fremde Segel: Wahrnehmung/Einsicht

## 5 Navigation
„Das Meer schreibt mit unsichtbarer Tinte."
• Karte: Intelligenz/Geschichte/Wasserfahrzeuge · Sonne/Sterne/Wind: Überleben · Wetter/Vögel/Strömung: Natur · Magie: Arkana

## 6 Anker werfen / aufholen
„Ein Anker ist kein Stein an einer Kette. Der muss halten."
• Aufholen: Stärke/Athletik · richtig setzen: Wasserfahrzeuge/Überleben · Tiefe/Grund: Wahrnehmung/Natur/Überleben · zweite Person hilft mit Vorteil

## 7 Sicher ankommen
„Nicht den Steg fangen. Das Schiff soll neben den Steg."
• Steuer: Wasserfahrzeuge/Geschick · Leinen: Athletik/Geschick · Ansage: Wahrnehmung/Überleben`],
  ['schiff-notfall', 'Schiffsprüfungen: Notfallprüfungen',
`Nur einsetzen, wenn eine Reisekarte, ein Fehlschlag oder eine dramatische Szene es auslöst.

## Reparatur
Gerissenes Tau, Segelriss, Rumpfschramme. „Nicht schön machen. Haltbar machen."
• Segel flicken: Fingerfertigkeit/Handwerk · Tauwerk ersetzen: Geschick/Athletik · Rumpf abdichten: Handwerk/Stärke · Schaden analysieren: Wahrnehmung/Untersuchung

## Leck
Wasser im Bauch, Eimerkette, Panik unter Deck. „Einer stopft, einer schöpft, einer hört auf zu schreien!"
• Abdichten: Handwerk/Stärke · Schöpfen: Athletik/Konstitution · Koordinieren: Überleben/Einschüchtern/Überreden

## Sturm sichern
„Segel runter, Ladung fest, Köpfe einziehen!"
• Ladung sichern: Athletik/Geschick · Deck räumen: Wahrnehmung/Handwerk · Crew sichern: Überleben/Athletik · Wetter einschätzen: Natur/Überleben

## Mann über Bord
„Augen auf ihn! Wer ihn aus den Augen verliert, verliert ihn ganz."
• im Blick behalten: Wahrnehmung · Rettungsleine werfen: Geschick/Athletik · Schiff beidrehen: Wasserfahrzeuge/Navigation · herausziehen: Stärke/Athletik

## Verfolgung
Piraten, dunkle Segel, mehr Fahrt. „Mehr Tuch, besserer Kurs — oder bessere Gebete."
• Segel: Akrobatik/Athletik · Kurs: Navigation/Überleben · Täuschung: Täuschung/Wasserfahrzeuge · Ballast/Ladung: Stärke/Gruppenentscheidung

## Nebel
„Im Nebel fährt man nicht mit den Augen. Man fährt mit Ohren, Händen und Nerven."
• Lauschen: Wahrnehmung · langsam steuern: Wasserfahrzeuge/Geschick · Tiefe prüfen: Überleben/Handwerk · magische Störung: Arkana/Religion`],
];

const cheat = [
  ['cheat-grund', 'Cheat: Grundmechanik & SG',
`## Kürzel
• **SG/DC** Schwierigkeitsgrad · **RK/AC** Rüstungsklasse · **THP** temporäre TP (zuerst verbraucht) · **RW/Save** Rettungswurf · **PB** Übungsbonus
• **Vorteil:** 2× d20, besseres Ergebnis · **Nachteil:** 2× d20, schlechteres

## Formeln
• **Probe:** d20 + Attribut + ggf. PB gegen SG
• **Angriff:** d20 + Angriffsbonus gegen RK; bei Treffer Schaden würfeln
• **RW:** d20 + Attributsmod + ggf. PB gegen SG
• **Zauber-SG:** 8 + PB + Zauberattribut · **Zauberangriff:** d20 + PB + Zauberattribut

## Typische SG
• **5** sehr leicht (fast nur bei Stress) · **10** leicht · **15** mittel, echte Herausforderung · **20** schwer (Talent/Glück) · **25+** fast unmöglich`,],
  ['cheat-kampf', 'Cheat: Kampfablauf & Aktionen',
`## Reihenfolge
• 1 Überraschung klären (Überraschte handeln in Runde 1 nicht)
• 2 Initiative (höchste zuerst) · 3 Zug: Bewegung + Aktion + ggf. Bonusaktion, frei kombinierbar
• 4 Reaktionen: 1 pro Runde, zurück zu Beginn des eigenen Zuges · 5 Rundenende → neue Runde

## Ressourcen im Zug
• **Aktion:** Angriff, Zauber, Spurt, Rückzug, Ausweichen, Helfen, Verstecken, Vorbereiten
• **Bewegung:** teilbar vor/nach/zwischen Angriffen; Aufstehen kostet halbe Bewegung
• **Bonusaktion:** nur wenn ausdrücklich erlaubt · **Freie Interaktion:** Waffe ziehen, Tür öffnen · **Reaktion:** Gelegenheitsangriff, Schild-Zauber

## Häufige Aktionen
• **Spurt:** zusätzliche Bewegung · **Rückzug:** keine Gelegenheitsangriffe · **Ausweichen:** Angriffe gegen dich mit Nachteil, GES-RW mit Vorteil
• **Helfen:** Verbündeter erhält Vorteil · **Verstecken:** Heimlichkeit gegen passive Wahrnehmung · **Vorbereiten:** Auslöser + Handlung; Ausführung kostet Reaktion

## Bewegung Spezial
• Schwieriges Gelände/Klettern/Schwimmen: doppelte Kosten · Gelegenheitsangriff: wenn Ziel freiwillig Nahkampfreichweite verlässt (nicht bei Teleport/erzwungen)`],
  ['cheat-tod', 'Cheat: Tod, Zustände & Konzentration',
`## Tod & Stabilisieren (bei 0 TP)
Bewusstlos, liegend. Zu Zugbeginn Todesrettungswurf: 10+ Erfolg, 1–9 Fehlschlag, Nat 20 = 1 TP & wach, Nat 1 = 2 Fehlschläge. 3 Erfolge → stabil; 3 Fehlschläge → tot. Heilung beendet alles. Schaden bei 0 TP = 1 Fehlschlag (Krit 2; Nahkampf aus 1,5 m meist Krit). Stabil ohne Heilung: nach 1W4 Std. 1 TP.

## Zustände (Kurzfassung)
• **Blind:** eigene Angriffe Nachteil, gegen dich Vorteil · **Bezaubert:** kann Bezauberer nicht angreifen
• **Verängstigt:** Nachteil solange Quelle sichtbar, nicht näher · **Gepackt:** Bewegung 0 · **Handlungsunfähig:** keine Aktionen/Reaktionen
• **Unsichtbar:** Angriffe gegen dich Nachteil, eigene Vorteil · **Gelähmt/Betäubt:** handlungsunfähig, Treffer aus 1,5 m kritisch (gelähmt)
• **Vergiftet:** Nachteil auf Angriffe & Proben · **Liegend:** Nahkampf gegen dich Vorteil, Fernkampf Nachteil
• **Festgesetzt:** Bewegung 0, gegen dich Vorteil, eigene Nachteil · **Bewusstlos:** handlungsunfähig, liegend, Treffer aus 1,5 m kritisch

## Konzentration
Nur ein Konzentrationszauber. Endet freiwillig, bei anderem Konz.-Zauber, Bewusstlosigkeit oder verpatztem KON-RW. **Bei Schaden:** KON-RW gegen SG 10 oder halber Schaden — was höher ist.

## Resistenz / Immunität / Verwundbarkeit
Halber / kein / doppelter Schaden (nach Modifikatoren; abrunden).`],
  ['cheat-schaden', 'Cheat: Schadenarten',
`Offiziell nicht automatisch besser/schlechter — relevant bei Resistenz/Immunität/Verwundbarkeit. Hinweise fürs Improvisieren:

## Physisch
• **Hieb:** Schwerter, Äxte, Klauen — gut gegen Seile, Netze; schwach gegen harte Panzer
• **Stich:** Pfeile, Speere, Bisse — gut gegen weiche Ziele; unpraktisch gegen Skelette, Schleime
• **Wucht:** Keulen, Sturz — stark gegen Knochen, Skelette, sprödes Material, Türen

## Elementar & Magie
• **Feuer:** gut gegen trockenes Holz, Öl, Regeneration · **Kälte:** Verlangsamung; schlecht gg. Eiswesen/Untote
• **Blitz:** passt bei Metall/Wasser · **Donner:** Schall/Druckwelle — Glas, instabile Strukturen, laut!
• **Säure:** Metall, Rüstungsteile · **Gift:** häufig schlecht gg. Untote/Konstrukte — viele immun
• **Nekrotisch:** Lebensentzug; Untote oft resistent · **Strahlend:** stark gg. Untote/Fiends; stoppt manche Regeneration
• **Psychisch:** schlecht gg. geistlose Wesen · **Macht/Force:** sehr selten resistiert
• Sonderworte: „Heilig" ≈ Strahlend, „Dunkel" ≈ Nekrotisch`],
  ['cheat-sl', 'Cheat: Deckung, Sicht & SL-Faustregeln',
`## Deckung & Sicht
• **Halbe Deckung:** +2 RK & GES-RW · **Dreiviertel:** +5 · **Volle:** nicht anvisierbar
• **Dämmerlicht:** Nachteil auf Sicht-Wahrnehmung · **Dunkelheit:** effektiv blind · **Dunkelsicht:** Dunkelheit wie Dämmerlicht, keine Farben

## SL-Faustregeln
• **Unklar?** Passende Probe SG 10–15; nur würfeln, wenn Scheitern interessant ist
• **Gute Idee** → Vorteil oder SG senken · **Schlechte Umstände** → Nachteil oder SG erhöhen
• **Kampf zu leicht** → Verstärkung, Gelände, neues Ziel, Timer · **zu schwer** → Gegner flieht, macht Fehler, verhandelt
• **Impro-Gegner:** Angriff +4 bis +6; Schaden 1W6–2W6
• **Schaden:** klein 1W4/1W6 · mittel 1W8/2W6 · stark 2W8/3W6

## Maritime Proben
• Anker hochziehen: Stärke/Athletik · Tau festmachen: GES oder STR · Segel setzen: Akrobatik/Athletik
• Kurs halten: Überleben/Wasserfahrzeuge · Sturm erkennen: Wahrnehmung/Überleben · Untiefe erkennen: Wahrnehmung
• Reparatur: Werkzeuge/GES/INT · Crew beruhigen: Charisma/Überzeugen · Enterhaken: STR oder GES
• Nasses Deck: GES-RW SG 10–13 gegen Ausrutschen`],
];

const handouts = [
  ...orte.map(([slug, title, body]) => handout(slug, 'Orte', title, body)),
  ...kampagne.map(([slug, title, body]) => handout(slug, 'Kampagne', title, body)),
  ...briefe.map(([slug, title, body]) => handout(slug, 'Briefe & Prüfung', title, body)),
  ...schiff.map(([slug, title, body]) => handout(slug, 'Schiffsprüfungen', title, body)),
  ...cheat.map(([slug, title, body]) => handout(slug, 'Cheat-Sheet', title, body)),
];

// ---------------------------------------------------------------------------
// Überfahrtskarten-Decks (3 Kategorien × 8 Karten)
// ---------------------------------------------------------------------------
const card = (slug, title, beschreibung, frage, pruefungen, folgen) => ({
  id: id(`card-${slug}`),
  title,
  body: `${beschreibung}\n\n**Frage:** ${frage}\n\n**Prüfungen:** ${pruefungen}\n\n**Folgen:** ${folgen}`,
});

const decks = [
  {
    id: id('deck-gute-see'),
    name: 'Gute See',
    color: '#2e8b6a',
    cards: [
      card('gs1', 'Rückenwind', 'Der Wind steht günstig und trägt euch sauber voran.', 'Was macht ihr mit dem Vorteil?', 'Segel · Navigation', 'Zeitgewinn, Bonus, Übermut'),
      card('gs2', 'Klare Sicht', 'Horizont, Landmarken und Wetterzeichen liegen offen vor euch.', 'Nutzt ihr die Übersicht?', 'Ausguck · Navigation', 'Kursbonus, Gefahr früh erkannt'),
      card('gs3', 'Ruhige See', 'Kaum Wellengang, das Schiff liegt ruhig und berechenbar im Wasser.', 'Wofür nutzt ihr die Ruhe?', 'Reparatur · Ausguck · Vorräte', 'Vorbereitung, Training, kleine Vorteile'),
      card('gs4', 'Günstige Strömung', 'Die See schiebt euch in die richtige Richtung.', 'Nutzt ihr die Strömung aus?', 'Navigation', 'Zeitgewinn, Abdrift bei Fehlgriff'),
      card('gs5', 'Freundliche Segel', 'Ein Händler oder Fischer kreuzt euren Weg und wirkt friedlich.', 'Geht ihr in Kontakt?', 'Ausguck · Sozial · Navigation', 'Gerüchte, Handel, Warnungen'),
      card('gs6', 'Treibgut voraus', 'Kisten, Holz oder Stoff treiben in Reichweite vorbei.', 'Bergt ihr etwas davon?', 'Ausguck · Manöver · Geschick', 'Beute, Hinweis, Bergungsrisiko'),
      card('gs7', 'Vogelschwarm', 'Ein Vogelschwarm kreist auffällig über einer Richtung.', 'Folgt ihr dem Zeichen?', 'Ausguck · Natur · Navigation', 'Land, Fisch, Strömung, Abkürzung'),
      card('gs8', 'Sternklare Nacht', 'Der Himmel ist klar — beste Bedingungen für Nachtfahrt und Orientierung.', 'Haltet ihr Kurs durch die Nacht?', 'Navigation · Ausguck', 'Kursbonus, ruhige Wache'),
    ],
  },
  {
    id: id('deck-unruhige-see'),
    name: 'Unruhige See',
    color: '#b07d2e',
    cards: [
      card('us1', 'Schwankender Wind', 'Der Wind dreht ständig und macht sauberes Segeln mühsam.', 'Wie reagiert ihr auf den Wechsel?', 'Segel', 'Zeitverlust oder sauberer Segelbonus'),
      card('us2', 'Flaute', 'Die Segel hängen schlaff, das Schiff kommt kaum voran.', 'Wartet ihr oder werdet ihr kreativ?', 'Navigation · Vorräte · Kreativlösung', 'Stillstand, Umweg, Magie, Rudern'),
      card('us3', 'Nebelschleier', 'Ein dünner Nebel zieht auf und verschluckt langsam die Sicht.', 'Fahrt ihr weiter oder werdet ihr vorsichtig?', 'Ausguck · Navigation', 'Kursabweichung, Sicherheit, Spannung'),
      card('us4', 'Knarrendes Tauwerk', 'Ein Tau wirkt belastet und klingt nicht gesund.', 'Behebt ihr es sofort?', 'Reparatur · Segel', 'Früh gelöst oder späterer Schaden'),
      card('us5', 'Unklare Strömung', 'Das Schiff driftet beinahe unmerklich vom Kurs ab.', 'Wie merkt und korrigiert ihr das?', 'Navigation · Ausguck', 'Kurskorrektur oder falsche Richtung'),
      card('us6', 'Fremde Segel am Horizont', 'Ein anderes Schiff hält Abstand und beobachtet vielleicht.', 'Kontakt, Vorsicht oder Ausweichen?', 'Ausguck · Sozial · Tarnung', 'Misstrauen, Kontakt, Verfolgung'),
      card('us7', 'Schwerer Himmel', 'Dunkle Wolken ziehen auf, doch noch ist nichts entschieden.', 'Bereitet ihr euch vor?', 'Ausguck · Natur · Sturm-Sicherung', 'Vorbereitung oder Sturmfolge'),
      card('us8', 'Flaches Wasser', 'Der Grund kommt näher, das Wasser wirkt tückisch flach.', 'Fahrt ihr vorsichtig weiter?', 'Ausguck · Navigation · Anker', 'Riffgefahr, Umweg, Ankern'),
    ],
  },
  {
    id: id('deck-schwere-see'),
    name: 'Schwere See',
    color: '#a63a3a',
    cards: [
      card('ss1', 'Starker Gegenwind', 'Der Wind steht hart gegen euren Kurs. Direkt voran geht kaum.', 'Kreuzen, Umweg oder etwas anderes?', 'Segel · Navigation', 'Zeitverlust, Segelbelastung, Kursdrama'),
      card('ss2', 'Sturmfront', 'Wind und Wellen bauen sich schnell bedrohlich auf.', 'Wie bereitet ihr das Schiff vor?', 'Segel · Sturm-Sicherung', 'Schaden, Erschöpfung, Kursverlust'),
      card('ss3', 'Dichte Nebelbank', 'Die Sicht bricht fast vollständig weg. Geräusche werden wichtiger als Augen.', 'Wie findet ihr euren Weg?', 'Nebel · Ausguck · Navigation', 'Riff, Geisterschiff, falscher Kurs'),
      card('ss4', 'Riff voraus', 'Brecher verraten scharfe Felsen knapp unter der Oberfläche.', 'Wie bringt ihr das Schiff herum?', 'Ausguck · Steuer · Navigation', 'Rumpfschaden, Leck, Notmanöver'),
      card('ss5', 'Gerissenes Segel', 'Mit einem Knall reißt ein Segel unter Last auf.', 'Wer kümmert sich darum?', 'Segel · Reparatur', 'Tempoverlust, Folgegefahr, Reparatur'),
      card('ss6', 'Piratenzeichen', 'Dunkle Segel ändern Kurs direkt auf euch zu.', 'Flucht, Täuschung oder Kampf?', 'Ausguck · Verfolgung · Täuschung', 'Jagd, Tribut, Enterkampf'),
      card('ss7', 'Mann über Bord', 'Jemand geht ins Wasser. Sekunden zählen.', 'Wie rettet ihr die Person?', 'Mann-über-Bord', 'Rettung, Erschöpfung, Verlust'),
      card('ss8', 'Etwas unter dem Kiel', 'Ein großer Schatten bewegt sich unter eurem Schiff.', 'Wie reagiert ihr?', 'Ausguck · Steuer · Kampf', 'Panik, Schaden, Monsterbegegnung'),
    ],
  },
];

// ---------------------------------------------------------------------------
// Paket schreiben
// ---------------------------------------------------------------------------
const pkg = {
  formatVersion: 1,
  name: 'Blauwasser-Kampagne',
  description:
    'Komplette Spielleiter-Vorbereitung des Blauwasser-Archipels: Orte, NSCs, Quests, Encounter mit Statblocks, Briefe, Schiffsprüfungen, Cheat-Sheet und die Überfahrtskarten-Decks. Quelle: die fünf Vorbereitungs-PDFs, vollständig transkribiert.',
  npcs,
  quests,
  encounters,
  handouts,
  decks,
};

// Ausgabe nach public/, damit Vite es in den Build kopiert und die deployte
// Seite es unter <base>blauwasser-paket.json zum Import anbietet.
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'blauwasser-paket.json');
writeFileSync(out, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(
  `geschrieben: ${out}\n` +
  `${npcs.length} NSCs · ${quests.length} Quests · ${encounters.length} Encounter · ` +
  `${handouts.length} Handouts · ${decks.length} Decks (${decks.reduce((n, d) => n + d.cards.length, 0)} Karten)`,
);
