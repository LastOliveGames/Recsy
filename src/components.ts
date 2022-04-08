import {Component, ComponentConstructor, TagComponent, Types} from 'ecsy';

// REMEMBER TO UPDATE THE LIST OF COMPONENT TYPES AT THE BOTTOM OF THIS FILE!


/**
 * Represents a connected host, either a client or the server.  Entities with these components get
 * created and destroyed automatically as hosts connect and disconnect.  These components are not
 * pooled so it's safe to reference them even after the host has been permanently disconnected.
 */
export class Connection extends Component<Connection> {
  /**
   * This is an internal object, please don't access it.
   */
  readonly host: unknown;

  /**
   * The auth token a client provided when connecting to the server, if any.
   */
  readonly authToken: string | undefined;

  /**
   * Whether this connection is currently connected, or waiting for a reconnection.
   */
  connected: boolean;

  static schema = {
    host: {type: Types.Ref},
    authToken: {type: Types.String, default: undefined},
    connected: {type: Types.Boolean}
  };
}


/**
 * Marks an entity that should be replicated to other hosts -- by default, all of them.
 */
export class Original extends Component<Original> {
  /**
   * The maximum update frequency in updates per second.  If zero (the default) then updates aren't
   * throttled. Can be updated dynamically.
   */
  maxUpdateFrequency: number;

  /**
  * The component types that will be replicated to other hosts.  All listed types must have a
  * `wireSchema` defined, so this is only useful for omitting some components from being replicated.
  * It's OK to list component types that haven't (yet) been attached to the entity, they'll just be
  * skipped.
  *
  * This list must be not be changed after initialization; doing so will have inconsistent effects.
  */
  replicatedComponents: ComponentConstructor<any>[];

  /**
   * Optionally constrains which other hosts the entity will be replicated to.  The list of
   * connections can be changed dynamically at any time, and disconnected connections will be
   * removed automatically.  A `null` value (the default) will replicate the entity to all hosts.
   *
   * If a connection is removed from the list the entity will stop being replicated to that host but
   * the replica won't be deleted.  If an original entity with this constraint is deleted it will be
   * deleted from all hosts it was ever replicated to, even if they're not currently in the list.
   */
  approvedConnections: Connection[] | null;

  static schema = {
    maxUpdateFrequency: {type: Types.Number},
    replicatedComponents: {type: Types.Array},
    approvedConnections: {type: Types.Array, default: null}
  };
}


/**
 * Internal counterpart to the Original component, used to store transformed or previous values.
 */
export class PrivateOriginal extends Component<PrivateOriginal> {
  wireId: number;
  lastApprovedConnections: Connection[];
  replicatedConnections: Connection[];
  updatePeriod: number;
  lastSentTime: number;

  static schema = {
    id: {type: Types.Number, default: undefined},
    lastApprovedConnections: {type: Types.Array, default: undefined},
    replicatedConnections: {type: Types.Array, default: undefined},
    updatePeriod: {type: Types.Number},
    lastSentTime: {type: Types.Number, default: -Infinity}
  };
}


/**
 * Used to tag Original entities as having been modified and needing to be replicated again.  You
 * don't need to use the tag when the Original component is first added.  The tag gets removed
 * automatically after the entity has been replicated.  If you use the Replicator.replicate method
 * then this tag is managed for you, so it's only for when you need to take manual control of
 * replication.
 */
export class ModifiedOriginal extends TagComponent {}


/**
 * An internal tag for entities whose replication has been delayed due to maxUpdateFrequency.
 */
export class ThrottledOriginal extends TagComponent {}

/**
 * An internal tag for entities that should be replicated to all hosts.
 */
export class BroadcastOriginal extends TagComponent {}


export class Valid extends TagComponent {}


export class Replica extends Component<Replica> {
  sourceConnection: Connection;
  sourceWireId: number;
  lastUpdateTime: number;
  lastUpdateReceivedTime: number;
  lastUpdatingConnection: Connection;

  static schema = {
    sourceConnection: {type: Types.Ref},
    sourceId: {type: Types.Number},
    lastUpdateTime: {type: Types.Number},
    lastUpdateReceivedTime: {type: Types.Number},
    lastUpdatingConnection: {type: Types.Ref}
  };
}


export const unpooledComponentClasses: ComponentConstructor<Component<any>>[] = [
  Connection
];

export const componentClasses: ComponentConstructor<Component<any>>[] = [
  Original, PrivateOriginal, ModifiedOriginal, ThrottledOriginal, BroadcastOriginal, Valid, Replica
];

