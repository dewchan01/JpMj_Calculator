import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'docs/api/v1';
mkdirSync(directory, { recursive: true });
const sample = {
  id: 'api-example',
  schemaVersion: 1,
  name: 'API example',
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
  playerCount: 4,
  gameLength: 'east',
  rules: {
    id: 'mahjong-soul-4p',
    version: 2,
    preset: 'mahjong-soul',
    playerCount: 4,
    startingPoints: 25000,
    tsumo: 'loss',
    kiriage: false,
    openTanyao: true,
  },
  players: ['a', 'b', 'c', 'd'].map((id, index) => ({ id, name: `Player ${index + 1}` })),
  initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
  initialDealerId: 'a',
  dealerId: 'a',
  roundWind: 'east',
  handNumber: 1,
  honba: 0,
  events: [],
  live: { players: {}, dora: '7z', ura: '', calls: 0 },
  clock: { elapsedMs: 0, runningSince: '2026-10-29T00:00:00.000Z', handStartMs: 0 },
};
const prepare = (variable, room = false) => [
  `const match = ${JSON.stringify(sample)};`,
  `match.id = pm.variables.replaceIn('{{$guid}}');`,
  `match.createdAt = match.updatedAt = match.clock.runningSince = new Date().toISOString();`,
  `pm.collectionVariables.set('${variable}', JSON.stringify(match));`,
  ...(room ? [`pm.collectionVariables.set('handKey', match.id + ':start:a:east:1:0:false');`] : []),
];
const assertStatus = (codes) => [
  `pm.test('Expected status', () => pm.expect(${JSON.stringify(codes)}).to.include(pm.response.code));`,
];
function item(
  name,
  method,
  path,
  { token, body, header = [], after = [], before = [], description = '', codes = [200] } = {},
) {
  return {
    name,
    request: {
      method,
      description,
      url: '{{baseUrl}}' + path,
      header: [...header, ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : [])],
      ...(token
        ? {
            auth: {
              type: 'bearer',
              bearer: [{ key: 'token', value: `{{${token}}}`, type: 'string' }],
            },
          }
        : {}),
      ...(body ? { body: { mode: 'raw', raw: body, options: { raw: { language: 'json' } } } } : {}),
    },
    event: [
      ...(before.length
        ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: before } }]
        : []),
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: [...assertStatus(codes), ...after] },
      },
    ],
  };
}
const readGame = (name) =>
  item(name, 'GET', '/api/rooms/{{roomId}}/game', {
    token: 'hostToken',
    after: [
      'if (pm.response.code === 200) { const data = pm.response.json();',
      "pm.collectionVariables.set('revision', data.revision); pm.collectionVariables.set('handKey', data.handKey);",
      "pm.collectionVariables.set('matchJson', JSON.stringify(data.match)); }",
    ],
  });
