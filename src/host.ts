import type {Entity} from 'ecsy';
import {PrivateOriginal, Replica} from './components';
import type {Channel} from './transports/interfaces';
import {WireManager, WireReader, WireWriter} from './wire';

type ProcessUpdate = (entityId: number, wireId: number, reader: WireReader) => void;

const TIME_DELTA_STABILITY = 0.9;
const reader = new WireReader();


export class Host {
  private channel: Channel | undefined;
  private packet: WireWriter;
  private numQueuedEntities: number;
  authToken: string | undefined;
  timeDelta = 0;

  constructor(readonly wireManager: WireManager) {}

  attach(channel: Channel, maxPacketSize: number): void {
    if (this.channel?.connected) throw new Error('Host cannot replace a connected channel');
    if (this.authToken !== channel.authToken) {
      throw new Error('Host cannot attach channel with a different auth token');
    }
    this.channel = channel;
    this.authToken = channel.authToken;
    if (this.packet?.maxOutputLength !== maxPacketSize) {
      this.packet = new WireWriter(maxPacketSize);
      this.resetPacket();
    }
  }

  detach(): void {
    this.channel = undefined;
  }

  get connected(): boolean {return !!this.channel?.connected;}

  queueEntityUpdate(entity: Entity, writer?: WireWriter): void {
    if (!this.channel) return;
    const replica = entity.getComponent(Replica);
    const wireId = replica?.sourceConnection?.host === this ?
      replica.sourceWireId : entity.get(PrivateOriginal).wireId;
    this.packet.uint32(wireId);
    if (writer) {
      this.packet.bytes(writer.output);
    } else {
      this.wireManager.writeEntityToWire(entity, this.packet);
    }
    this.numQueuedEntities += 1;
  }

  flushUpdates(time: number): void {
    if (this.channel) {
      this.packet.rewind();
      this.packet.uint32(time * 1000);
      this.packet.uint16(this.numQueuedEntities);
      this.channel.send(this.packet.output);
    }
    this.resetPacket();
  }

  private resetPacket() {
    this.packet.reset();
    this.packet.uint32(0);
    this.packet.uint16(0);
    this.numQueuedEntities = 0;
  }

  receiveUpdates(time: number, process: ProcessUpdate): boolean {
    if (!this.channel) return false;
    let buffer;
    try {
      while (buffer = this.channel.receive()) {  // eslint-disable-line no-cond-assign
        reader.reset(buffer);
        this.timeDelta =
          this.timeDelta * TIME_DELTA_STABILITY +
          (1 - TIME_DELTA_STABILITY) * (performance.now() - reader.uint32()) / 1000;
        const numEntities = reader.uint16();
        for (let i = 0; i < numEntities; i++) {
          const wireId = reader.uint32();

        }
      }
    } catch (e) {
      if (!e.closed) console.warn(e.toString());
      return false;
    }
    return true;
  }
}
