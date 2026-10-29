export interface PresenceSnapshot {
  version: number;
  seats: number[];
}

export function playerConnectionStates(
  count: number,
  onlineSeats: readonly number[] | null,
  ownSeat: number | null,
  connection: string,
): string[] {
  return Array.from({ length: count }, (_, seat) => {
    if (seat === ownSeat) return connection;
    if (connection !== 'Connected' || onlineSeats === null) return 'Unknown';
    return onlineSeats.includes(seat) ? 'Connected' : 'Disconnected';
  });
}

export function parsePresence(value: unknown): PresenceSnapshot | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    !('seats' in value) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    !Array.isArray(value.seats) ||
    value.seats.length > 4 ||
    value.seats.some((seat) => !Number.isInteger(seat) || seat < 0 || seat > 3)
  )
    return null;
  return { version: value.version, seats: [...new Set(value.seats)] };
}
