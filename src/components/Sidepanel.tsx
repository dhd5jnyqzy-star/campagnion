/**
 * Generisches Sidepanel (Peek, §4.2): Detailansicht der angetippten Entität —
 * Marker, Encounter, NSC, Quest, Bereich, Charakter oder Gruppe — ohne den
 * Viewport zu verändern. "Goto" springt animiert hin und landet im
 * Navigationsstack; das Peeken selbst nicht (§3.2).
 */

import { useAppSelector } from '../app/hooks';
import { AreaPeek } from './panels/AreaPeek';
import { CharacterPeek } from './panels/CharacterPeek';
import { EncounterPeek } from './panels/EncounterPeek';
import { GroupPeek } from './panels/GroupPeek';
import { MarkerPeek } from './panels/MarkerPeek';
import { NpcPeek } from './panels/NpcPeek';
import { QuestPeek } from './panels/QuestPeek';

export function Sidepanel() {
  const peek = useAppSelector((s) => s.nav.peek);
  const game = useAppSelector((s) => s.game.state);
  if (!peek || !game) return null;

  let content: React.ReactNode = null;
  switch (peek.kind) {
    case 'marker': {
      const marker = game.markers[peek.id];
      content = marker && <MarkerPeek marker={marker} />;
      break;
    }
    case 'encounter': {
      const encounter = game.encounters[peek.id];
      content = encounter && <EncounterPeek encounter={encounter} />;
      break;
    }
    case 'npc': {
      const npc = game.npcs[peek.id];
      content = npc && <NpcPeek npc={npc} />;
      break;
    }
    case 'quest': {
      const quest = game.quests[peek.id];
      content = quest && <QuestPeek quest={quest} />;
      break;
    }
    case 'area': {
      const area = game.areas[peek.id];
      content = area && <AreaPeek area={area} />;
      break;
    }
    case 'character': {
      const character = game.characters[peek.id];
      content = character && <CharacterPeek character={character} />;
      break;
    }
    case 'group': {
      const group = game.groups[peek.id];
      content = group && <GroupPeek group={group} />;
      break;
    }
  }
  if (!content) return null;

  return (
    <aside className="sidepanel" key={`${peek.kind}-${peek.id}`}>
      {content}
    </aside>
  );
}
