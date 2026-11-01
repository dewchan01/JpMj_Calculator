import { Service, inject } from '@angular/core';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { OnlineApi, type RoomAccess } from './online-api';
import { RoomTabAccess } from './room-tab-access';

/** Keeps lobby membership online while its view is temporarily closed. */
@Service()
export class LobbyConnection {
  private readonly api = inject(OnlineApi);
  private readonly tabs = inject(RoomTabAccess);
  private connection?: HubConnection;
  private access: RoomAccess | null = null;
  private generation = 0;
  private starting: Promise<void> = Promise.resolve();

  hold(access: RoomAccess): void {
    const generation = ++this.generation;
    this.starting = this.starting
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this.generation) return;
        await this.disconnect();
        if (generation !== this.generation) return;
        this.access = access;
        this.tabs.claim(access.token);
        const connection = new HubConnectionBuilder()
          .withUrl(this.api.url() + '/hubs/rooms', { withCredentials: false })
          .configureLogging(LogLevel.None)
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .build();
        this.connection = connection;
        const join = async () => {
          await connection.invoke('Join', access.id, access.token);
          await connection.invoke('SetAway', true);
        };
        connection.on('Closed', () => {
          if (generation !== this.generation) return;
          this.api.clearRoomAccess(access.id, access.token);
          void this.stop();
        });
        connection.onreconnected(async () => {
          if (generation !== this.generation) return;
          try {
            await join();
          } catch {
            await this.stop();
          }
        });
        try {
          await connection.start();
          if (generation !== this.generation) {
            await connection.stop();
            return;
          }
          await join();
        } catch {
          if (generation === this.generation) await this.disconnect();
        }
      });
  }
  async stop(): Promise<void> {
    this.generation++;
    await this.starting.catch(() => undefined);
    await this.disconnect();
  }
  private async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.tabs.release(this.access?.token);
    this.access = null;
    await connection?.stop();
  }
}
