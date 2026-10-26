import type { PlayerAnalysis } from './player-analysis';

// Official 2026-27 regular-season snapshot, retrieved 2026-10-26.
// https://m-league.jp/stats/ . Deliberately versioned for reproducible offline comparisons.
export const mLeagueReference = {
  source: 'https://m-league.jp/stats/',
  date: '2026-10-26',
  season: '2026-27',
  players: [
    {
      name: '佐々木 寿人',
      games: 11,
      hands: 132,
      win: 0.26,
      deal: 0.09,
      open: 0.2,
      riichi: 0.23,
      averageWin: 6305.71,
    },
    {
      name: '高宮 まり',
      games: 7,
      hands: 83,
      win: 0.2,
      deal: 0.06,
      open: 0.26,
      riichi: 0.26,
      averageWin: 6282.35,
    },
    {
      name: '多井 隆晴',
      games: 10,
      hands: 124,
      win: 0.21,
      deal: 0.11,
      open: 0.26,
      riichi: 0.18,
      averageWin: 6111.11,
    },
    {
      name: '白鳥 翔',
      games: 8,
      hands: 105,
      win: 0.16,
      deal: 0.1,
      open: 0.35,
      riichi: 0.18,
      averageWin: 4494.11,
    },
    {
      name: '園田 賢',
      games: 8,
      hands: 99,
      win: 0.19,
      deal: 0.15,
      open: 0.28,
      riichi: 0.28,
      averageWin: 5984.21,
    },
    {
      name: '渡辺 太',
      games: 10,
      hands: 115,
      win: 0.26,
      deal: 0.11,
      open: 0.39,
      riichi: 0.17,
      averageWin: 7370,
    },
    {
      name: '黒沢 咲',
      games: 8,
      hands: 92,
      win: 0.18,
      deal: 0.16,
      open: 0.16,
      riichi: 0.25,
      averageWin: 6876.47,
    },
    {
      name: '瀬戸熊 直樹',
      games: 8,
      hands: 109,
      win: 0.35,
      deal: 0.11,
      open: 0.19,
      riichi: 0.31,
      averageWin: 6112.82,
    },
  ],
};
const dimensions = [
  { key: 'win', scale: 0.1, label: 'Win rate' },
  { key: 'deal', scale: 0.08, label: 'Deal-in rate' },
  { key: 'open', scale: 0.2, label: 'Open hand rate' },
  { key: 'riichi', scale: 0.2, label: 'Riichi rate' },
  { key: 'averageWin', scale: 4000, label: 'Average win score' },
] as const;
export function leagueResemblance(analysis: PlayerAnalysis) {
  const observed = analysis.hands.filter(
    (hand) => hand.riichi !== null && hand.open !== null && hand.win !== null && hand.deal !== null,
  );
  if (analysis.count !== 4 || observed.length < 20) return [];
  const available = dimensions.filter((dimension) => analysis.metrics[dimension.key] !== null);
  if (available.length < 3) return [];
  return mLeagueReference.players
    .map((player) => {
      const distance = Math.sqrt(
        available.reduce(
          (sum, dimension) =>
            sum +
            ((analysis.metrics[dimension.key]! - player[dimension.key]) / dimension.scale) ** 2,
          0,
        ) / available.length,
      );
      return {
        ...player,
        distance,
        similarity: Math.max(0, 100 * (1 - distance)),
        dimensions: available.map((dimension) => dimension.label),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
}
