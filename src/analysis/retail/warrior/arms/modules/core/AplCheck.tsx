import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warrior';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SpellLink from 'interface/SpellLink';
import { suggestion } from 'parser/core/Analyzer';
import { AnyEvent } from 'parser/core/Events';
import aplCheck, {
  Apl,
  build,
  CheckResult,
  Condition,
  PlayerInfo,
} from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';

const JUGGERNAUT_DURATION = 12000;
const MASSACRE_EXECUTE_THRESHOLD = 0.35;
const DEFAULT_EXECUTE_THRESHOLD = 0.2;

// TODO add spells for non-massacre execute?

// tmy https://www.warcraftlogs.com/reports/Lna7ANqKFbBWkD2Q?fight=20&type=casts&source=376
// bris https://www.warcraftlogs.com/reports/1R9TkvMF7HLPpVdm?fight=19&type=damage-done&source=43
// nezy (opp) https://www.warcraftlogs.com/reports/y9gBTjamNH84vGMZ?fight=26&type=damage-done&source=2
// walhe (col) https://www.warcraftlogs.com/reports/Ft8NByGLZ64AMX2f?fight=14&type=summary&source=12

// don't get mad about the MS procs from Unhinged
const notBladestorming = cnd.not(cnd.buffPresent(SPELLS.BLADESTORM));
// TODO add normalizer for ravager
// use an EventLinkNormalizer to connect damage events to cast events
// use a custom Normalizer to detect all damage events within Xms (3ms? 5ms?) of the ravager damage and convert the linked cast events to freecast events

export const apl = (info: PlayerInfo): Apl => {
  const executeThreshold = info.combatant.hasTalent(TALENTS.MASSACRE_SPEC_TALENT)
    ? MASSACRE_EXECUTE_THRESHOLD
    : DEFAULT_EXECUTE_THRESHOLD;
  const executeUsable = cnd.or(
    cnd.buffPresent(SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF),
    cnd.and(
      cnd.inExecute(executeThreshold),
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atLeast: 200 }),
    ),
  );

  return info.combatant.hasTalent(TALENTS.SLAYERS_DOMINANCE_TALENT)
    ? buildSlayerApl(executeThreshold, executeUsable)
    : buildColossusApl(executeThreshold, executeUsable);
};

export const buildSlayerApl = (executeThreshold: number, executeUsable: Condition<any>): Apl => {
  return build([
    // Exe with 3x MFE, 2x SD, refresh Jugg
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(
        executeUsable,
        notBladestorming,
        cnd.or(
          cnd.debuffStacks(SPELLS.MARKED_FOR_EXECUTION, { atLeast: 3, atMost: 3 }),
          cnd.buffStacks(SPELLS.SUDDEN_DEATH_ARMS_TALENT_BUFF, { atLeast: 2, atMost: 2 }),
          cnd.buffRemaining(SPELLS.JUGGERNAUT, JUGGERNAUT_DURATION, { atMost: 3000 }),
        ),
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
      condition: cnd.optionalRule(
        cnd.and(
          cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 850 }), // rage is logged 10x higher than the player's "real" value
          cnd.inExecute(executeThreshold),
          notBladestorming,
        ),
      ),
      description: (
        <>
          (Optional) Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> while below 85 rage and
          in execute range. You can gamble on getting enough rage from other sources, but on average
          it's best to avoid that.
        </>
      ),
    },

    // MS inside execute
    {
      spell: SPELLS.MORTAL_STRIKE,
      condition: cnd.and(
        cnd.debuffStacks(SPELLS.EXECUTIONERS_PRECISION_DEBUFF, { atLeast: 2 }),
        cnd.buffStacks(SPELLS.LETHAL_BLOWS_BUFF, { atLeast: 1 }),
        cnd.inExecute(executeThreshold),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> while in execute range with 2 stacks of{' '}
          <SpellLink spell={SPELLS.EXECUTIONERS_PRECISION_DEBUFF} /> and{' '}
          <SpellLink spell={SPELLS.LETHAL_BLOWS_BUFF} /> (Nerub-ar Palace tier set buff)
        </>
      ),
    },

    // OP inside execute with Opp
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.buffPresent(SPELLS.OPPORTUNIST),
        cnd.buffStacks(TALENTS.OVERPOWER_TALENT, { atMost: 1 }), // Martial Prowess buff
        cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 800 }),
        cnd.inExecute(executeThreshold),
        notBladestorming,
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

    // OP inside execute with FF
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.hasTalent(TALENTS.FIERCE_FOLLOWTHROUGH_TALENT),
        cnd.buffStacks(TALENTS.OVERPOWER_TALENT, { atMost: 1 }), // Martial Prowess buff
        cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 400 }),
        cnd.inExecute(executeThreshold),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} /> while in execute range with the following
          conditions:
          <ul>
            <li>You are below 40 rage</li>
            <li>
              You have fewer than 2 stacks of{' '}
              <SpellLink spell={TALENTS.OVERPOWER_TALENT}> Martial Prowess</SpellLink>{' '}
            </li>
          </ul>
        </>
      ),
    },

    // Exe in execute
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(executeUsable, cnd.inExecute(executeThreshold), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} /> while in execute range
        </>
      ),
    },

    // OP with FF outside execute
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.hasTalent(TALENTS.FIERCE_FOLLOWTHROUGH_TALENT),
        cnd.spellCharges(SPELLS.OVERPOWER, { atLeast: 2 }),
        notBladestorming,
        cnd.not(cnd.inExecute(executeThreshold)),
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} /> when you have 2 charges available
        </>
      ),
    },

    // OP with Opp outside execute
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.buffPresent(SPELLS.OPPORTUNIST),
        notBladestorming,
        cnd.not(cnd.inExecute(executeThreshold)),
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
      condition: cnd.not(cnd.inExecute(executeThreshold)),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> while outside execute range
        </>
      ),
    },

    // SkS outside execute
    {
      spell: TALENTS.SKULLSPLITTER_TALENT,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> while outside execute range
        </>
      ),
    },

    // filler execute
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(executeUsable, cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} />
        </>
      ),
    },

    // OP
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} />
        </>
      ),
    },

    // Slam
    {
      spell: SPELLS.SLAM,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.SLAM} />
        </>
      ),
    },
  ]);
};

