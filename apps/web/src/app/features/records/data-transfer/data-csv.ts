import { gameArchive, parseArchive, type GameArchive } from './data-archive';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';

const columns = ['game_id', 'game_name', 'created_at', 'path', 'type', 'value'];
const safe = (value: string) => (/^[=+\-@\t\r']/.test(value) ? "'" + value : value);
const quote = (value: string) => '"' + safe(value).replaceAll('"', '""') + '"';
const escape = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');

// Typed paths preserve complete game history without exposing JSON as a file format.
export function gamesCsv(matches: Match[]): string {
  const rows: string[][] = [columns];
  for (const match of matches) {
    const visit = (value: unknown, path: string) => {
      if (value === undefined) return;
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      rows.push([
        match.id,
        match.name,
        match.createdAt,
        path,
        type,
        ['array', 'object', 'null'].includes(type) ? '' : String(value),
      ]);
      if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value)) visit(child, path + '/' + escape(key));
    };
    visit(match, '');
  }
  return '\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

function readRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!cell || quoted) quoted = !quoted;
      else throw new Error('Invalid CSV file.');
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(cell.startsWith("'") ? cell.slice(1) : cell);
      cell = '';
      if (char !== ',') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  if (quoted) throw new Error('Invalid CSV file.');
  if (cell || row.length) {
    row.push(cell.startsWith("'") ? cell.slice(1) : cell);
    rows.push(row);
  }
  return rows;
}

export function parseGamesCsv(text: string): GameArchive {
  if (new Blob([text]).size > 20 * 1024 * 1024)
    throw new Error('Archive must be smaller than 20 MiB.');
  const rows = readRows(text);
  if (rows.shift()?.join(',') !== columns.join(',')) throw new Error('Invalid CSV file.');
  const matches = new Map<string, Record<string, unknown>>();
  const nodes = new Map<string, unknown>();
  for (const row of rows) {
    if (row.length !== 6) throw new Error('Invalid CSV file.');
    const [id, , , path, type, raw] = row;
    let value: unknown;
    switch (type) {
      case 'object':
        value = Object.create(null);
        break;
      case 'array':
        value = [];
        break;
      case 'null':
        value = null;
        break;
      case 'string':
        value = raw;
        break;
      case 'number':
        value = Number(raw);
        if (!raw || !Number.isFinite(value)) throw new Error('Invalid CSV file.');
        break;
      case 'boolean':
        if (!['true', 'false'].includes(raw)) throw new Error('Invalid CSV file.');
        value = raw === 'true';
        break;
      default:
        throw new Error('Invalid CSV file.');
    }
    const prefix = id.length + ':' + id + ':';
    const key = prefix + path;
    if (nodes.has(key)) throw new Error('Invalid CSV file.');
    if (path === '') {
      if (type !== 'object' || matches.size >= 10000) throw new Error('Invalid CSV file.');
      matches.set(id, value as Record<string, unknown>);
    } else {
      const slash = path.lastIndexOf('/');
      const parent = nodes.get(prefix + path.slice(0, slash));
      const field = path
        .slice(slash + 1)
        .replaceAll('~1', '/')
        .replaceAll('~0', '~');
      if (
        slash < 0 ||
        !parent ||
        typeof parent !== 'object' ||
        ['__proto__', 'constructor', 'prototype'].includes(field) ||
        path.split('/').length > 64 ||
        (Array.isArray(parent) &&
          (!/^(0|[1-9]\d*)$/.test(field) || Number(field) !== parent.length))
      )
        throw new Error('Invalid CSV file.');
      (parent as Record<string, unknown>)[field] = value;
    }
    nodes.set(key, value);
  }
  return parseArchive(JSON.stringify(gameArchive([...matches.values()] as unknown as Match[])));
}
