import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/evoker';
import { formatNumber } from 'common/format';

import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Events, { DamageEvent } from 'parser/core/Events';

import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { HONED_AGGRESSION_MULTIPLIER } from 'analysis/retail/evoker/devastation/constants';
import { SpellLink } from 'interface';
import TalentSpellText from 'parser/ui/TalentSpellText';

const { LIVING_FLAME_DAMAGE, AZURE_STRIKE } = SPELLS;

class HonedAggression extends Analyzer {
  livingFlameDamage: number = 0;
  azureStrikeDamage: number = 0;
  honedAggressionLivingFlameDamage: number = 0;
  honedAggressionAzureDamage: number = 0;
  honedAggressionMultiplier: number = 0;
  trackedSpells = [LIVING_FLAME_DAMAGE, AZURE_STRIKE];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.HONED_AGGRESSION_TALENT);
    const ranks = this.selectedCombatant.getTalentRank(TALENTS.HONED_AGGRESSION_TALENT);
    this.honedAggressionMultiplier = HONED_AGGRESSION_MULTIPLIER * ranks;

    this.addEventListener(Events.damage.by(SELECTED_PLAYER).spell(this.trackedSpells), this.onHit);
  }

  onHit(event: DamageEvent) {
    if (event.ability.name === LIVING_FLAME_DAMAGE.name) {
      this.livingFlameDamage += event.amount;
      if (event.absorbed !== undefined) {
        this.livingFlameDamage += event.absorbed;
      }
    } else if (event.ability.name === AZURE_STRIKE.name) {
      this.azureStrikeDamage += event.amount;
      if (event.absorbed !== undefined) {
        this.azureStrikeDamage += event.absorbed;
      }
    }
  }

  statistic() {
    this.honedAggressionLivingFlameDamage =
      this.livingFlameDamage - this.livingFlameDamage / (1 + this.honedAggressionMultiplier);
    this.honedAggressionAzureDamage =
      this.azureStrikeDamage - this.azureStrikeDamage / (1 + this.honedAggressionMultiplier);

    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(13)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            <li>
              <SpellLink spell={LIVING_FLAME_DAMAGE} /> Damage:{' '}
              {formatNumber(this.honedAggressionLivingFlameDamage)}
            </li>
            <li>
              <SpellLink spell={AZURE_STRIKE} /> Damage:{' '}
              {formatNumber(this.honedAggressionAzureDamage)}
            </li>
          </>
        }
      >
        <TalentSpellText talent={TALENTS.HONED_AGGRESSION_TALENT}>
          <ItemDamageDone
            amount={this.honedAggressionLivingFlameDamage + this.honedAggressionAzureDamage}
          />
        </TalentSpellText>
      </Statistic>
    );
  }
}

export default HonedAggression;
