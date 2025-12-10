// engine/core/container.ts

import { Container } from "./types.ts";

/** Lightweight named DI container used across the engine.
 *
 * Supports:
 *  - registerValue(key, value)
 *  - registerSingleton(key, constructor)
 *  - registerFactory(key, factory)
 *  - registerTransient(key, constructor)
 *  - resolve(key)
 */
export type Constructor<T = any> = new (...args: any[]) => T;
export type Factory<T = any> = () => T;

export interface Binding<T = any> {
  type: "singleton" | "transient";
  value?: T;
  constructor?: Constructor<T>;
  factory?: Factory<T>;
}

export class DIContainer implements Container {
  bindings = new Map<string, Binding | any>();
  parent: DIContainer | null = null;

  register<T>(name: string, instance: T): void {
      this.bindings.set(name, { type: "singleton", value: instance });
  }
  registerFactory<T>(name: string, factory: (container: Container) => T | Promise<T>): void {
    // register a factory
    this.bindings.set(name, { type: "factory", factory });
  }
  registerSingleton<T>(name: string, factory: (container: Container) => T | Promise<T>): void {
   // register a singleton
   this.bindings.set(name, { type: "singleton", factory });
  }
  resolve<T>(name: string): T {
    return this.bindings.get(name)?.value as T;
  }
  resolveAsync<T>(name: string): Promise<T> {
    return Promise.resolve(this.bindings.get(name)?.value as T);
  }
  has(name: string): boolean {
    return this.bindings.has(name);
  }
  createChild(): DIContainer {
  this.parent = this;
      return new DIContainer()
  }
  getParent(): DIContainer | null {
      return this.parent;
  }
}

export const globalContainer = new DIContainer();