const collection = {
  info: {
    name: 'Riichi API v1',
    version: { major: 1, minor: 0, patch: 0 },
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Version 1: rooms, host/player credentials, capabilities, game snapshots and expiring shares. Run on a test backend. Scores and snapshots are calculated by the client, not by this API. SignalR Presence/Changed subscriptions are documented separately.',
  },
  variable: [
    'baseUrl',
    'roomId',
    'pin',
    'hostToken',
    'playerToken',
    'seat',
    'revision',
    'handKey',
    'sampleMatch',
    'matchJson',
    'archiveMatch',
    'shareId',
    'deletionSecret',
  ].map((key) => ({
    key,
    value: key === 'baseUrl' ? 'http://localhost:5080' : '',
    type: 'string',
  })),
  item: [
    item('01 Health', 'GET', '/api/health'),
    {
      name: 'Rooms and game synchronization',
      item: [
        item('02 Create room with a valid sample game', 'POST', '/api/rooms', {
          body: '{"playerCount":4,"hostSeat":0,"match":{{sampleMatch}},"handKey":"{{handKey}}"}',
          before: prepare('sampleMatch', true),
          after: [
            "if (pm.response.code === 200) { const data = pm.response.json(); pm.collectionVariables.set('roomId', data.id);",
            "pm.collectionVariables.set('pin', data.pin); pm.collectionVariables.set('hostToken', data.token); }",
          ],
        }),
        item('03 Read lobby as host', 'GET', '/api/rooms/{{roomId}}', { token: 'hostToken' }),
        item('04 Join an available player seat', 'POST', '/api/rooms/{{roomId}}/join', {
          body: '{"pin":"{{pin}}"}',
          after: [
            "if (pm.response.code === 200) { const data = pm.response.json(); pm.collectionVariables.set('playerToken', data.token); pm.collectionVariables.set('seat', data.seat); }",
          ],
        }),
        readGame('05 Read game and current capabilities'),
        item('06 Submit own Riichi as a player', 'POST', '/api/rooms/{{roomId}}/game/actions', {
          token: 'playerToken',
          body: '{"id":"{{$guid}}","handKey":"{{handKey}}","kind":"riichi","payload":{"double":false}}',
          description:
            'Queues a declaration. An open host browser processes it; the API alone does not calculate or apply it.',
        }),
        readGame('07 Refresh revision after submission'),
        item('08 Set player capabilities as host', 'PUT', '/api/rooms/{{roomId}}/permissions', {
          token: 'hostToken',
          codes: [204],
          body: JSON.stringify(
            {
              riichi: true,
              calls: true,
              win: true,
              indicators: false,
              settle: false,
              draw: false,
              history: false,
              finish: false,
            },
            null,
            2,
          ),
        }),
        readGame('09 Refresh revision after capability change'),
        item('10 Commit a client-calculated snapshot', 'PUT', '/api/rooms/{{roomId}}/game', {
          token: 'hostToken',
          body: '{"revision":{{revision}},"handKey":"{{handKey}}","match":{{matchJson}},"decisions":[]}',
          description:
            'By default resends the unchanged latest snapshot. To settle, supply a validated client-calculated match and decisions. This endpoint does not calculate scores. A stale revision returns 409.',
        }),
      ],
    },
    {
      name: '24-hour archive sharing',
      item: [
        item('11 Create share', 'POST', '/api/shares', {
          before: prepare('archiveMatch'),
          body: '{"format":"riichi-table","version":1,"matches":[{{archiveMatch}}]}',
          after: [
            "if (pm.response.code === 200) { const data = pm.response.json(); pm.collectionVariables.set('shareId', data.id); pm.collectionVariables.set('deletionSecret', data.deletionSecret); }",
          ],
        }),
        item('12 Download archive', 'GET', '/api/shares/{{shareId}}'),
        item('13 Revoke archive', 'DELETE', '/api/shares/{{shareId}}', {
          codes: [204],
          header: [{ key: 'X-Deletion-Secret', value: '{{deletionSecret}}' }],
        }),
      ],
    },
    {
      name: 'Cleanup',
      item: [
        item('14 Release joined seat', 'DELETE', '/api/rooms/{{roomId}}/seats/{{seat}}', {
          token: 'hostToken',
          codes: [204],
        }),
        item('15 Close room', 'DELETE', '/api/rooms/{{roomId}}', {
          token: 'hostToken',
          codes: [204],
        }),
      ],
    },
  ],
};
writeFileSync(
  `${directory}/Riichi-v1.postman_collection.json`,
  JSON.stringify(collection, null, 2) + '\n',
);
for (const [name, value] of [
  ['Local', 'http://localhost:5080'],
  ['Production', 'https://jpmj.runasp.net'],
])
  writeFileSync(
    `${directory}/${name}.postman_environment.json`,
    JSON.stringify(
      {
        name: `Riichi v1 ${name}`,
        values: [{ key: 'baseUrl', value, enabled: true }],
        _postman_variable_scope: 'environment',
      },
      null,
      2,
    ) + '\n',
  );
