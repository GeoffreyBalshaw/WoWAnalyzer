import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warrior';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SpellLink from 'interface/SpellLink';
import { suggestion } from 'parser/core/Analyzer';
import aplCheck, { build } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';

const JUGGERNAUT_DURATION = 12000;
const MASSACE_EXECUTE_THRESHOLD = 0.35;

// tmy https://www.warcraftlogs.com/reports/Lna7ANqKFbBWkD2Q?fight=20&type=casts&source=376
// bris https://www.warcraftlogs.com/reports/1R9TkvMF7HLPpVdm?fight=19&type=damage-done&source=43
// nezy (opp) https://www.warcraftlogs.com/reports/y9gBTjamNH84vGMZ?fight=26&type=damage-done&source=2

const executeUsable = cnd.or(
  cnd.buffPresent(SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF),
  cnd.and(
    cnd.inExecute(MASSACE_EXECUTE_THRESHOLD),
    cnd.hasResource(RESOURCE_TYPES.RAGE, { atLeast: 200 }),
  ),
);

export const apl = build([
  // TODO lots of this assumes Opp, which may not be true
  // TODO also assumes you take massacre, which every raid build does currently, but may not in the future

  // Exe with 3x MFE, 2x SD, refresh Jugg
  {
    spell: SPELLS.EXECUTE_GLYPHED,
    condition: cnd.and(
      executeUsable,
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
      cnd.or(
        cnd.debuffStacks(SPELLS.MARKED_FOR_EXECUTION, { atLeast: 3, atMost: 3 }),
        cnd.buffStacks(SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF, { atLeast: 2, atMost: 2 }),
        cnd.buffRemaining(SPELLS.JUGGERNAUT, JUGGERNAUT_DURATION, { atMost: 6000 }),
      ),
      // cnd.not(cnd.inExecute(MASSACE_EXECUTE_THRESHOLD))
    ),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} /> when any of the following conditions are
        met:
        <ul>
          <li>
            Your target has 3 stacks of <SpellLink spell={SPELLS.MARKED_FOR_EXECUTION} />
          </li>
          <li>
            You have 2 stacks of <SpellLink spell={SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF} />
          </li>
          <li>
            Your <SpellLink spell={SPELLS.JUGGERNAUT} /> is about to expire
          </li>
        </ul>
      </>
    ),
  },

  // SkS inside execute
  {
    spell: TALENTS.SKULLSPLITTER_TALENT,
    condition: cnd.and(
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 850 }),
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD),
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
    ),
    description: (
      <>
        Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> while below 85 rage and in execute
        range
      </>
    ),
  },

  // MS inside execute
  {
    spell: SPELLS.MORTAL_STRIKE,
    condition: cnd.and(
      cnd.debuffStacks(SPELLS.EXECUTIONERS_PRECISION_DEBUFF, { atLeast: 2 }),
      cnd.buffStacks(SPELLS.LETHAL_BLOWS_BUFF, { atLeast: 2 }),
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD),
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
    ),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> while in execute range with 2 stacks each of{' '}
        <SpellLink spell={SPELLS.EXECUTIONERS_PRECISION_DEBUFF} /> and{' '}
        <SpellLink spell={SPELLS.LETHAL_BLOWS_BUFF} /> (Nerub-ar Palace tier set buff)
      </>
    ),
  },

  // OP inside execute with Opp && rage below 80 && under 2 MP
  {
    spell: SPELLS.OVERPOWER,
    condition: cnd.and(
      cnd.buffPresent(SPELLS.OPPORTUNIST),
      cnd.buffStacks(TALENTS.OVERPOWER_TALENT, { atMost: 1 }), // Martial Prowess buff
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 800 }),
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD),
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
    ),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.OVERPOWER} /> while in execute range with the following
        conditions:
        <ul>
          <li>
            You have the <SpellLink spell={SPELLS.OPPORTUNIST} /> buff
          </li>
          <li>You are below 80 rage</li>
          <li>
            You have fewer than 2 stacks of{' '}
            <SpellLink spell={TALENTS.OVERPOWER_TALENT}> Martial Prowess</SpellLink>{' '}
          </li>
        </ul>
      </>
    ),
  },

  {
    spell: SPELLS.EXECUTE_GLYPHED,
    condition: cnd.and(
      executeUsable,
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD),
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
    ),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} /> while in execute range
      </>
    ),
  },

  // OP with opp outside execute
  {
    spell: SPELLS.OVERPOWER,
    condition: cnd.and(
      cnd.buffPresent(SPELLS.OPPORTUNIST, 500),
      cnd.not(cnd.buffPresent(SPELLS.BLADESTORM)), // don't get mad about the MS procs from Unhinged
      cnd.not(cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)),
    ),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.OVERPOWER} /> when you have the{' '}
        <SpellLink spell={SPELLS.OPPORTUNIST} /> buff
      </>
    ),
  },

  // MS outside execute
  {
    spell: SPELLS.MORTAL_STRIKE,
    condition: cnd.not(cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)),
    description: (
      <>
        Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> while outside execute range
      </>
    ),
  },

  // SkS outside execute
  {
    spell: TALENTS.SKULLSPLITTER_TALENT,
    condition: cnd.not(cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)),
    description: (
      <>
        Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> while outside execute range
      </>
    ),
  },

  // filler execute
  {
    spell: SPELLS.EXECUTE_GLYPHED,
    condition: executeUsable,
    description: (
      <>
        Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} />
      </>
    ),
  },

  // OP
  SPELLS.OVERPOWER,

  // Slam
  SPELLS.SLAM,
]);

export const check = aplCheck(apl);

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
