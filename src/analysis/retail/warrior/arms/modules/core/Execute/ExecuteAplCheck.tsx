import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warrior';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { suggestion } from 'parser/core/Analyzer';
import aplCheck, { build } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';

const MASSACE_EXECUTE_THRESHOLD = 0.35;
export const executeAPL = build([

// SkS below 85 rage
  {
    spell: TALENTS.SKULLSPLITTER_TALENT,
    condition: cnd.and(
      cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 85 }), 
      cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
    ),
  },

// MS with 2xEP 2xLB (ignoring rend)
{
  spell: SPELLS.MORTAL_STRIKE,
  condition: cnd.and(
    cnd.buffStacks(TALENTS.EXECUTIONERS_PRECISION_TALENT, { atLeast: 2 }), 
    cnd.buffStacks(SPELLS.LETHAL_BLOWS_BUFF, { atLeast: 2 }), 
    cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
  ),
},

// OP with Opp && rage below 80 && under 2 MP
{
  spell: SPELLS.OVERPOWER,
  condition: cnd.and(
    cnd.buffPresent(SPELLS.OPPORTUNIST, -500),
    cnd.buffStacks(TALENTS.MARTIAL_PROWESS_TALENT, { atMost: 1 }), 
    cnd.hasResource(RESOURCE_TYPES.RAGE, { atMost: 80 }), 
    cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
  ),
},

// Exe
//  SPELLS.EXECUTE_GLYPHED, // Execute spell ID with Massacre
{
  spell: SPELLS.EXECUTE_GLYPHED,
  condition: cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
},

// OP
{
  spell: SPELLS.OVERPOWER,
  condition: cnd.inExecute(MASSACE_EXECUTE_THRESHOLD)
},
]);

export const check = aplCheck(executeAPL);

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
