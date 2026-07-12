/**
 * Menschlich lesbare Kurzbeschreibung eines Events für Timeline/Sidepanel.
 * Bewusst knapp — die Timeline (M4) bekommt später eine reichere Darstellung.
 */

import type { GameEvent } from '../../types';

export function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case 'campaign.created':
      return `Kampagne "${e.payload.name}" angelegt`;
    case 'campaign.renamed':
      return `Kampagne umbenannt in "${e.payload.name}"`;
    case 'world.dayAdvanced':
      return `Spielwelt-Uhr auf Tag ${e.payload.to.day} gestellt`;
    case 'world.timeOfDayChanged':
      return 'Tageszeit weitergestellt';
    case 'session.started':
      return 'Session gestartet';
    case 'session.ended':
      return 'Session beendet';
    case 'event.revoked':
      return `Ereignis zurückgenommen${e.payload.reason ? ` (${e.payload.reason})` : ''}`;
    case 'import.applied':
      return `Paket "${e.payload.packageName}" importiert`;
    case 'area.created':
      return `Bereich "${e.payload.area.name}" angelegt`;
    case 'area.updated':
      return 'Bereich geändert';
    case 'mapImage.added':
      return 'Karte hinzugefügt';
    case 'mapImage.updated':
      return 'Karte geändert';
    case 'mapImage.replaced':
      return 'Kartenbild getauscht';
    case 'marker.created':
      return 'Marker gesetzt';
    case 'marker.moved':
      return 'Marker verschoben';
    case 'marker.updated':
      return 'Marker geändert';
    case 'encounter.created':
      return `Encounter "${e.payload.encounter.name}" angelegt`;
    case 'encounter.updated':
      return 'Encounter geändert';
    case 'encounter.placed':
      return 'Encounter auf der Karte platziert';
    case 'encounter.completed':
      return 'Encounter abgeschlossen';
    case 'combat.started':
      return 'Kampf gestartet';
    case 'combat.enemyAdded':
      return `Gegner "${e.payload.enemy.name}" nachgeschoben`;
    case 'combat.initiativeSet':
      return 'Initiative eingetragen';
    case 'combat.turnAdvanced':
      return `Runde ${e.payload.round}, nächster Zug`;
    case 'combat.hpChanged':
      return e.payload.delta < 0 ? `${-e.payload.delta} Schaden` : `${e.payload.delta} geheilt`;
    case 'combat.defeatToggled':
      return e.payload.defeated ? 'Gegner kampfunfähig' : 'Gegner wieder im Kampf';
    case 'combat.ended':
      return 'Kampf beendet';
    case 'statusEffect.added':
      return `Statuseffekt "${e.payload.effect}" hinzugefügt`;
    case 'statusEffect.removed':
      return `Statuseffekt "${e.payload.effect}" entfernt`;
    case 'quest.created':
      return `Quest "${e.payload.quest.name}" angelegt`;
    case 'quest.updated':
      return 'Quest geändert';
    case 'quest.statusChanged':
      return `Quest-Status: ${e.payload.status}`;
    case 'quest.commentAdded':
      return 'Quest-Kommentar hinzugefügt';
    case 'npc.created':
      return `NSC "${e.payload.npc.name}" angelegt`;
    case 'npc.updated':
      return 'NSC geändert';
    case 'npc.commentAdded':
      return 'NSC-Kommentar hinzugefügt';
    case 'character.created':
      return `Charakter "${e.payload.character.name}" angelegt`;
    case 'character.updated':
      return 'Charakter geändert';
    case 'character.sheetUploaded':
      return 'Sheet hochgeladen';
    case 'character.sheetActivated':
      return 'Sheet aktiviert';
    case 'character.sheetDeactivated':
      return 'Sheet deaktiviert';
    case 'character.joinedGroup':
      return 'Gruppe beigetreten';
    case 'character.leftGroup':
      return 'Gruppe verlassen';
    case 'group.created':
      return `Gruppe "${e.payload.group.name}" angelegt`;
    case 'group.updated':
      return 'Gruppe geändert';
    case 'group.moved':
      return `Gruppe weitergezogen (Tag ${e.payload.waypoint.gameDay})`;
    case 'asset.imported':
      return `Datei "${e.payload.asset.fileName}" importiert`;
  }
}
