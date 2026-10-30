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
