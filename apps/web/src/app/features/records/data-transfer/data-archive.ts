import { balances, type Match } from '../../../../../../../packages/mahjong-core/ledger';
import { finalStandings } from '../../../../../../../packages/mahjong-core/final-results';
import { validateProfile } from '../../../../../../../packages/mahjong-rules/index';

export interface GameArchive {
  format: 'riichi-table';
  version: 1;
  exportedAt: string;
  matches: Match[];
}
export function gameArchive(matches: Match[]): GameArchive {
  return { format: 'riichi-table', version: 1, exportedAt: new Date().toISOString(), matches };
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}
function date(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function validMatch(value: unknown): value is Match {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !text(value.id) ||
    !text(value.name) ||
    !date(value.createdAt) ||
    !date(value.updatedAt) ||
    ![3, 4].includes(Number(value.playerCount)) ||
    !Array.isArray(value.players) ||
    value.players.length !== value.playerCount ||
    !object(value.initialBalances) ||
    !object(value.rules) ||
    !Array.isArray(value.events)
  )
    return false;
  const ids = new Set<string>();
  for (const player of value.players) {
    if (
      !object(player) ||
      !text(player.id) ||
      ['__proto__', 'constructor', 'prototype', 'table'].includes(player.id) ||
      !text(player.name) ||
      ids.has(player.id) ||
      !Number.isSafeInteger(value.initialBalances[player.id])
    )
      return false;
    ids.add(player.id);
  }
  if (
    Object.keys(value.initialBalances).length !== ids.size ||
    !ids.has(String(value.dealerId)) ||
    !ids.has(String(value.initialDealerId)) ||
    !['east', 'south', 'west', 'north'].includes(String(value.roundWind)) ||
    !Number.isInteger(value.handNumber) ||
    Number(value.handNumber) < 1 ||
    !Number.isInteger(value.honba) ||
    Number(value.honba) < 0 ||
    (value.ended !== undefined && typeof value.ended !== 'boolean') ||
    value.rules.playerCount !== value.playerCount
  )
    return false;
  const types = [
    'win',
    'multipleRon',
    'exhaustiveDraw',
    'abortiveDraw',
    'nagashi',
    'riichiDeposit',
    'matchEnd',
    'scoreAdjustment',
  ];
  for (const event of value.events) {
    if (
      !object(event) ||
      !text(event.id) ||
      !date(event.timestamp) ||
      !types.includes(String(event.type)) ||
      !Array.isArray(event.payments)
    )
      return false;
    if (
      event.payments.some(
        (payment) =>
          !object(payment) ||
          typeof payment.from !== 'string' ||
          typeof payment.to !== 'string' ||
          (payment.from !== 'table' && !ids.has(payment.from)) ||
          (payment.to !== 'table' && !ids.has(payment.to)) ||
          !Number.isSafeInteger(payment.amount) ||
          Number(payment.amount) < 0 ||
          typeof payment.reason !== 'string',
      )
    )
      return false;
  }
  // Validate the rule snapshot and reconcile every payment before anything is persisted.
  try {
    const match = value as unknown as Match;
    if (validateProfile(match.rules).length) return false;
    balances(match);
    finalStandings(match);
    return true;
  } catch {
    return false;
  }
}
export function parseArchive(source: string): GameArchive {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('Invalid game archive.');
  }
  if (
    !object(value) ||
    value.format !== 'riichi-table' ||
    value.version !== 1 ||
    !date(value.exportedAt) ||
    !Array.isArray(value.matches) ||
    value.matches.length > 10000 ||
    !value.matches.every(validMatch) ||
    new Set(value.matches.map((match) => match.id)).size !== value.matches.length
  )
    throw new Error('Invalid game archive.');
  return value as unknown as GameArchive;
}
