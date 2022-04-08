import {System, World} from 'ecsy';
import {WireManager, WireReader} from '../wire';
import type {Transport} from '../transports';
import {Connection, Valid} from '../components';
import {Host} from '../host';


const reader = new WireReader();


export class ReceiveReplicas extends System {
  private wireManager: WireManager;
  private transports: Transport[];
  staging: World;
  private connections = new Map<string, Connection>();

  init({transports, wireManager}: {transports: Transport[], wireManager: WireManager}): void {
    this.transports = transports;
    this.wireManager = wireManager;
  }

  execute(delta: number, time: number): void {
    this.acceptConnections();
    // TODO: receive messages, create replicas either in real world or staging; on error remove
    // the connection and log warning if not just the socket closing.
    if (this.staging) {
      this.staging.execute(delta, time);
      (this.staging as any).entityManager.removeAllEntities();
    }
  }

  clearConnections(): void {
    this.connections.clear();
  }

  private acceptConnections() {
    for (const transport of this.transports) {
      let channel;
      // eslint-disable-next-line no-cond-assign
      while (channel = transport.acceptConnection()) {
        let host;
        const connection = channel.authToken && this.connections.get(channel.authToken);
        if (connection) {
          host = connection.host as Host;
          if (host.connected) {
            console.error(`Rejected duplicate connection with authToken "${channel.authToken}`);
            continue;
          }
        } else {
          host = new Host(this.wireManager);
          const entity = this.world.createEntity().addComponent(Connection, {host});
          if (channel.authToken) this.connections.set(channel.authToken, entity.get(Connection));
        }
        host?.attach(channel, transport.maxPacketSize);
      }
    }
  }

  private receiveUpdates() {

  }
}


export class CopyValidReplicas extends System {
  static queries = {
    validReplicas: {components: [Valid]}
  };

  realWorld: World;

  execute(delta: number, time: number): void {
    // TODO: copy valid replicas to the real world
  }
}
