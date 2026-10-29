# Shared table controls and permissions

The signed-in seat uses its authenticated hub connection for its own status. Other seats use the server's presence snapshot: green means online, red means offline, and neutral gray means the status is unavailable. Missing snapshots are not treated as endlessly connecting. `Join` now also returns the initial snapshot to hosts (participants receive null), while `Presence` events handle subsequent changes. Deploy both frontend and backend for this handshake update; no schema migration is needed.

Permission rows keep the description on the left and switch on the right. Host invitation panels use compact player chips; the live table places a status pulse beside each player's name instead of duplicating a separate player list. Status remains available through accessible labels and tooltips. The table menu offers local **Adjust view**, without a Change seats entry.

The host opens **Game menu → Player permissions**. Each item has an independent switch; this list is hidden from participants. Settings are stored in the room and synchronized by SignalR. They apply to all occupied player seats; hosts retain administrative access.

| Player capability                                      | Default | Backend enforcement                                                                               |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| Declare/cancel own Riichi or Double Riichi             | On      | SubmitAction checks the capability and authenticated seat                                         |
| Record own melds, concealed Kans and North extractions | On      | SubmitAction checks the capability and authenticated seat                                         |
| Submit own Ron/Tsumo hand                              | On      | SubmitAction checks the capability and authenticated seat                                         |
| Edit shared Dora/Ura indicators                        | Off     | CommitGame allows only indicator fields and update timestamp                                      |
| Settle hands and winning declarations                  | Off     | CommitGame requires the settle capability; previous events cannot be rewritten                    |
| Record draws                                           | Off     | CommitGame accepts one new draw event; old events remain unchanged and pending wins block it      |
| Edit or undo recorded hands                            | Off     | CommitGame requires the history capability; game identity, rules and players remain fixed         |
| End the shared game                                    | Off     | CommitGame requires the finish capability and an ended snapshot; previous events remain unchanged |

Only a host credential can update permissions at `PUT /api/rooms/{id}/permissions`. Current permissions are returned with the game snapshot. Hiding frontend controls is supplementary; the API rejects unauthorized requests even if a participant bypasses the UI. Revoked seats lose access independently of these switches. View rotation requires no shared permission because it changes only local display order.

## Player identity and viewing angle

Hosts see online/offline status beside each player in both the invitation panel and the live table. Authenticated SignalR connections drive these updates; multiple tabs keep a seat online until the last connection leaves. No extra game polling or game-revision update is used. Abrupt disconnects can take until SignalR's timeout to appear. Presence is process-local for the current single-instance backend; a multi-instance deployment would need shared presence/backplane infrastructure.

Select **My player** before starting. The selected player appears below on that device. Hosting reserves that seat, and participants are automatically assigned a free seat. Open **Game menu → Adjust view** to rotate clockwise/counterclockwise; the panel stays open for repeated rotation until Back or Close. Rotation is stored per match in that browser and changes neither player order, dealer nor seat winds.

## Normal scoring flow

- The meld-only panel excludes Double Riichi. Double Riichi remains in the separate player declaration controls.
- Player-box actions hide open meld buttons and records. Use the dedicated Call button for Chi, Pon, Open/Added Kan and North; concealed Kan remains separate.
- Record draws is independent of winning-settlement access and defaults off. An authorized guest can record a draw from player actions or the table menu; this does not grant win, history-edit or manual-finish operations. Deploy both frontend and backend; the existing permissions JSON needs no schema migration.
- Winning-hand entry displays recorded melds, concealed Kans and extracted North tiles in a read-only row.
- Choose the winning tile from a tile dialog: a bottom sheet on phones and a centered prompt on desktop.
- Before recording a Kan with no public indicator, enter the initial Dora indicator. A normal-mode Kan then remains a draft until the complete indicator set (one plus the recorded Kan count) is filled. Cancelling the draft does not record the Kan.
- Ron and Tsumo check Dora before scoring. Only Riichi/Double Riichi winners must fill Ura; concealed Kan alone does not qualify. Manual Han entry does not require tile indicators.
- The host's own actions take effect directly. Confirming its own winning preview settles it immediately, combining pending guest Ron on the same hand when applicable. Guest wins still require a permitted settlement operator; pending wins are shown in a dialog rather than an inline declaration panel.

## Results on each device

An ended room opens final results for each connected participant, including after reconnection. Save stores a local copy on that device; Delete removes only that device's copy. Neither choice closes the room or removes other participants' records. Ended snapshots are not automatically backed up again after a local deletion.

Oka is displayed only for first-place entries (including tied leaders). Monetary values stay on one line; the conversion explanation wraps within the page.

## Deployment

This change adds `Rooms.Permissions`, with `{}` preserving the default capabilities for existing rooms. Apply the `RoomPermissions` migration before replacing the backend binaries:

```powershell
dotnet ef migrations script RoomGameActions RoomPermissions --idempotent --project apps/api --configuration Release --output artifacts/room-permissions-upgrade.sql
```

Run that generated SQL against the production SQL Server database. Alternatively run the published backend with `--migrate` and its production connection string. Normal production startup still does not apply migrations automatically. The Angular app must be rebuilt and deployed for the new controls.

For AdminNeo, select **MS SQL** and the existing application database, then execute the complete [AdminNeo upgrade](../sql/room-permissions-upgrade.adminneo.sql) as one command. It wraps the transaction in a single `EXEC` and contains no `GO` batch separator. It checks the physical column independently of migration history, so it also handles a previously added column without adding it twice. The result should show migration `20261029031707_RoomPermissions` and column length `-1` (`nvarchar(max)`). If it fails, retain the exact error text; this script requires SQL Server, not MySQL or SQLite. Back up the database before applying a production migration. Re-running the EF generator above replaces only the generated artifact, not the checked-in AdminNeo script.

Development/Testing SQLite databases receive this additive column upgrade at startup without deleting existing rooms. This local compatibility path never runs in Production.
