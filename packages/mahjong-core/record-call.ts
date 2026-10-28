import { parseTiles, kindIndex, type Meld } from './index';
import { emptyLive, livePlayer, elapsedMs, validateRevealed } from './live';
import { ruleSettings } from '../mahjong-rules/index';
import type { Match } from './ledger';

export interface CallInput {
  type: Meld['type'] | 'kita';
  text: string;
  source: string;
  called: number;
  upgradeId: string;
}
export function recordCall(
  match: Match,
  actor: string,
  input: CallInput,
  idFactory: () => string = () => crypto.randomUUID(),
): Match {
  if (!match.players.some((player) => player.id === actor))
    throw new Error('Select a seated player in an ongoing match.');
  const m = match;
  if (m.ended || (!!m.clock && !m.clock.runningSince))
    throw new Error('Resume the game before recording actions.');
  const live = structuredClone(m.live ?? emptyLive()),
    state = structuredClone(livePlayer(m, actor));
  if (state.riichi !== 'none' && !['ankan', 'kita'].includes(input.type))
    throw new Error('Riichi/Ippatsu require a closed hand.');
  let tiles = parseTiles(input.text, idFactory());
  if (tiles.length === 1 && ['pon', 'ankan', 'daiminkan'].includes(input.type)) {
    const tile = tiles[0];
    tiles = Array.from({ length: input.type === 'pon' ? 3 : 4 }, (_, index) => ({
      ...tile,
      id: idFactory(),
      isRed: index === 0 && tile.isRed,
    }));
  }
  if (input.type === 'kita') {
    if (m.playerCount !== 3 || tiles.length !== 1 || kindIndex(tiles[0].kind) !== 30)
      throw new Error('Kita requires one North tile in a three-player game.');
    state.kita.push(tiles[0]);
  } else if (input.type === 'kakan') {
    const pon = state.melds.find((meld) => meld.id === input.upgradeId && meld.type === 'pon');
    if (!pon || tiles.length !== 1 || kindIndex(tiles[0].kind) !== kindIndex(pon.tiles[0].kind))
      throw new Error('Choose a Pon and its matching fourth tile.');
    state.melds = state.melds.map((meld) =>
      meld.id !== pon.id
        ? meld
        : {
            ...pon,
            type: 'kakan',
            tiles: [...pon.tiles, tiles[0]],
            upgradedFromMeldId: pon.id,
            originalPon: {
              id: pon.id,
              tiles: pon.tiles,
              calledTileId: pon.calledTileId!,
              fromPlayerId: pon.fromPlayerId!,
            },
          },
    );
  } else {
    const required = ['chi', 'pon'].includes(input.type) ? 3 : 4;
    if (tiles.length !== required)
      throw new Error('Chi/Pon need three tiles; Kan needs four tiles.');
    const indices = tiles.map((t) => kindIndex(t.kind)).sort((a, b) => a - b);
    if (
      input.type === 'chi'
        ? !(
            indices[0] < 27 &&
            Math.floor(indices[0] / 9) === Math.floor(indices[2] / 9) &&
            indices[1] === indices[0] + 1 &&
            indices[2] === indices[0] + 2
          )
        : !indices.every((i) => i === indices[0])
    )
      throw new Error('Select a legal sequence or matching tiles.');
    const open = input.type !== 'ankan';
    if (
      open &&
      (!m.players.some((p) => p.id === input.source) ||
        input.source === actor ||
        !tiles[input.called])
    )
      throw new Error('Select the call source and called tile.');
    if (
      input.type === 'chi' &&
      (m.playerCount === 3 ||
        input.source !==
          m.players[
            (m.players.findIndex((p) => p.id === actor) + m.playerCount - 1) % m.playerCount
          ].id)
    )
      throw new Error('Chi is only allowed from the previous player in a four-player game.');
    state.melds.push({
      id: idFactory(),
      type: input.type,
      tiles,
      fromPlayerId: open ? input.source : undefined,
      calledTileId: open ? tiles[input.called].id : undefined,
      callOrder: live.calls + 1,
    });
  }
  if (ruleSettings(m.rules).redFives && ['ankan', 'daiminkan', 'kakan'].includes(input.type)) {
    const kan =
      input.type === 'kakan'
        ? state.melds.find((meld) => meld.id === input.upgradeId)
        : state.melds[state.melds.length - 1];
    if (
      kan &&
      kan.tiles.length === 4 &&
      [4, 13, 22].includes(kindIndex(kan.tiles[0].kind)) &&
      !kan.tiles.some((tile) => tile.isRed)
    ) {
      kan.tiles[3] = { ...kan.tiles[3], isRed: true };
    }
  }
  live.players[actor] = state;
  live.calls++;
  live.actions = [
    ...(live.actions ?? []),
    {
      type: input.type,
      playerId: actor,
      timestamp: new Date().toISOString(),
      elapsedMs: elapsedMs(m.clock),
    },
  ];
  validateRevealed(m, live);
  const kans = Object.values(live.players)
    .flatMap((p) => p.melds)
    .filter((meld) => !['chi', 'pon'].includes(meld.type)).length;
  if (kans > 4) throw new Error('At most four Kans can be recorded in a hand.');

  return { ...m, live };
}
