export interface PresenceSnapshot {
  version: number;
  seats: number[];
  awaySeats?: number[];
}

export function playerConnectionStates(
  count: number,
  onlineSeats: readonly number[] | null,
  ownSeat: number | null,
  connection: string,
  awaySeats: readonly number[] = [],
): string[] {
  return Array.from({ length: count }, (_, seat) => {
    if (connection === 'Connected' && awaySeats.includes(seat)) return 'Away';
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
  const awaySeats =
    'awaySeats' in value && Array.isArray(value.awaySeats)
      ? value.awaySeats.filter(
          (seat: unknown): seat is number =>
            Number.isInteger(seat) && Number(seat) >= 0 && Number(seat) < 4,
        )
      : [];
  return { version: value.version, seats: [...new Set(value.seats)], awaySeats };
}
