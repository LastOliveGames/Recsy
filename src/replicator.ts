import {
  Component, ComponentConstructor, Entity, NotComponent, System, SystemConstructor, World
} from 'ecsy';
import {clone, map, reject} from 'lodash-es';
import {componentClasses, unpooledComponentClasses} from './components';
import {
  CopyValidReplicas, OriginalValues, ReceiveReplicas, Replicate, SendOriginals
} from './systems';
import type {Transport, VerifyFn} from './transports';
import {WireManager, WireType} from './wire';


/**
 * The replicator manages and runs the entity replication system.  You should create it on your
 * world only after you registered all components that could potentially be replicated.  Every such
 * component needs to define a static `wireSchema` property that maps property names to instances
 * of `WireType`.
 *
 * The replicator will install systems for receiving replicated data at priorities -110 to -100, and
 * for sending replicated data at priorities 100 to 110.  Prioritize your own systems accordingly;
 * most normal systems should probably be set to -100 < priority < 100.
 */
export class Replicator {
  private staging: World;
  transports: Transport[] = [];

  constructor(private readonly world: World) {
    for (const ComponentClass of unpooledComponentClasses) {
      world.registerComponent(ComponentClass, false);
    }
    for (const ComponentClass of componentClasses) world.registerComponent(ComponentClass);
    const wireManager = new WireManager(world);
    world.registerSystem(
      ReceiveReplicas, {priority: -101, transports: this.transports, wireManager});
    world.registerSystem(SendOriginals, {priority: 101, wireManager});
  }

  addTransport(transport: Transport): this {
    this.transports.push(transport);
    return this;
  }

  registerValidator<E extends Entity>(validator: SystemConstructor<System<E>>): this {
    this.initStaging();
    this.staging.registerSystem(validator);
    return this;
  }

  /**
   * Set up replication of a set of entities to other clients.  Entities selected by the `query`
   * will be replicated to connected clients when added and changed, and the replicas removed when
   * the entity is deleted.
   *
   * A given entity can only be selected by at most *one* replication expression -- no overlaps
   * allowed.  If you need to do that, you'll have to manually manage your queries and adding the
   * `Original` component to the entities.
   *
   * By default, only the (non-negated) components mentioned in the query will be replicated.  You
   * can override this via `original.replicatedComponents` but note that data changes are only
   * detected by the `query` so this should usually stay at its default value.
   *
   * By default, the entities will be replicated to all connected clients.  You can override this
   * via `original.approvedClients`.
   *
   * @param name The name of this replica set, used to name the generated system.
   * @param query The query selecting the entities to be replicated.
   * @param original The initial property values for the `Original` component that will be applied
   * to selected entities.
   */
  replicate(
    name: string,
    query: (ComponentConstructor<any> | NotComponent<any>)[],
    original: OriginalValues
  ): this {

    original = original ? clone(original) : {};
    if (!original.replicatedComponents) {
      original.replicatedComponents = reject(query, {type: 'not'}) as ComponentConstructor<any>[];
    }

    const SpecializedSystem = class SpecializedReplicate extends Replicate {
      static queries = {
        replicated: {components: query, listen: {added: true, removed: true, changed: true}}
      };

      static originalValues = original;
    };
    Object.defineProperty(SpecializedSystem, 'name', {value: name});
    this.world.registerSystem(SpecializedSystem, {priority: 100});
    return this;
  }

  async startServer(verifyAuthToken?: VerifyFn): Promise<void> {
    if (!this.transports.length) throw new Error('No transports added');
    await Promise.all(map(this.transports, transport => transport.startServer(verifyAuthToken)));
  }

  async startClient(authToken: string): Promise<void> {
    if (!this.transports.length) throw new Error('No transports added');
    await Promise.all(map(this.transports, transport => transport.startClient(authToken)));
  }

  async stop(): Promise<void> {
    await Promise.all(map(this.transports, transport => transport.stop()));
    this.world.getSystem(ReceiveReplicas).clearConnections();
  }

  private initStaging() {
    if (this.staging) return;
    this.staging = new World();
    this.staging.componentsManager = this.world.componentsManager;
    this.staging.registerSystem(CopyValidReplicas, {priority: 100, realWorld: this.world});
    this.world.getSystem(ReceiveReplicas).staging = this.staging;
  }

}


declare module 'ecsy' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ComponentConstructor<C extends Component<any>> {
    wireTypeId?: number;
    wireSchema?: {prop: string, wire: WireType}[];
  }

  interface World {
    componentsManager: {Components: ComponentConstructor<Component<any>>[]};
  }

}

