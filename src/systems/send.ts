import {Entity, System} from 'ecsy';
import {clone, difference, intersection} from 'lodash-es';
import {
  BroadcastOriginal, Connection, ModifiedOriginal, Original, PrivateOriginal, ThrottledOriginal
} from '../components';
import type {Host} from '../host';
import {WireManager, WireWriter} from '../wire';


const writer = new WireWriter();
const emptyEntityWriter = new WireWriter(1);
emptyEntityWriter.uint8(0);


export class SendOriginals extends System {
  static queries = {
    originals: {components: [Original], listen: {added: true, removed: true, changed: true}},
    modifiedOriginals: {components: [Original, PrivateOriginal, ModifiedOriginal]},
    throttledOriginals: {components: [Original, PrivateOriginal, ThrottledOriginal]},
    broadcastOriginals: {components: [Original, PrivateOriginal, BroadcastOriginal]},
    connections: {components: [Connection], listen: {added: true, removed: true}}
  };

  private wireManager: WireManager;
  private connections: Connection[] = [];

  init({wireManager}: {wireManager: WireManager}): void {
    this.wireManager = wireManager;
  }

  execute(delta: number, time: number): void {
    this.scanConnections();
    this.scanAddedOriginals(time);
    this.scanRemovedOriginals();
    this.releaseThrottledOriginals(time);
    this.throttleModifiedOriginals(time);
    this.scanChangedOriginals();
    this.scanModifiedOriginals(time);
  }

  private scanConnections() {
    const added = this.queries.connections.added!.length;
    const removed = this.queries.connections.removed!.length;
    if (added || removed) {
      this.connections.length = 0;
      for (const entity of this.queries.connections.results) {
        this.connections.push(entity.get(Connection));
      }
      // If connections were removed, we need to clear out obsolete references from user-specified
      // `approvedConnections`;
      const originalsToScan =
        removed ? this.queries.originals.results : this.queries.broadcastOriginals.results;
      for (const entity of originalsToScan) this.updateApprovedConnections(entity);
    }
  }

  private scanAddedOriginals(time: number) {
    for (const entity of this.queries.originals.added!) {
      if (entity.hasComponent(ModifiedOriginal)) entity.removeComponent(ModifiedOriginal, true);
      entity.addComponent(PrivateOriginal);
      const original = entity.get(Original);
      const priv = entity.mutate(PrivateOriginal);
      if (!original.replicatedComponents.length) {
        throw new Error('Original has no replicated components');
      }
      if (original.replicatedComponents.length >= 256) {
        throw new Error(
          'Original has too many replicated components: ' + original.replicatedComponents.length);
      }
      if (!original.approvedConnections) entity.addComponent(BroadcastOriginal);
      const approvedConnections = original.approvedConnections ?? this.connections;
      priv.lastApprovedConnections = clone(approvedConnections);
      priv.replicatedConnections = clone(approvedConnections);
      priv.updatePeriod = original.maxUpdateFrequency ? 1000 / original.maxUpdateFrequency : 0;
      priv.lastSentTime = time;
      this.wireManager.trackEntity(entity);
      this.sendModified(entity, approvedConnections, time);
    }
  }

  private scanRemovedOriginals() {
    for (const entity of this.queries.originals.removed!) {
      const priv = entity.get(PrivateOriginal);
      this.sendRemoved(entity, priv.replicatedConnections);
      this.wireManager.forgetEntity(entity);
      entity.removeComponent(PrivateOriginal, true);
    }
  }

  private releaseThrottledOriginals(time: number) {
    const throttled = this.queries.throttledOriginals.results;
    for (let i = throttled.length - 1; i >= 0; i--) {
      const entity = throttled[i];
      const priv = entity.get(PrivateOriginal);
      if (priv.lastSentTime + priv.updatePeriod <= time) {
        entity.removeComponent(ThrottledOriginal, true);
        this.sendModified(entity, priv.lastApprovedConnections, time);
      }
    }
  }

  private throttleModifiedOriginals(time: number) {
    const modified = this.queries.modifiedOriginals.results;
    for (let i = modified.length - 1; i >= 0; i--) {
      const entity = modified[i];
      const priv = entity.get(PrivateOriginal);
      if (priv.lastSentTime + priv.updatePeriod > time) {
        entity.removeComponent(ModifiedOriginal, true).addComponent(ThrottledOriginal);
      }
    }
  }

  private scanChangedOriginals() {
    for (const entity of this.queries.originals.changed!) {
      this.updateApprovedConnections(entity);
      this.updateFrequency(entity);
    }
  }

  private updateApprovedConnections(entity: Entity) {
    const original = entity.get(Original);
    if (original.approvedConnections) {
      entity.removeComponent(BroadcastOriginal);
    } else if (!entity.hasComponent(BroadcastOriginal)) {
      entity.addComponent(BroadcastOriginal);
    }
    const approvedConnections =
      intersection(original.approvedConnections, this.connections) ?? this.connections;
    if (original.approvedConnections &&
        approvedConnections.length !== original.approvedConnections.length) {
      entity.mutate(Original).approvedConnections = approvedConnections;
    }
    const lastApprovedConnections = entity.get(PrivateOriginal).lastApprovedConnections;
    const addedConnections = difference(approvedConnections, lastApprovedConnections);
    const removedConnections = difference(lastApprovedConnections, approvedConnections);
    if (removedConnections.length && original.approvedConnections &&
      entity.hasComponent(ThrottledOriginal)) {
      throw new Error('Approved connections removed while throttled update pending on original');
    }
    if (addedConnections.length && !entity.hasComponent(ModifiedOriginal)) {
      this.sendModified(entity, addedConnections);
    }
    if (addedConnections.length || removedConnections.length) {
      const priv = entity.mutate(PrivateOriginal);
      if (addedConnections.length) priv.replicatedConnections.push(...addedConnections);
      if (addedConnections.length || removedConnections.length) {
        priv.lastApprovedConnections.splice(
          0, priv.lastApprovedConnections.length, ...approvedConnections);
      }
    }
  }

  private updateFrequency(entity: Entity) {
    const original = entity.get(Original);
    const updatePeriod = original.maxUpdateFrequency ? 1 / original.maxUpdateFrequency : 0;
    if (updatePeriod !== entity.get(PrivateOriginal).updatePeriod) {
      entity.mutate(PrivateOriginal).updatePeriod = updatePeriod;
    }
  }

  private scanModifiedOriginals(time: number) {
    const modified = this.queries.modifiedOriginals.results;
    for (let i = modified.length - 1; i >= 0; i--) {
      const entity = modified[i];
      entity.removeComponent(ModifiedOriginal, true);
      this.sendModified(entity, entity.get(PrivateOriginal).lastApprovedConnections, time);
    }
  }

  private sendModified(entity: Entity, connections: Connection[], time?: number) {
    if (!connections.length) return;
    if (connections.length === 1) {
      // Write directly into the packet, saving us a copy.
      (connections[0].host as Host).queueEntityUpdate(entity);
    } else {
      writer.reset();
      this.wireManager.writeEntityToWire(entity, writer);
      for (const connection of connections) {
        (connection.host as Host).queueEntityUpdate(entity, writer);
      }
    }
    if (time !== undefined) entity.mutate(PrivateOriginal).lastSentTime = time;
  }

  private sendRemoved(entity: Entity, connections: Connection[]) {
    for (const connection of connections) {
      (connection.host as Host).queueEntityUpdate(entity, emptyEntityWriter);
    }
  }
}
