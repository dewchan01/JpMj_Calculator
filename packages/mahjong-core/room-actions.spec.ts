import { describe, it, expect } from 'vitest';
import { fixture } from '../mahjong-fixtures/index';
import { balances, type Match } from './ledger';
import { emptyLive } from './live';
import {
  applyRoomAction,
  roomHandKey,
  roomWinInput,
  settleRoomWins,
  type RoomAction,
} from './room-actions';

function game(): Match {
  const input = fixture();
  return {
    id: 'room-game',
    schemaVersion: 1,
    name: 'Room game',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    playerCount: 4,
    players: input.players,
    rules: input.rules,
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    events: [],
    live: emptyLive(),
  };
}
function action(
  match: Match,
  kind: RoomAction['kind'],
  seat: number,
  payload: Record<string, unknown> = {},
): RoomAction {
  return {
    id: crypto.randomUUID(),
    seat,
    kind,
    payload,
    handKey: roomHandKey(match),
    status: 'pending',
    error: '',
    createdAt: Date.now(),
  };
}
function win(match: Match, seat: number, method: 'ron' | 'tsumo' = 'ron'): RoomAction {
  const input = fixture();
  input.hand.playerId = input.win.winnerId = match.players[seat].id;
  input.hand.concealedTiles = [];
  input.win.winningTileId = '';
  input.win.method = method;
  input.win.discarderId = method === 'ron' ? 'c' : undefined;
  input.manualScore = { han: 3, fu: 40 };
  return action(match, 'win', seat, { input });
}
describe('room declarations', () => {
  it('preserves two seat deposits and never charges a repeated declaration twice', () => {
    const before = game();
    const first = action(before, 'riichi', 0);
    const second = action(before, 'riichi', 1);
    const after = applyRoomAction(applyRoomAction(before, first), second);
    expect(balances(after)).toEqual({
      players: { a: 24000, b: 24000, c: 25000, d: 25000 },
      table: 2000,
    });
    expect(() => applyRoomAction(after, first)).toThrow();
  });
  it('applies calls to the authorized actor and automatically includes a red five in Kan', () => {
    const before = game();
    const after = applyRoomAction(
      before,
      action(before, 'call', 1, {
        type: 'ankan',
        text: '5p',
        source: '',
        called: 0,
        upgradeId: '',
      }),
    );
    expect(after.live!.players.b.melds[0].tiles).toHaveLength(4);
    expect(after.live!.players.b.melds[0].tiles.filter((tile) => tile.isRed)).toHaveLength(1);
    expect(after.live!.players.a).toBeUndefined();
  });
  it('rejects stale hands and invalid call sources', () => {
    const before = game();
    const stale = action(before, 'riichi', 1);
    stale.handKey = 'old-hand';
    expect(() => applyRoomAction(before, stale)).toThrow('hand has changed');
    expect(() =>
      applyRoomAction(
        before,
        action(before, 'call', 1, {
          type: 'pon',
          text: '1p',
          source: 'b',
          called: 0,
          upgradeId: '',
        }),
      ),
    ).toThrow();
  });
  it('replaces guest-supplied table context and rejects winning on behalf of another seat', () => {
    const before = game();
    const declaration = win(before, 1);
    const supplied = declaration.payload['input'] as ReturnType<typeof fixture>;
    supplied.honba = 99;
    supplied.riichiSticks = 99;
    supplied.dealerId = 'b';
    expect(roomWinInput(before, declaration)).toMatchObject({
      honba: 0,
      riichiSticks: 0,
      dealerId: 'a',
    });
    declaration.seat = 0;
    expect(() => roomWinInput(before, declaration)).toThrow('own seat');
  });
  it('collects multiple Ron into one event and advances exactly once', () => {
    const before = game();
    const after = settleRoomWins(before, [win(before, 1), win(before, 3)]);
    expect(after.events).toHaveLength(1);
    expect(after.events[0].type).toBe('multipleRon');
    expect(after.events[0].winnerIds).toEqual(['d', 'b']); // nearest winner to discarder first
    expect(after.handNumber).toBe(2);
    expect(balances(after).players).toEqual({ a: 25000, b: 30200, c: 14600, d: 30200 });
  });
  it('settles Tsumo but rejects mixed Ron/Tsumo and duplicate winners', () => {
    const before = game();
    expect(settleRoomWins(before, [win(before, 1, 'tsumo')]).events[0].win?.method).toBe('tsumo');
    expect(() => settleRoomWins(before, [win(before, 1), win(before, 3, 'tsumo')])).toThrow();
    expect(() => settleRoomWins(before, [win(before, 1), win(before, 1)])).toThrow();
  });
});
