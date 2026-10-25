import { finalStandings } from '../../../../../../packages/mahjong-core/final-results';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import { tableRules } from '../../../../../../packages/mahjong-rules/index';

export interface RecordFilter {
  from: string;
  to: string;
  mode: string;
  participant: string;
}
export function filterMatches(matches: Match[], filter: RecordFilter): Match[] {
  return matches.filter((match) => {
    const date = new Date(match.createdAt);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const mode = `${match.playerCount}-${match.gameLength ?? 'south'}`;
    return (
      (!filter.from || day >= filter.from) &&
      (!filter.to || day <= filter.to) &&
      (!filter.mode || mode === filter.mode) &&
      (!filter.participant || match.players.some((p) => p.name.trim() === filter.participant))
    );
  });
}
export function durationMinutes(match: Match): number {
  if (match.clock)
    return Math.floor(
      (match.clock.elapsedMs +
        (match.clock.runningSince
          ? Math.max(0, Date.now() - Date.parse(match.clock.runningSince))
          : 0)) /
        60000,
    );
  const last = match.events.at(-1)?.timestamp ?? match.createdAt;
  return Math.max(0, Math.round((Date.parse(last) - Date.parse(match.createdAt)) / 60000));
}
export interface PlayerRecord {
  name: string;
  games: number;
  averageRank: number;
  points: number;
  score: number;
  money: Record<string, number>;
}
/** Names are the existing local player identity; unfinished tables never count as final results. */
export function playerRecords(matches: Match[]): PlayerRecord[] {
  const people = new Map<string, PlayerRecord & { rankSum: number }>();
  for (const match of matches.filter((game) => game.ended)) {
    const currency = tableRules(match.rules).currency;
    for (const row of finalStandings(match)) {
      const name = row.name.trim();
      const record = people.get(name) ?? {
        name,
        games: 0,
        averageRank: 0,
        rankSum: 0,
        points: 0,
        score: 0,
        money: Object.create(null) as Record<string, number>,
      };
      record.games++;
      record.rankSum += row.rank;
      record.averageRank = record.rankSum / record.games;
      record.points += row.points - match.initialBalances[row.id];
      record.score += row.finalScore;
      record.money[currency] =
        Math.round(((record.money[currency] ?? 0) + row.totalMoney) * 100) / 100;
      people.set(name, record);
    }
  }
  return [...people.values()];
}
