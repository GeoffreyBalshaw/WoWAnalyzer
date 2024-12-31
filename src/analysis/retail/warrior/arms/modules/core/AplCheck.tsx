import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warrior';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { suggestion } from 'parser/core/Analyzer';
import aplCheck, { build } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';

const JUGGERNAUT_DURATION = 12000;
const MASSACE_EXECUTE_THRESHOLD = 0.35;

// tmy https://www.warcraftlogs.com/reports/Lna7ANqKFbBWkD2Q?fight=20&type=casts&source=376
// bris https://www.warcraftlogs.com/reports/1R9TkvMF7HLPpVdm?fight=19&type=damage-done&source=43
// nezy (opp) https://www.warcraftlogs.com/reports/y9gBTjamNH84vGMZ?fight=26&type=damage-done&source=2
export const apl = build([

  // TODO lots of this assumes Opp, which may not be true
  // Exe with 3x MFE, 2x SD, refresh Jugg
  {
    spell: SPELLS.EXECUTE_GLYPHED,
    condition: cnd.and(
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)),// don't get mad about the MS procs from Unhinged
      // the grammar this outputs is a little funky
      // "... and don't Bladestorm is present"
      cnd.or(
        // cnd.buffStacks(SPELLS.MARKED_FOR_EXECUTION, { atLeast: 3, atMost: 3 }),
        cnd.debuffStacks(SPELLS.MARKED_FOR_EXECUTION, { atLeast: 3, atMost: 3 }),
        cnd.buffStacks(SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF, { atLeast: 2, atMost: 2 }),
        cnd.and(
          cnd.buffRemaining(SPELLS.JUGGERNAUT, JUGGERNAUT_DURATION, { atMost: 6000 }),
          cnd.spellAvailable(SPELLS.EXECUTE_GLYPHED) // just checks for CD, not actually usable
          // TODO figure out how to fix that
        )
      )
    )
  },

  // OP with opp outside execute
  {
    spell: SPELLS.OVERPOWER,
    condition:
      cnd.and(
        cnd.buffPresent(SPELLS.OPPORTUNIST, 500),
        cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
        // the grammar this outputs is a little funky
        // "... and don't Bladestorm is present"
        cnd.not(cnd.inExecute(MASSACE_EXECUTE_THRESHOLD))
      )
  },

  // MS outside execute
  {
    spell: SPELLS.MORTAL_STRIKE,
    condition: cnd.not(
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

  // SkS inside execute
  {
    spell: TALENTS.SKULLSPLITTER_TALENT,
    condition: cnd.and(
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 850 }), // TODO rage values are scaled by 10
      // which I _think_ makes the logic correct,
      // but makes it display oddly
      // "...when you have at most 850 Rage"
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

  // MS inside execute
  {
    spell: SPELLS.MORTAL_STRIKE,
    condition: cnd.and(
      cnd.debuffStacks(SPELLS.EXECUTIONERS_PRECISION_DEBUFF, { atLeast: 2 }),
      cnd.buffStacks(SPELLS.LETHAL_BLOWS_BUFF, { atLeast: 2 }),
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

  // SkS outside execute
  {
    spell: TALENTS.SKULLSPLITTER_TALENT,
    condition: cnd.not(
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

  // OP inside execute with Opp && rage below 80 && under 2 MP
  {
    spell: SPELLS.OVERPOWER,
    condition: cnd.and(
      cnd.buffPresent(SPELLS.OPPORTUNIST, 500),
      cnd.buffStacks(TALENTS.OVERPOWER_TALENT, { atMost: 1 }), // Martial Prowess buff
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 800 }),
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

  // TODO fallthrough execute
  // OP
  SPELLS.OVERPOWER,

  // Slam
  SPELLS.SLAM
]);

export const check = aplCheck(apl);

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
