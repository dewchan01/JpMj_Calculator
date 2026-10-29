export const defaultRoomPermissions = {
  riichi: true,
  calls: true,
  win: true,
  indicators: false,
  settle: false,
  history: false,
  finish: false,
};
export type RoomPermission = keyof typeof defaultRoomPermissions;
export type RoomPermissions = Record<RoomPermission, boolean>;
export const roomPermissionItems: { key: RoomPermission; label: string }[] = [
  { key: 'riichi', label: 'Declare or cancel own Riichi' },
  { key: 'calls', label: 'Record own melds and North extractions' },
  { key: 'win', label: 'Submit own winning hand' },
  { key: 'indicators', label: 'Edit shared indicators' },
  { key: 'settle', label: 'Settle hands and winning declarations' },
  { key: 'history', label: 'Edit or undo hand history' },
  { key: 'finish', label: 'End the shared game' },
];
