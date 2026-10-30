export const lobbyTracks = [
  'Lobby',
  'Lobby Autumn',
  'Lobby Winter',
  'Lobby Bd',
  'Lobby 2303wenquan',
  'Zhongxialvdong',
] as const;
export const gameTracks = [
  'Game',
  'Game Master',
  '23ex Duiju1',
  '23ex Duiju2',
  '23ex Duiju3',
  '23ex Duiju4',
] as const;
export const riichiTracks = [
  'Liqi1',
  'Liqi2',
  'Liqi 8bit',
  'Liqi Chuzhen',
  'Liqi 22chunjie',
  'Liqi 23chunjie',
  'Liqi 23summer',
  'Liqi 23ex Rpg',
  'Liqi 23ex Xiyang',
  'Yichujifa',
] as const;
export const musicFile = (track: string) => track.toLowerCase().replaceAll(' ', '-') + '.mp3';

/** Official titles matched by audio path; see docs/guides/music-titles.md. */
export const musicTitles: Readonly<Record<string, string>> = {
  Lobby: 'Sakura',
  'Lobby Autumn': 'Autumn Chill',
  'Lobby Winter': 'Winter Arrival',
  'Lobby Bd': 'Daily Life',
  'Lobby 2303wenquan': 'Spring Tea',
  Zhongxialvdong: 'Midsummer',
  Game: 'Bamboo',
  'Game Master': 'Winding Stream Party',
  '23ex Duiju1': 'Secret Formation',
  '23ex Duiju2': 'Indulgence',
  '23ex Duiju3': 'Harmony',
  '23ex Duiju4': 'Future',
  Liqi1: 'Serious Game',
  Liqi2: 'Intensive Battle',
  'Liqi 8bit': 'Serious Game - 8bit version',
  'Liqi Chuzhen': 'Charge',
  'Liqi 22chunjie': 'Splendid Dreams',
  'Liqi 23chunjie': 'Invincible',
  'Liqi 23summer': 'Blazing Moment',
  'Liqi 23ex Rpg': 'Over the Clouds',
  'Liqi 23ex Xiyang': 'Path to Victory',
  Yichujifa: 'On the Edge',
};
