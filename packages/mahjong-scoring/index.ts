import { isOutside, isTerminal, kindAt, kindIndex, tileLabel, WINDS } from '../mahjong-core/index';
import type { ScoreResult } from '../mahjong-core/index';
import { nextDora, ruleSettings } from '../mahjong-rules/index';
import { enumerateForms } from './forms';
import { basePoints, paymentsFor, responsibilityPayments, responsibilityFor } from './payments';
import type { Form, ScoringInput } from './types';
import { validate } from './validation';
export type { ScoringInput } from './types';
export { basePoints, ceil100, paymentsFor } from './payments';
export function invalid(errors: string[]): ScoreResult {
  return {
    isValid: false,
    errors,
    yaku: [],
    bonusHan: [],
    fu: 0,
    fuBreakdown: [],
    han: 0,
    payments: [],
    playerDeltas: {},
    winnerReceives: 0,
  };
}
export function score(input: ScoringInput): ScoreResult {
  const errors = validate(input);
  if (errors.length) return invalid(errors);
  if (input.manualScore) {
    const { han, fu, yakuman = 0, chips = 0 } = input.manualScore;
    if (
      !Number.isInteger(han) ||
      han < 1 ||
      han > 26 ||
      ![20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110].includes(fu) ||
      !Number.isInteger(yakuman) ||
      yakuman < 0 ||
      yakuman > 6 ||
      !Number.isInteger(chips) ||
      chips < 0 ||
      chips > 1000
    )
      return invalid(['Enter valid total Han, Fu, Yakuman and chips.']);
    if (
      !yakuman &&
      han < 5 &&
      ((fu === 20 &&
        (input.win.method !== 'tsumo' ||
          han < 2 ||
          input.hand.melds.some((meld) => meld.type !== 'ankan'))) ||
        (fu === 25 &&
          (input.hand.melds.length > 0 || han < (input.win.method === 'tsumo' ? 3 : 2))))
    )
      return invalid(['This Han/Fu combination is not valid for the win method.']);
    const limit =
      !yakuman && han >= 13 && ruleSettings(input.rules).kazoe === 'sanbaiman'
        ? { base: 6000, limitName: 'Sanbaiman' }
        : basePoints(han, fu, yakuman, input.rules.kiriage);
    const pao = input.manualScore.pao;
    if (
      pao &&
      (!yakuman ||
        ruleSettings(input.rules).pao === 'off' ||
        !input.players.some(
          (player) => player.id === pao.payerId && player.id !== input.win.winnerId,
        ) ||
        !Number.isInteger(pao.yakuman) ||
        pao.yakuman < 1 ||
        pao.yakuman > yakuman)
    )
      return invalid(['Enter a valid responsibility player and Yakuman share.']);
    const payments = pao
      ? responsibilityFor(
          limit.base,
          ruleSettings(input.rules).pao === 'whole-hand' ? limit.base : pao.yakuman * 8000,
          pao.payerId,
          input,
        )
      : paymentsFor(limit.base, input);
    const playerDeltas = Object.fromEntries(input.players.map((player) => [player.id, 0]));
    for (const payment of payments) {
      if (payment.from !== 'table') playerDeltas[payment.from] -= payment.amount;
      playerDeltas[payment.to] += payment.amount;
    }
    return {
      isValid: true,
      errors: [],
      han: yakuman ? 0 : han,
      fu: yakuman ? 0 : fu,
      yaku: yakuman ? [{ id: 'manual-yakuman', name: 'Yakuman', yakumanMultiplier: yakuman }] : [],
      bonusHan: [],
      fuBreakdown: [],
      limitName: limit.limitName,
      payments,
      playerDeltas,
      winnerReceives: payments.reduce((sum, payment) => sum + payment.amount, 0),
      interpretation: 'Manual Han/Fu',
    };
  }
  const forms = enumerateForms(input.hand);
  if (!forms.length)
    return invalid([
      'Tiles do not form a complete standard hand, seven pairs or thirteen orphans.',
    ]);
  const results: ScoreResult[] = [];
  const winIndex = kindIndex(
    input.hand.concealedTiles.find((t) => t.id === input.win.winningTileId)!.kind,
  );
  const winningKinds = input.win.tenhou
    ? [...new Set(input.hand.concealedTiles.map((t) => kindIndex(t.kind)))]
    : [winIndex];
  for (const winIndex of winningKinds) {
    for (const form of forms) {
      if (form.special) results.push(evaluate(input, form, -2, winIndex));
      else {
        if (form.pair === winIndex) results.push(evaluate(input, form, -1, winIndex));
        form.groups.forEach((g, i) => {
          if (
            i >= input.hand.melds.length &&
            (g.index === winIndex ||
              (g.type === 'sequence' && winIndex >= g.index && winIndex <= g.index + 2))
          )
            results.push(evaluate(input, form, i, winIndex));
        });
      }
    }
  }
  const valid = results
    .filter((r) => r.isValid)
    .sort((a, b) => b.winnerReceives - a.winnerReceives || b.han - a.han || b.fu - a.fu);
  return valid[0] ?? invalid([...new Set(results.flatMap((r) => r.errors))]);
}
function evaluate(
  input: ScoringInput,
  form: Form,
  placement: number,
  winning: number,
): ScoreResult {
  const { hand, win, rules } = input;
  const settings = ruleSettings(rules);
  const result = invalid([]);
  const closed = !hand.melds.some((m) => m.type !== 'ankan');
  const tiles = [...hand.concealedTiles, ...hand.melds.flatMap((m) => m.tiles)];
  const kinds = tiles.map((t) => kindIndex(t.kind));
  const groups = form.groups;
  const seat =
    WINDS[
      (input.players.findIndex((p) => p.id === win.winnerId) -
        input.players.findIndex((p) => p.id === input.dealerId) +
        input.players.length) %
        input.players.length
    ];
  const seatIndex = 27 + WINDS.indexOf(seat),
    roundIndex = 27 + WINDS.indexOf(input.roundWind);
  const add = (id: string, name: string, han: number): void => {
    result.yaku.push({ id, name, han });
  };
  const yakuman = (id: string, name: string, double = false): void => {
    result.yaku.push({ id, name, yakumanMultiplier: double && settings.doubleYakuman ? 2 : 1 });
  };
  const triplets = groups.filter((g) => g.type !== 'sequence');
  const concealedTriplets = groups.filter(
    (g, i) => g.type !== 'sequence' && !g.open && !(win.method === 'ron' && placement === i),
  ).length;
  const dragonSets = triplets.filter((g) => g.index >= 31).length;
  const windSets = triplets.filter((g) => g.index >= 27 && g.index <= 30).length;
  const singleSuit = new Set(kinds.filter((i) => i < 27).map((i) => Math.floor(i / 9))).size === 1;
  const honors = kinds.some((i) => i >= 27);
  const beforeWin = kinds.slice();
  beforeWin.splice(beforeWin.indexOf(winning), 1);
  if (win.tenhou) yakuman('tenhou', 'Blessing of heaven (Tenhou)');
  if (win.chiihou) yakuman('chiihou', 'Blessing of earth (Chiihou)');
  if (form.special === 'kokushi') {
    const specialWait = new Set(beforeWin).size === 13;
    yakuman(
      specialWait ? 'kokushi-13' : 'kokushi',
      specialWait ? 'Thirteen-sided orphans (Kokushi 13 wait)' : 'Thirteen orphans (Kokushi musou)',
      specialWait,
    );
  }
  if (kinds.every((i) => i >= 27)) yakuman('tsuuiisou', 'All honors (Tsuuiisou)');
  if (kinds.every(isTerminal)) yakuman('chinroutou', 'All terminals (Chinroutou)');
  if (kinds.every((i) => [19, 20, 21, 23, 25, 32].includes(i)))
    yakuman('ryuuiisou', 'All green (Ryuuiisou)');
  if (dragonSets === 3) {
    yakuman('daisangen', 'Big three dragons (Daisangen)');
  }
  if (windSets === 4) yakuman('daisuushii', 'Big four winds (Daisuushii)', true);
  if (windSets === 3 && form.pair >= 27 && form.pair <= 30)
    yakuman('shousuushii', 'Little four winds (Shousuushii)');
  if (concealedTriplets === 4) {
    yakuman(
      placement === -1 ? 'suuankou-tanki' : 'suuankou',
      placement === -1
        ? 'Single-wait concealed triplets (Suuankou tanki)'
        : 'Four concealed triplets (Suuankou)',
      placement === -1,
    );
  }
  if (groups.filter((g) => g.type === 'kan').length === 4)
    yakuman('suukantsu', 'Four Kans (Suukantsu)');
  if (closed && hand.melds.length === 0 && singleSuit && !honors) {
    const counts = Array<number>(9).fill(0);
    kinds.forEach((i) => counts[i % 9]++);
    if (counts[0] >= 3 && counts[8] >= 3 && counts.slice(1, 8).every((c) => c >= 1)) {
      const prior = counts.slice();
      prior[winning % 9]--;
      const pure = prior.join() === '3,1,1,1,1,1,1,1,3';
      yakuman(
        pure ? 'junsei-chuuren' : 'chuuren',
        pure ? 'Pure nine gates (Junsei chuuren)' : 'Nine gates (Chuuren poutou)',
        pure,
      );
    }
  }
  if (!settings.stackYakuman && result.yaku.length) {
    const largest = result.yaku.reduce((a, b) =>
      (b.yakumanMultiplier ?? 0) > (a.yakumanMultiplier ?? 0) ? b : a,
    );
    result.yaku = [largest];
  }
  const yakumans = result.yaku.reduce((sum, y) => sum + (y.yakumanMultiplier ?? 0), 0);
  if (!yakumans) {
    if (win.doubleRiichi) add('double-riichi', 'Double Riichi', 2);
    else if (win.riichi) add('riichi', 'Riichi', 1);
    if (win.ippatsu) add('ippatsu', 'Ippatsu', 1);
    if (closed && win.method === 'tsumo') add('menzen-tsumo', 'Closed self-draw (Menzen tsumo)', 1);
    if (win.rinshan) add('rinshan', 'After a Kan (Rinshan kaihou)', 1);
    if (win.chankan) add('chankan', 'Robbing a Kan (Chankan)', 1);
    if (win.haitei) add('haitei', 'Last tile self-draw (Haitei)', 1);
    if (win.houtei) add('houtei', 'Last discard (Houtei)', 1);
    if (kinds.every((i) => !isOutside(i)) && (closed || rules.openTanyao))
      add('tanyao', 'All simples (Tanyao)', 1);
    if (form.special === 'chiitoitsu') add('chiitoitsu', 'Seven pairs (Chiitoitsu)', 2);
    if (!form.special) {
      for (const g of triplets) {
        if (g.index >= 31)
          add(
            `dragon-${g.index}`,
            `${['White', 'Green', 'Red'][g.index - 31]} dragon (Yakuhai)`,
            1,
          );
        if (g.index === seatIndex) add('seat-wind', 'Seat wind (Yakuhai)', 1);
        if (g.index === roundIndex) add('round-wind', 'Round wind (Yakuhai)', 1);
      }
      const wait = waitFu(form, placement, winning);
      const valuePair = form.pair >= 31 || form.pair === seatIndex || form.pair === roundIndex;
      if (closed && groups.every((g) => g.type === 'sequence') && !valuePair && wait === 0)
        add('pinfu', 'No-points hand (Pinfu)', 1);
      const sequences = groups.filter((g) => g.type === 'sequence').map((g) => g.index);
      if (closed) {
        const counts = new Map<number, number>();
        sequences.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1));
        const pairs = [...counts.values()].reduce((n, c) => n + Math.floor(c / 2), 0);
        if (pairs === 2) add('ryanpeikou', 'Two identical sequence pairs (Ryanpeikou)', 3);
        else if (pairs === 1) add('iipeikou', 'Identical sequences (Iipeikou)', 1);
      }
      if ([0, 1, 2, 3, 4, 5, 6].some((n) => [n, n + 9, n + 18].every((i) => sequences.includes(i))))
        add('sanshoku-doujun', 'Mixed triple sequence (Sanshoku doujun)', closed ? 2 : 1);
      if ([0, 9, 18].some((n) => [n, n + 3, n + 6].every((i) => sequences.includes(i))))
        add('ittsu', 'Pure straight (Ittsu)', closed ? 2 : 1);
      if (
        [0, 1, 2, 3, 4, 5, 6, 7, 8].some((n) =>
          [n, n + 9, n + 18].every((i) => triplets.some((g) => g.index === i)),
        )
      )
        add('sanshoku-doukou', 'Mixed triple triplets (Sanshoku doukou)', 2);
      if (triplets.length === 4) add('toitoi', 'All triplets (Toitoi)', 2);
      if (concealedTriplets >= 3) add('sanankou', 'Three concealed triplets (Sanankou)', 2);
      if (groups.filter((g) => g.type === 'kan').length === 3)
        add('sankantsu', 'Three Kans (Sankantsu)', 2);
      if (dragonSets === 2 && form.pair >= 31)
        add('shousangen', 'Little three dragons (Shousangen)', 2);
      const outsideGroups = groups.every((g) =>
        g.type === 'sequence' ? g.index % 9 === 0 || g.index % 9 === 6 : isOutside(g.index),
      );
      if (outsideGroups && isOutside(form.pair) && sequences.length) {
        if (honors) add('chanta', 'Mixed outside hand (Chanta)', closed ? 2 : 1);
        else add('junchan', 'Pure outside hand (Junchan)', closed ? 3 : 2);
      }
    }
    if (kinds.every(isOutside)) add('honroutou', 'All terminals and honors (Honroutou)', 2);
    if (singleSuit)
      add(
        honors ? 'honitsu' : 'chinitsu',
        honors ? 'Half flush (Honitsu)' : 'Full flush (Chinitsu)',
        honors ? (closed ? 3 : 2) : closed ? 6 : 5,
      );
    if (!result.yaku.length)
      return invalid(['No Yaku. Dora, red fives and Kita alone cannot make a hand valid.']);
    const bonusTiles = [...tiles, ...hand.extractedNorthTiles];
    const countIndicators = (indicators: typeof tiles): number =>
      indicators.reduce(
        (n, indicator) =>
          n +
          bonusTiles.filter(
            (t) => kindIndex(t.kind) === nextDora(kindIndex(indicator.kind), rules.playerCount),
          ).length,
        0,
      );
    result.bonusHan = [
      { source: 'Dora (including Kan indicators)', count: countIndicators(input.doraIndicators) },
      { source: 'Ura dora', count: countIndicators(input.uraIndicators) },
      { source: 'Red fives (Aka)', count: tiles.filter((t) => t.isRed).length },
      { source: 'Extracted North (Kita)', count: hand.extractedNorthTiles.length },
    ].filter((b) => b.count > 0);
    result.han =
      result.yaku.reduce((n, y) => n + (y.han ?? 0), 0) +
      result.bonusHan.reduce((n, b) => n + b.count, 0);
    computeFu(input, form, placement, winning, result, seatIndex, roundIndex, closed);
  }
  const limit =
    !yakumans && result.han >= 13 && settings.kazoe === 'sanbaiman'
      ? { base: 6000, limitName: 'Sanbaiman' }
      : basePoints(result.han, result.fu, yakumans, rules.kiriage);
  result.limitName = limit.limitName;
  const responsible = responsibilityPayments(result.yaku, limit.base, input);
  if (typeof responsible === 'string') return invalid([responsible]);
  result.payments = responsible ?? paymentsFor(limit.base, input);
  result.playerDeltas = Object.fromEntries(input.players.map((p) => [p.id, 0]));
  for (const payment of result.payments) {
    if (payment.from !== 'table') result.playerDeltas[payment.from] -= payment.amount;
    result.playerDeltas[payment.to] += payment.amount;
  }
  result.winnerReceives = result.payments.reduce((n, p) => n + p.amount, 0);
  const label = (i: number): string => tileLabel({ id: '', kind: kindAt(i), isRed: false });
  result.interpretation =
    form.special ??
    `${groups.map((g) => `${g.open ? 'open ' : ''}${g.type} ${label(g.index)}`).join(' · ')} · pair ${label(form.pair)}`;
  result.isValid = true;
  return result;
}
function waitFu(form: Form, placement: number, winning: number): number {
  if (placement === -1) return 2;
  const g = form.groups[placement];
  if (!g || g.type !== 'sequence') return 0;
  return winning === g.index + 1 ||
    (g.index % 9 === 0 && winning === g.index + 2) ||
    (g.index % 9 === 6 && winning === g.index)
    ? 2
    : 0;
}
function computeFu(
  input: ScoringInput,
  form: Form,
  placement: number,
  winning: number,
  result: ScoreResult,
  seat: number,
  round: number,
  closed: boolean,
): void {
  if (form.special === 'chiitoitsu') {
    result.fu = 25;
    result.fuBreakdown = [{ reason: 'Seven pairs: fixed', value: 25 }];
    return;
  }
  if (result.yaku.some((y) => y.id === 'pinfu') && input.win.method === 'tsumo') {
    result.fu = 20;
    result.fuBreakdown = [{ reason: 'Pinfu Tsumo: fixed', value: 20 }];
    return;
  }
  const add = (reason: string, value: number): void => {
    if (value) result.fuBreakdown.push({ reason, value });
  };
  add('Base', 20);
  if (closed && input.win.method === 'ron') add('Closed Ron', 10);
  if (input.win.method === 'tsumo') add('Self draw', 2);
  if (form.pair >= 31) add('Dragon pair', 2);
  if (form.pair === seat) add('Seat wind pair', 2);
  if (form.pair === round && !(input.rules.preset === 'm-league' && seat === round))
    add('Round wind pair', 2);
  form.groups.forEach((g, i) => {
    if (g.type === 'sequence') return;
    const open = g.open || (placement === i && input.win.method === 'ron');
    add(
      `${open ? 'Open' : 'Concealed'} ${isOutside(g.index) ? 'terminal/honor' : 'simple'} ${g.type}`,
      2 * (open ? 1 : 2) * (isOutside(g.index) ? 2 : 1) * (g.type === 'kan' ? 4 : 1),
    );
  });
  add('Pair, edge or closed wait', waitFu(form, placement, winning));
  let raw = result.fuBreakdown.reduce((sum, f) => sum + f.value, 0);
  if (raw === 20) {
    add('Open hand minimum', 10);
    raw = 30;
  }
  const rounded = Math.ceil(raw / 10) * 10;
  add('Round up to ten', rounded - raw);
  result.fu = rounded;
}
