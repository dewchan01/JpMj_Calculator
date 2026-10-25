export interface SettingField {
  key: string;
  label: string;
  type: 'number' | 'select' | 'checkbox' | 'text';
  hint?: string;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  threeOnly?: boolean;
}
const number = (
  key: string,
  label: string,
  hint: string,
  max = 100000,
  step = 100,
): SettingField => ({ key, label, hint, type: 'number', min: 0, max, step });
const check = (key: string, label: string, hint?: string): SettingField => ({
  key,
  label,
  hint,
  type: 'checkbox',
});
const select = (
  key: string,
  label: string,
  options: [string | number, string][],
  hint?: string,
): SettingField => ({
  key,
  label,
  hint,
  type: 'select',
  options: options.map(([value, label]) => ({ value, label })),
});
export const settingGroups: { title: string; fields: SettingField[] }[] = [
  {
    title: 'Game progress',
    fields: [
      select(
        'extension',
        'Extension round',
        [
          ['none', 'No extension'],
          ['one-round', 'One extra wind round'],
        ],
        'If nobody reaches the return score at the scheduled end, play one extra wind round. The first completed hand reaching the target ends it; the extra round is the limit.',
      ),
      select(
        'bankruptcy',
        'End below zero',
        [
          ['negative', 'End below 0'],
          ['nonpositive', 'End at 0 or below'],
          ['off', 'Continue with negative points'],
        ],
        'This controls bankruptcy ending, not an additional bonus or penalty.',
      ),
    ],
  },
  {
    title: 'Score settings',
    fields: [
      number(
        'startingPoints',
        'Starting points',
        'Points each player receives when a new table is created.',
      ),
      number(
        'returnPoints',
        'Return score',
        'Subtract this from the final points, then divide by 1,000. The starting/return difference (Oka) goes to first place.',
      ),
      number(
        'notenPool',
        'Noten penalty pool',
        'Total transferred from Noten to Tenpai players on an exhaustive draw. Default: 3,000 for 4P or 2,000 for 3P. Nobody pays when all or none are Tenpai.',
      ),
      number('honbaRon', 'Honba: Ron payment', 'Added to the discarder payment for each Honba.'),
      number(
        'honbaTsumo',
        'Honba: Tsumo per payer',
        'Each opponent adds this amount for each Honba.',
      ),
      number(
        'yakitoriPenalty',
        'Yakitori penalty per opponent',
        'At game end, each player with no recorded wins pays this amount to every other player. Set 0 to disable.',
      ),
    ],
  },
  {
    title: 'Result settings',
    fields: [
      number(
        'uma1',
        'Uma: first',
        'Ranking bonus in final score units, not raw table points. All Uma values must total zero.',
        1000,
        1,
      ),
      number('uma2', 'Uma: second', 'Example for 4P: +20, +10, -10, -20.', 1000, 1),
      number('uma3', 'Uma: third', 'For 3P, enter exactly three values totaling zero.', 1000, 1),
      number('uma4', 'Uma: fourth', 'Used only for 4P.', 1000, 1),
      select(
        'rounding',
        'Rounding for final scores',
        [
          ['none', 'Keep decimals'],
          ['nearest', 'Nearest whole score'],
          ['floor', 'Round down'],
          ['ceil', 'Round up'],
        ],
        'Round after Oka and Uma. Any rounding difference goes to first place so final scores still total zero.',
      ),
      select(
        'tiedRanks',
        'Rank for same score',
        [
          ['seat-order', 'Initial seat order'],
          ['share', 'Share tied places'],
        ],
        'Seat order breaks ties from the initial East seat. Shared places average the tied Uma values and share first-place Oka.',
      ),
    ],
  },
  {
    title: 'Betting & chips',
    fields: [
      number(
        'bettingRate',
        'Money per final score unit',
        '0 disables money conversion. Example: final score +12.5 at rate 2 gives +25 money units.',
        100000,
        0.01,
      ),
      {
        key: 'currency',
        label: 'Currency label',
        type: 'text',
        hint: 'Optional label, such as JPY or points. The app only calculates balances; it does not send payments.',
      },
      number(
        'chipValue',
        'Money per chip',
        'Final money = final score × rate + net chips × chip value. Set 0 to disable chip money.',
        100000,
        0.01,
      ),
      number(
        'chipRed',
        'Chips per red five',
        'Ron: the discarder pays. Tsumo: each opponent pays the chip amount. Chips are separate from table points.',
        1000,
        1,
      ),
      number(
        'chipUra',
        'Chips per Ura Dora',
        'Counts actual Ura bonus tiles in the scored hand, not the number of indicators.',
        1000,
        1,
      ),
      number(
        'chipIppatsu',
        'Chips for Ippatsu',
        'Awarded only when Ippatsu is valid in the calculated hand.',
        1000,
        1,
      ),
      number(
        'chipYakuman',
        'Chips per Yakuman',
        'Multiplied by the scored Yakuman count. Set 0 for no Yakuman chips.',
        1000,
        1,
      ),
      check(
        'chipsOnOpenHands',
        'Award tile chips on open hands',
        'When off, red-five and Ura chips require a closed hand. Yakuman chips still apply.',
      ),
    ],
  },
  {
    title: 'Detailed rules',
    fields: [
      select(
        'waremeMultiplier',
        'Wareme multiplier',
        [
          [1, 'Disabled'],
          [2, 'Double'],
          [4, 'Quadruple'],
        ],
        'Choose the Wareme player for each hand. Hand payments involving that player are multiplied; Riichi escrow and Noten transfers are unchanged.',
      ),
      check(
        'allowNegativeRiichi',
        'Riichi when below zero',
        'When enabled, a 1,000-point Riichi deposit may make the player negative. Bankruptcy ending is checked at hand settlement.',
      ),
      check(
        'dealerPassAfterWin',
        'Dealer passes after a win',
        'Advance the dealer even when the dealer wins. Draw continuation still follows Tenpai.',
      ),
      check(
        'dealerFinish',
        'Dealer may finish in first place',
        'On the last scheduled hand or an extension, a first-place dealer reaching the return score may finish after a win or Tenpai draw.',
      ),
      select(
        'riichiReceiver',
        'Riichi pot receiver',
        [
          ['nearest', 'Nearest Ron winner'],
          ['split', 'Split among Ron winners'],
        ],
        'For multiple Ron, nearest means closest after the discarder. Split uses 100-point shares; remainder goes to the nearest winners.',
      ),
      select(
        'finalRiichiReceiver',
        'Unclaimed pot at game end',
        [
          ['first', 'First place'],
          ['split-top', 'Share among tied leaders'],
        ],
        'Awards any remaining table escrow at game end. The award is part of the reversible final settlement.',
      ),
      select('multipleRon', 'Multiple Ron', [
        ['all', 'All winners, including triple Ron'],
        ['triple-draw', 'Double Ron; triple Ron aborts'],
        ['head-bump', 'Nearest winner only (head-bump)'],
      ]),
      select('pao', 'Responsibility payments', [
        ['component', 'Liable Yakuman component only'],
        ['whole-hand', 'Whole combined Yakuman hand'],
        ['off', 'Disabled'],
      ]),
      select('kazoe', 'Counted limit (13+ Han)', [
        ['yakuman', 'Counted Yakuman'],
        ['sanbaiman', 'Sanbaiman'],
      ]),
      check('doubleYakuman', 'Double Yakuman for special forms'),
      check('stackYakuman', 'Combine multiple Yakuman'),
      check('redFives', 'Red fives enabled'),
      check('kokushiAnkanRon', 'Allow Kokushi Ron on Ankan'),
      check('kitaRinshan', 'Kita replacement awards Rinshan'),
      check('kiriage', 'Kiriage Mangan'),
      check('openTanyao', 'Open Tanyao'),
    ],
  },
  {
    title: 'Other',
    fields: [
      {
        ...select(
          'tsumoMode',
          'Tsumo payment',
          [
            ['loss', 'With Tsumo loss'],
            ['no-loss', 'Without Tsumo loss'],
            ['equal', 'Split payment (ignore dealer)'],
            ['equal-dealer', 'Split payment (keep dealer bonus)'],
          ],
          '3P Mangan: with Tsumo loss, a non-dealer receives 4,000 + 2,000; without loss, 5,000 + 3,000. Both split modes pay 4,000 each for a non-dealer. For a dealer, ignore dealer pays 4,000 each; keep dealer bonus pays 6,000 each.',
        ),
        threeOnly: true,
      },
      select(
        'paymentUnit',
        'No 100-point sticks',
        [
          [100, 'Use 100-point units'],
          [1000, 'Round payments up to 1,000'],
        ],
        'When enabled, round each hand payment upward after Honba and Wareme: 1,100 becomes 2,000. Riichi escrow and Noten exchanges keep their configured amounts.',
      ),
    ],
  },
];
for (const field of settingGroups.flatMap((group) => group.fields))
  if (field.key.startsWith('uma')) field.min = -1000;
