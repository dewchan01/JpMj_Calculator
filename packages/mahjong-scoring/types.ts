import type { Hand, Player, Tile, Wind, WinEvent } from '../mahjong-core/index';
import type { RuleProfile } from '../mahjong-rules/index';
export interface ScoringInput {
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
