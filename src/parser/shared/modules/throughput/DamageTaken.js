import React from 'react';
import { XYPlot, AreaSeries } from 'react-vis';
import { AutoSizer } from 'react-virtualized';
import 'react-vis/dist/style.css';

import { formatPercentage, formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import groupDataForChart from 'common/groupDataForChart';
import MAGIC_SCHOOLS from 'game/MAGIC_SCHOOLS';
import rankingColor from 'common/getRankingColor';
import StatisticBar from 'interface/report/Results/statistics/StatisticBar';
import STATISTIC_ORDER from 'interface/others/STATISTIC_ORDER';
import Analyzer from 'parser/core/Analyzer';

import DamageValue from '../DamageValue';

class DamageTaken extends Analyzer {
  static IGNORED_ABILITIES = [
    SPELLS.SPIRIT_LINK_TOTEM_REDISTRIBUTE.id,
  ];

  _total = new DamageValue(); // consider this "protected", so don't change this from other modules. If you want special behavior you must add that code to an extended version of this module.
  get total() {
    return this._total;
  }

  bySecond = {};

  _byAbility = {};
  byAbility(spellId) {
    if (!this._byAbility[spellId]) {
      return new DamageValue();
    }
    return this._byAbility[spellId];
  }

  _byMagicSchool = {};
  byMagicSchool(magicSchool) {
    if (!this._byMagicSchool[magicSchool]) {
      return new DamageValue();
    }
    return this._byMagicSchool[magicSchool];
  }

  on_toPlayer_damage(event) {
    this._addDamage(event, event.amount, event.absorbed, event.blocked, event.overkill);
  }

  _addDamage(event, amount = 0, absorbed = 0, blocked = 0, overkill = 0) {
    const spellId = event.ability.guid;
    if (this.constructor.IGNORED_ABILITIES.includes(spellId)) {
      // Some player abilities (mostly of healers) cause damage as a side-effect, these shouldn't be included in the damage taken.
      return;
    }
    this._total = this._total.add(amount, absorbed, blocked, overkill);

    if (this._byAbility[spellId]) {
      this._byAbility[spellId] = this._byAbility[spellId].add(amount, absorbed, blocked, overkill);
    } else {
      this._byAbility[spellId] = new DamageValue(amount, absorbed, blocked, overkill);
    }

    const magicSchool = event.ability.type;
    if (this._byMagicSchool[magicSchool]) {
      this._byMagicSchool[magicSchool] = this._byMagicSchool[magicSchool].add(amount, absorbed, blocked, overkill);
    } else {
      this._byMagicSchool[magicSchool] = new DamageValue(amount, absorbed, blocked, overkill);
    }

    const secondsIntoFight = Math.floor((event.timestamp - this.owner.fight.start_time) / 1000);
    this.bySecond[secondsIntoFight] = (this.bySecond[secondsIntoFight] || new DamageValue()).add(amount, absorbed, blocked, overkill);
  }
  _subtractDamage(event, amount = 0, absorbed = 0, blocked = 0, overkill = 0) {
    return this._addDamage(event, -amount, -absorbed, -blocked, -overkill);
  }

  get tooltip() {
    const physical = (this._byMagicSchool[MAGIC_SCHOOLS.ids.PHYSICAL]) ? this._byMagicSchool[MAGIC_SCHOOLS.ids.PHYSICAL].effective : 0;
    const magical = this.total.effective - physical;
    return `Damage taken by type:
      <ul>
      <li><b>Physical</b>: ${formatThousands(physical)} (${formatPercentage(physical / this.total.effective)}%)</li>
      <li><b>Magic</b>: ${formatThousands(magical)} (${formatPercentage(magical / this.total.effective)}%)</li>
      </ul>
      Damage taken by magic school:
      <ul>
        ${Object.keys(this._byMagicSchool)
      .filter(type => this._byMagicSchool[type].effective !== 0)
      .map(type => `<li><b>${MAGIC_SCHOOLS.names[type] || 'Unknown'}</b>: ${formatThousands(this._byMagicSchool[type].effective)} (${formatPercentage(this._byMagicSchool[type].effective / this.total.effective)}%)</li>`
      )
      .join('')}
      </ul>
      Click the bar to switch between simple and detailed mode.`;
  }

  showStatistic = true;
  statistic() {
    if (!this.showStatistic) {
      return null;
    }

    const groupedData = groupDataForChart(this.bySecond, this.owner.fightDuration);

    return (
      <StatisticBar
        position={STATISTIC_ORDER.CORE(0.3)}
        wide
      >
        <div className="flex">
          <div className="flex-sub" style={{ background: 'rgba(0, 0, 0, 0.1)' }}>
            <img
              src="/img/shield.png"
              alt="Damage taken"
              style={{ height: '1em', verticalAlign: 'baseline' }}
            />
          </div>
          <div
            className="flex-sub"
            style={{ fontWeight: 500, width: 190, textAlign: 'center' }}
            data-tip={`Total damage taken: <b>${formatThousands(this.total.effective)}</b>`}
          >
            {formatThousands(this.total.effective / this.owner.fightDuration * 1000)} DTPS
          </div>
          <div className={`flex-sub ${rankingColor(0)}`} style={{ padding: '10px 30px', visibility: 'hidden' }}>
            {formatPercentage(0.1, 0)}%
          </div>
          <div className="flex-main" style={{ padding: 0 }}>
            <AutoSizer>
              {({ width, height }) => (
                <XYPlot
                  margin={0}
                  width={width}
                  height={height}
                >
                  <AreaSeries
                    data={Object.keys(groupedData).map(x => ({
                      x: x / width,
                      y: groupedData[x],
                    }))}
                    className="primary"
                  />
                </XYPlot>
              )}
            </AutoSizer>
          </div>
        </div>
      </StatisticBar>
    );
  }
}

export default DamageTaken;
