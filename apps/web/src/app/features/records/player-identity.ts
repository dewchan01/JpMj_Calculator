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
/** Names are presentation only; duplicate choices use a local ordinal, never an ID. */
export function identityLabel(player: PlayerIdentity, peers: PlayerIdentity[] = []): string {
  const same = peers.filter((other) => other.name === player.name);
  const index = same.findIndex((other) => other.id === player.id);
  return index > 0 ? `${player.name} (${index})` : player.name;
}
export function mergePlayersByName(
  matches: Match[],
  existing: PlayerIdentity[],
): Record<string, string> {
  const key = (name: string) => name.normalize('NFKC').trim().toLowerCase();
  const incoming = playerIdentities(matches);
  const mapping: Record<string, string> = {};
  for (const person of incoming) {
    if (existing.some((other) => other.id === person.id)) continue;
    const candidates = existing.filter((other) => key(other.name) === key(person.name));
    if (candidates.length > 1) continue;
    const target = candidates[0] ?? incoming.find((other) => key(other.name) === key(person.name));
    if (!target || target.id === person.id) continue;
    const next = { ...mapping, [person.id]: target.id };
    try {
      mapImportedPlayers(matches, next);
      mapping[person.id] = target.id;
    } catch {
      // Same-name people seated together must remain different players.
    }
  }
  return mapping;
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
