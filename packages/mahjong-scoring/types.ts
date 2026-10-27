import type { Hand, Player, Tile, Wind, WinEvent } from '../mahjong-core/index';
import type { RuleProfile } from '../mahjong-rules/index';
export interface ScoringInput {
  /** Player-confirmed total Han/Fu; never inferred from an incomplete hand. */
  manualScore?: {
    han: number;
    fu: number;
    yakuman?: number;
    chips?: number;
    pao?: { payerId: string; yakuman: number };
  };
  rules: RuleProfile;
  players: Player[];
  dealerId: string;
  roundWind: Wind;
  hand: Hand;
  win: WinEvent;
  honba: number;
  riichiSticks: number;
  doraIndicators: Tile[];
  uraIndicators: Tile[];
  otherPlayerKans?: number;
  waremePlayerId?: string;
}
export interface Group {
  type: 'sequence' | 'triplet' | 'kan';
  index: number;
  open: boolean;
}
export interface Form {
  pair: number;
  groups: Group[];
  special?: 'chiitoitsu' | 'kokushi';
}
