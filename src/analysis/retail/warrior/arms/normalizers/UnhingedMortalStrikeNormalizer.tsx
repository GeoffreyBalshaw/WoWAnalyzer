import SPELLS from 'common/SPELLS';
import EventLinkNormalizer, { EventLink } from 'parser/core/EventLinkNormalizer';
import { AnyEvent, CastEvent, EventType, GetRelatedEvents } from 'parser/core/Events';
import { Options } from 'parser/core/Module';

const UNHINGED_MORTAL_STRIKE = 'Unhinged-Mortal-Strike';
const DAMAGE_BUFFER_MS = 5; // triggered MS *should* be at the exact same timestamp, but give some wiggle room

const EVENT_LINKS: EventLink[] = [
  {
    linkRelation: UNHINGED_MORTAL_STRIKE,
    linkingEventId: SPELLS.MORTAL_STRIKE.id,
    linkingEventType: EventType.Cast,
    referencedEventId: SPELLS.RAVAGER_DAMAGE.id,
    referencedEventType: EventType.Damage,
    forwardBufferMs: DAMAGE_BUFFER_MS,
    backwardBufferMs: DAMAGE_BUFFER_MS,
    anyTarget: true,
  },
];

function isUnhingedMortalStrike(event: CastEvent): boolean {
  return GetRelatedEvents(event, UNHINGED_MORTAL_STRIKE).length > 0;
}

class UnhingedMortalStrikeNormalizer extends EventLinkNormalizer {
  constructor(options: Options) {
    super(options, EVENT_LINKS);
  }

  normalize(rawEvents: AnyEvent[]): AnyEvent[] {
    const events = super.normalize(rawEvents);

    events.forEach((event, index) => {
      if (event.type === EventType.Cast && isUnhingedMortalStrike(event)) {
        console.log(event);
        events.splice(index, 1); // remove original cast event
        (event as AnyEvent).type = EventType.FreeCast;
        event.__modified = true;
        events.push(event); // add freecast event
      }
    });
    return events;
  }
}

export default UnhingedMortalStrikeNormalizer;
