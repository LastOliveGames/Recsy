import {Component, System} from 'ecsy';
import {ModifiedOriginal, Original} from '../components';


export type OriginalValues = Partial<Omit<Original, keyof Component<any>>>;


export abstract class Replicate extends System {
  static originalValues: OriginalValues;

  execute(delta: number, time: number): void {
    for (const entity of this.queries.replicated.added!) {
      if (entity.hasComponent(Original)) {
        throw new Error(
          `Entity selected by replicator ${this.constructor.name} already being replicated`);
      }
      entity.addComponent(Original, (this.constructor as typeof Replicate).originalValues);
    }
    for (const entity of this.queries.replicated.removed!) {
      entity.removeComponent(Original);
    }
    for (const entity of this.queries.replicated.changed!) {
      if (!entity.hasComponent(ModifiedOriginal)) entity.addComponent(ModifiedOriginal);
    }
  }
}
