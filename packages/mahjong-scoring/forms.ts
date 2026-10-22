import { isOutside, kindIndex } from '../mahjong-core/index';
import type { Hand } from '../mahjong-core/index';
import type { Form, Group } from './types';
export function enumerateForms(hand: Hand): Form[] {
  const counts = Array<number>(34).fill(0);
  for (const t of hand.concealedTiles) counts[kindIndex(t.kind)]++;
  const fixed: Group[] = hand.melds.map((m) => ({
    type: m.type === 'chi' ? 'sequence' : m.type === 'pon' ? 'triplet' : 'kan',
    index: Math.min(...m.tiles.map((t) => kindIndex(t.kind))),
    open: m.type !== 'ankan',
  }));
  const forms: Form[] = [];
  if (!fixed.length) {
    if (counts.filter((c) => c === 2).length === 7)
      forms.push({ pair: -1, groups: [], special: 'chiitoitsu' });
    if (
      counts.every((c, i) => (isOutside(i) ? c >= 1 : c === 0)) &&
      counts.filter((c) => c === 2).length === 1
    )
      forms.push({ pair: counts.indexOf(2), groups: [], special: 'kokushi' });
  }
  function sets(groups: Group[], pair: number): void {
    const index = counts.findIndex((c) => c > 0);
    if (index === -1) {
      if (groups.length + fixed.length === 4) forms.push({ pair, groups: [...fixed, ...groups] });
      return;
    }
    if (groups.length + fixed.length >= 4) return;
    if (counts[index] >= 3) {
      counts[index] -= 3;
      sets([...groups, { type: 'triplet', index, open: false }], pair);
      counts[index] += 3;
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index]--;
      counts[index + 1]--;
      counts[index + 2]--;
      sets([...groups, { type: 'sequence', index, open: false }], pair);
      counts[index]++;
      counts[index + 1]++;
      counts[index + 2]++;
    }
  }
  for (let pair = 0; pair < 34; pair++)
    if (counts[pair] >= 2) {
      counts[pair] -= 2;
      sets([], pair);
      counts[pair] += 2;
    }
  return forms;
}
