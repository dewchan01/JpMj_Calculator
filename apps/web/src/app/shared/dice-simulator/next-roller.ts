/** Count the total from East as one, following the current seat winds. */
export function nextRoller(
  players: readonly { id: string; name: string }[],
  dealer: string,
  total: number,
): { name: string; wind: string } | null {
  if (!players.length || !Number.isInteger(total) || total < 2 || total > 12) return null;
  const east = Math.max(
    0,
    players.findIndex((player) => player.id === dealer),
  );
  const offset = (total - 1) % players.length;
  return {
    name: players[(east + offset) % players.length].name,
    wind: ['east', 'south', 'west', 'north'][offset],
  };
}
