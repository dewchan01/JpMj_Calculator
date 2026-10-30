import type { Match } from '../../../../../../packages/mahjong-core/ledger';

export interface PlayerIdentity {
  id: string;
  name: string;
}
/** Seat IDs are match-local. Legacy seats must never join unrelated people by name or p0/p1. */
export function playerIdentity(match: Match, player: Match['players'][number]): string {
  return typeof player.profileId === 'string' &&
    player.profileId.length &&
    !['__proto__', 'constructor', 'prototype'].includes(player.profileId)
    ? player.profileId
    : `legacy:${JSON.stringify([match.id, player.id])}`;
}
export function playerIdentities(matches: Match[], saved: PlayerIdentity[] = []): PlayerIdentity[] {
  const result = new Map(saved.map((player) => [player.id, player]));
  for (const match of [...matches].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  ))
    for (const player of match.players) {
      const id = playerIdentity(match, player);
      if (!result.has(id)) result.set(id, { id, name: player.name.trim() });
    }
  return [...result.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
/** Short discriminator for same-name choices; the full ID remains the identity key. */
export function identityLabel(player: PlayerIdentity): string {
  let hash = 2166136261;
  for (const char of player.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${player.name} · ${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function mapImportedPlayers(
  matches: Match[],
  mapping: Readonly<Record<string, string>>,
): Match[] {
  const resolve = (id: string): string => {
    const seen = new Set<string>();
    while (
      Object.hasOwn(mapping, id) &&
      typeof mapping[id] === 'string' &&
      mapping[id] &&
      mapping[id] !== id
    ) {
      if (seen.has(id)) throw new Error('Player mappings contain a cycle.');
      seen.add(id);
      id = mapping[id];
    }
    return id;
  };
  return matches.map((match) => {
    const players = match.players.map((player) => ({
      ...player,
      profileId: resolve(playerIdentity(match, player)),
    }));
    if (new Set(players.map((player) => player.profileId)).size !== players.length)
      throw new Error('Two players in one game cannot share an identity.');
    return { ...structuredClone(match), players };
  });
}
