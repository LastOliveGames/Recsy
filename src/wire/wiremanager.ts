import type {Component, ComponentConstructor, Entity, World} from 'ecsy';
import {Original, PrivateOriginal} from '../components';
import {uint16, uint32, uint8, WireType} from './wiretypes';
import type {WireWriter} from './wirewriter';

export class WireManager {
  private nextEntityId = 0;
  private componentIdWireType: WireType;
  private entityByWireId = new Map<number, Entity>();

  constructor(private readonly world: World) {
    this.assignComponentWireTypeIds();
  }

  private assignComponentWireTypeIds() {
    let numComponentTypes = 0;
    for (const ComponentType of this.world.componentsManager.Components) {
      if (ComponentType.wireSchema) ComponentType.wireTypeId = numComponentTypes++;
    }
    if (numComponentTypes < 2 ** 8) this.componentIdWireType = uint8;
    else if (numComponentTypes < 2 ** 16) this.componentIdWireType = uint16;
    else if (numComponentTypes < 2 ** 32) this.componentIdWireType = uint32;
    else throw new Error('Too many component types: ' + numComponentTypes);
  }

  trackEntity(entity: Entity): void {
    const wireId = this.nextEntityId++;
    entity.mutate(PrivateOriginal).wireId = wireId;
    this.entityByWireId.set(wireId, entity);
  }

  forgetEntity(entity: Entity): void {
    this.entityByWireId.delete(entity.get(PrivateOriginal).wireId);
  }

  getEntity(wireId: number): Entity | undefined {
    return this.entityByWireId.get(wireId);
  }

  writeEntityToWire(entity: Entity, writer: WireWriter): void {
    const replicatedComponents = entity.get(Original).replicatedComponents;
    writer.uint8(replicatedComponents.length);
    for (const ComponentType of replicatedComponents) {
      if (entity.hasComponent(ComponentType)) {
        this.writeComponentToWire(entity.get(ComponentType), writer);
      }
    }
  }

  private writeComponentToWire(component: Readonly<any>, writer: WireWriter): void {
    const ComponentType = component.constructor as ComponentConstructor<Component<any>>;
    const wireSchema = ComponentType.wireSchema;
    if (!wireSchema) {
      throw new Error('Shared component missing wireSchema: ' + ComponentType.name);
    }
    this.componentIdWireType.write(writer, ComponentType.wireTypeId);
    for (const {prop, wire} of wireSchema) {
      wire.write(writer, (component as any)[prop]);
    }
  }

}