export const buildColossusApl = (executeThreshold: number, executeUsable: Condition<any>): Apl => {
  return build([
    // SkS in exe below 85
    {
      spell: TALENTS.SKULLSPLITTER_TALENT,
      condition: cnd.optionalRule(
        cnd.and(
          cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 850 }), // rage is logged 10x higher than the player's "real" value
          cnd.inExecute(executeThreshold),
          notBladestorming,
        ),
      ),
      description: (
        <>
          (Optional) Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> while below 85 rage and
          in execute range. You can gamble on getting enough rage from other sources, but on average
          it's best to avoid that.
        </>
      ),
    },
    // demolish in exe with csmash - not sure about how cd is handled - maybe make new module

    // MS in exe with 2xEP
    {
      spell: SPELLS.MORTAL_STRIKE,
      condition: cnd.and(
        cnd.debuffStacks(SPELLS.EXECUTIONERS_PRECISION_DEBUFF, { atLeast: 2 }),
        cnd.buffStacks(SPELLS.LETHAL_BLOWS_BUFF, { atLeast: 2 }),
        cnd.inExecute(executeThreshold),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> while in execute range with 2 stacks of{' '}
          <SpellLink spell={SPELLS.EXECUTIONERS_PRECISION_DEBUFF} /> and{' '}
          <SpellLink spell={SPELLS.LETHAL_BLOWS_BUFF} />
        </>
      ),
    },

    // OP in exe with BL, 2 charges, <90 rage
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.hasTalent(TALENTS.BATTLELORD_TALENT),
        cnd.spellCharges(SPELLS.OVERPOWER, { atLeast: 2 }),
        cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 900 }),
        cnd.inExecute(executeThreshold),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} /> in execute range when you have 2 charges
          available and are below 90 rage
        </>
      ),
    },

    // exe in exe with 40 rage and EP
    // https://www.warcraftlogs.com/reports/Ft8NByGLZ64AMX2f?fight=14&type=casts&start=1522716&end=1596691&source=12&pins=0%24Separate%24%23244F4B%24resources%240%24178122636.0.0.Warrior%240.0.0.Any%24true%240.0.0.Any%24true%240%24101&ability=281000
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(
        cnd.hasResource(RESOURCE_TYPES.RAGE, { atLeast: 400 }),
        cnd.hasTalent(TALENTS.EXECUTIONERS_PRECISION_TALENT),
        cnd.inExecute(executeThreshold),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} /> while above 40 rage in execute range
        </>
      ),
    },

    // SkS (in exe)
    {
      spell: TALENTS.SKULLSPLITTER_TALENT,
      condition: cnd.and(cnd.inExecute(executeThreshold), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} /> in execute range
        </>
      ),
    },

    // OP (in exe)
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(cnd.inExecute(executeThreshold), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} /> in execute range
        </>
      ),
    },

    // exe in exe
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(executeUsable, cnd.inExecute(executeThreshold), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} /> in execute range
        </>
      ),
    },

    // MS in exe
    {
      spell: SPELLS.MORTAL_STRIKE,
      condition: cnd.and(cnd.inExecute(executeThreshold), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} /> in execute range
        </>
      ),
    },

    // MS no exe
    {
      spell: SPELLS.MORTAL_STRIKE,
      condition: cnd.not(cnd.inExecute(executeThreshold)),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.MORTAL_STRIKE} />
        </>
      ),
    },

    // demolish no exe - make different module?
    // {
    //   spell: TALENTS.DEMOLISH_TALENT,
    //   condition: cnd.not(cnd.inExecute(executeThreshold)),
    //   description: (
    //     <>
    //       Cast <SpellLink spell={TALENTS.DEMOLISH_TALENT} />
    //     </>
    //   ),
    // },

    // SkS no exe
    {
      spell: TALENTS.SKULLSPLITTER_TALENT,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={TALENTS.SKULLSPLITTER_TALENT} />
        </>
      ),
    },

    // 2op no exe
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(
        cnd.spellCharges(SPELLS.OVERPOWER, { atLeast: 2 }),
        cnd.not(cnd.inExecute(executeThreshold)),
        notBladestorming,
      ),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} /> with 2 charges available
        </>
      ),
    },

    // exe no exe
    {
      spell: SPELLS.EXECUTE_GLYPHED,
      condition: cnd.and(executeUsable, cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.EXECUTE_GLYPHED} />
        </>
      ),
    },

    // OP no exe
    {
      spell: SPELLS.OVERPOWER,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.OVERPOWER} />
        </>
      ),
    },

    // slam
    {
      spell: SPELLS.SLAM,
      condition: cnd.and(cnd.not(cnd.inExecute(executeThreshold)), notBladestorming),
      description: (
        <>
          Cast <SpellLink spell={SPELLS.SLAM} />
        </>
      ),
    },
  ]);
};

export const check = (events: AnyEvent[], info: PlayerInfo): CheckResult => {
  const check = aplCheck(apl(info));
  return check(events, info);
};

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
