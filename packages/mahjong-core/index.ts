export type PlayerCount = 3 | 4;
export type Wind = 'east' | 'south' | 'west' | 'north';
export type Suit = 'man' | 'pin' | 'sou';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TileKind =
  | { type: 'suited'; suit: Suit; rank: Rank }
  | { type: 'wind'; wind: Wind }
  | { type: 'dragon'; dragon: 'white' | 'green' | 'red' };
export interface Tile {
  id: string;
  kind: TileKind;
  isRed: boolean;
}
export const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
export const SUITS: Suit[] = ['man', 'pin', 'sou'];
export function kindIndex(kind: TileKind): number {
  if (kind.type === 'suited') return SUITS.indexOf(kind.suit) * 9 + kind.rank - 1;
  if (kind.type === 'wind') return 27 + WINDS.indexOf(kind.wind);
  return 31 + ['white', 'green', 'red'].indexOf(kind.dragon);
}
export function kindAt(index: number): TileKind {
  if (!Number.isInteger(index) || index < 0 || index > 33)
    throw new Error('Tile index must be 0–33.');
  if (index < 27)
    return { type: 'suited', suit: SUITS[Math.floor(index / 9)], rank: ((index % 9) + 1) as Rank };
  if (index < 31) return { type: 'wind', wind: WINDS[index - 27] };
  return { type: 'dragon', dragon: (['white', 'green', 'red'] as const)[index - 31] };
}
export function tileLabel(tile: Tile): string {
  const k = tile.kind;
  if (k.type === 'suited')
    return `${tile.isRed ? 0 : k.rank}${{ man: 'm', pin: 'p', sou: 's' }[k.suit]}`;
  return k.type === 'wind'
    ? { east: 'E', south: 'S', west: 'W', north: 'N' }[k.wind]
    : { white: 'P', green: 'F', red: 'C' }[k.dragon];
}
export function tileName(tile: Tile): string {
  const k = tile.kind;
  return k.type === 'suited'
    ? `${tile.isRed ? 'Red ' : ''}${k.rank} ${k.suit}`
    : k.type === 'wind'
      ? `${k.wind} wind`
      : `${k.dragon} dragon`;
}
/** Compact notation: 123m456p789s12344z; 0 is a red five. Spaces are allowed. */
export function parseTiles(input: string, prefix = 'tile'): Tile[] {
  const text = input.replace(/\s+/g, '').toLowerCase();
  const tiles: Tile[] = [];
  let cursor = 0;
  const pattern = /([0-9]+)([mpsz])/g;
  for (const match of text.matchAll(pattern)) {
    if (match.index !== cursor) throw new Error('Use tile notation such as 123m456p789s12344z.');
    cursor += match[0].length;
    for (const digit of match[1]) {
      const rank = Number(digit);
      const suit = match[2];
      if (suit === 'z' && (rank < 1 || rank > 7))
        throw new Error('Honors are 1z–7z; red honor tiles do not exist.');
      const index =
        suit === 'z' ? 26 + rank : 'mps'.indexOf(suit) * 9 + (rank === 0 ? 5 : rank) - 1;
      tiles.push({ id: `${prefix}-${tiles.length}`, kind: kindAt(index), isRed: rank === 0 });
    }
  }
  if (cursor !== text.length) throw new Error('Use tile notation such as 123m456p789s12344z.');
  return tiles;
}
export type MeldType = 'chi' | 'pon' | 'daiminkan' | 'ankan' | 'kakan';
export interface Meld {
  id: string;
  type: MeldType;
  tiles: Tile[];
  calledTileId?: string;
  fromPlayerId?: string;
  upgradedFromMeldId?: string;
  originalPon?: { id: string; tiles: Tile[]; calledTileId: string; fromPlayerId: string };
  /** Sequence of original calls; Kakan retains the Pon's order. */
  callOrder?: number;
}
export interface Hand {
  playerId: string;
  concealedTiles: Tile[];
  melds: Meld[];
  extractedNorthTiles: Tile[];
}
export interface Player {
  id: string;
  name: string;
}
export interface WinEvent {
  winnerId: string;
  method: 'ron' | 'tsumo';
  discarderId?: string;
  winningTileId: string;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  rinshan: boolean;
  chankan: boolean;
  haitei: boolean;
  houtei: boolean;
  tenhou: boolean;
  chiihou: boolean;
  replacement?: 'kan' | 'kita';
  robbed?: 'kakan' | 'ankan' | 'kita';
  /** Explicit player attestation: first draw, no earlier calls/Kans/Kita. */
  firstTurnUninterrupted?: boolean;
}
export interface Payment {
  from: string;
  to: string;
  amount: number;
  reason: string;
}
export interface ScoreResult {
  isValid: boolean;
  errors: string[];
  yaku: { id: string; name: string; han?: number; yakumanMultiplier?: number }[];
  bonusHan: { source: string; count: number }[];
  fu: number;
  fuBreakdown: { reason: string; value: number }[];
  han: number;
  limitName?: string;
  payments: Payment[];
  playerDeltas: Record<string, number>;
  interpretation?: string;
  winnerReceives: number;
}
export function isTerminal(index: number): boolean {
  return index < 27 && (index % 9 === 0 || index % 9 === 8);
}
export function isOutside(index: number): boolean {
  return index >= 27 || isTerminal(index);
}
