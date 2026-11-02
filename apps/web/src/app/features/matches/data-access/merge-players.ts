import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { playerIdentity, type PlayerIdentity } from '../../records/player-identity';

export function mergePlayerRecords(
  matches: Match[],
  source: string,
  target: PlayerIdentity,
): Match[] {
  if (!source || source === target.id) throw new Error('Choose two different players.');
  return matches.flatMap((match) => {
    const seats = match.players.filter((p) => playerIdentity(match, p) === source);
    if (!seats.length) return [];
    if (match.players.some((p) => playerIdentity(match, p) === target.id))
      throw new Error('Players who appear in the same game cannot be merged.');
    const ids = new Set(seats.map((p) => p.id));
    const copy = structuredClone(match);
    // Rewrite player snapshots too, retaining match-local seat IDs and every payment.
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === 'players' && Array.isArray(child))
          for (const player of child)
            if (player && ids.has(player.id)) {
              player.profileId = target.id;
              player.name = target.name;
            }
        visit(child);
      }
    };
    visit(copy);
    copy.updatedAt = new Date().toISOString();
    return [copy];
  });
}
