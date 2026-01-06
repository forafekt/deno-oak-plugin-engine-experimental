// deno-lint-ignore-file no-explicit-any
// core/container.ts
/**
 * Dependency Injection Container
 * Manages service registration and resolution with support for
 * factories, singletons, and hierarchical scoping
 */

export interface Container<Entries extends Record<string, unknown> = any> {
  // Service registration
  register<T>(name: string, instance: T): void;
  registerFactory<T>(
    name: string,
    factory: (container: Container<Entries>) => T | Promise<T>
  ): void;
  registerSingleton<T>(
    name: string,
    factory: (container: Container<Entries>) => T | Promise<T>
  ): void;
  
  // Service resolution
 resolve<T, K extends keyof Entries = keyof Entries>(name: K): T extends object ? T : Entries[K];
  resolveAsync<T, K extends keyof Entries = keyof Entries>(name: K): Promise<T extends object ? T : Entries[K]>;
  has<K extends keyof Entries = keyof Entries>(name: K): boolean;
  
  // Scoping
  createChild<ChildEntries extends Record<string, unknown> = Record<string, unknown>>(): Container<ChildEntries>;
  getParent(): Container<Entries> | null;
  
  // Additional methods
  list(): (keyof Entries)[];
  clear(): void;
}

type ServiceFactory<T, Entries extends Record<string, unknown> = Record<string, unknown>> = (container: Container<Entries>) => T | Promise<T>;

interface ServiceRegistration<T> {
  type: "instance" | "factory" | "singleton";
  value: T | ServiceFactory<T>;
  singleton?: T;
}

export class DIContainer<Entries extends Record<string, unknown> = Record<string, unknown>> implements Container<Entries> {
  private services = new Map<string, ServiceRegistration<unknown>>();
  private parent: DIContainer<any> | null = null;

  constructor(parent?: DIContainer<Entries>) {
    this.parent = parent || null;
  }

  /**
   * Register a direct instance
   */
  register<T>(name: string, instance: T): void {
    this.services.set(name, {
      type: "instance",
      value: instance,
    });
  }

  /**
   * Register a factory function (called each time)
   */
  registerFactory<T, E extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    factory: ServiceFactory<T, E>,
  ): void {
    this.services.set(name, {
      type: "factory",
      value: factory,
    });
  }

  /**
   * Register a singleton factory (called once, cached)
   */
  registerSingleton<T, E extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    factory: ServiceFactory<T, E>
  ): void {
    this.services.set(name, {
      type: "singleton",
      value: factory,
    });
  }

  /**
   * Resolve a service synchronously
   */
  resolve<T, K extends keyof Entries = keyof Entries>(name: K): T extends object ? T : Entries[K] {
    type R = T extends object ? T : Entries[K];

    const registration = this.services.get(name as string);

    if (!registration) {
      // Try parent container
      if (this.parent && this.parent.has(name)) {
        return this.parent.resolve<R>(name);
      }
      throw new Error(`Service not found: ${String(name)}`);
    }

    switch (registration.type) {
      case "instance":
        return registration.value as R;

      case "factory": {
        const factory = registration.value as ServiceFactory<R, Entries>;
        const result = factory(this);
        if (result instanceof Promise) {
          throw new Error(
            `Service '${String(name)}' is async. Use resolveAsync() instead.`
          );
        }
        return result as R;
      }

      case "singleton": {
        if (registration.singleton !== undefined) {
          return registration.singleton as R;
        }
        const factory = registration.value as ServiceFactory<R, Entries>;
        const result = factory(this);
        if (result instanceof Promise) {
          throw new Error(
            `Service '${String(name)}' is async. Use resolveAsync() instead.`
          );
        }
        registration.singleton = result;
        return result;
      }

      default:
        throw new Error(`Unknown registration type for service: ${String(name)}`);
    }
  }

  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T, K extends keyof Entries = keyof Entries>(name: K): Promise<T extends object ? T : Entries[K]> {
    type R = T extends object ? T : Entries[K];

    const registration = this.services.get(name as string);

    if (!registration) {
      // Try parent container
      if (this.parent && this.parent.has(name)) {
        return this.parent.resolveAsync<R>(name);
      }
      throw new Error(`Service not found: ${String(name)}`);
    }

    switch (registration.type) {
      case "instance":
        return Promise.resolve(registration.value as R);

      case "factory": {
        const factory = registration.value as ServiceFactory<R, Entries>;
        return await Promise.resolve(factory(this));
      }

      case "singleton": {
        if (registration.singleton !== undefined) {
          return Promise.resolve(registration.singleton as R);
        }
        const factory = registration.value as ServiceFactory<R, Entries>;
        const result = await Promise.resolve(factory(this));
        registration.singleton = result;
        return result;
      }

      default:
        throw new Error(`Unknown registration type for service: ${String(name)}`);
    }
  }

  /**
   * Check if a service exists
   */
  has<K extends keyof Entries = keyof Entries>(name: K): boolean {
    if (this.services.has(name.toString())) {
      return true;
    }
    return this.parent ? this.parent.has(name) : false;
  }

  /**
   * Create a child container (for tenant-scoped services)
   */
  createChild<ChildEntries extends Record<string, unknown> = Record<string, unknown>>() {
    return new DIContainer<ChildEntries>(this) as Container<ChildEntries>;
  }

  /**
   * Get parent container
   */
  getParent(): Container<Entries> | null {
    return this.parent as Container<Entries> | null;
  }

  /**
   * List all registered services (debugging)
   */
  list(): (keyof Entries)[] {
    const keys = Array.from(this.services.keys()) as (keyof Entries)[];
    if (this.parent) {
      // Avoid duplicates
      const parentKeys = this.parent.list().filter(k => !keys.includes(k.toString())) as (keyof Entries)[];
      return [...keys, ...parentKeys];
    }
    return keys;
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Remove a specific service
   */
  remove(name: string): boolean {
    return this.services.delete(name);
  }

  /**
   * Get the raw registration (for debugging/inspection)
   */
  getRegistration(name: string): ServiceRegistration<unknown> | undefined {
    return this.services.get(name);
  }

  /**
   * Check if a service is a singleton
   */
  isSingleton(name: string): boolean {
    const registration = this.services.get(name);
    return registration?.type === "singleton";
  }

  /**
   * Clone the container (shallow copy of services)
   */
  clone() {
    const cloned = this.parent ? new DIContainer(this.parent) : new DIContainer();
    this.services.forEach((registration, name) => {
      cloned.services.set(String(name), { ...registration });
    });
    return cloned;
  }
}

/**
 * Create a new container instance
 */
export function createContainer<Entries extends Record<string, unknown> = Record<string, unknown>>(parent?: DIContainer<Entries>){
  return new DIContainer<Entries>(parent);
}

// export function createContainerTyped<Entries extends Record<string, unknown> = Record<string, unknown>>(parent?: Container): ContainerTyped<Entries> {
//   return new DIContainer(parent) as ContainerTyped<Entries>;
// }

// export interface ContainerTyped<Entries extends Record<string, unknown> = Record<string, unknown>> extends Omit<Container, "resolve" | "resolveAsync" | "has" | "getParent" | "list">  {
//   resolve<T, K extends keyof Entries = keyof Entries>(name: K): T extends object ? T : Entries[K];
//   resolveAsync<T, K extends keyof Entries = keyof Entries>(name: K): Promise<T extends object ? T : Entries[K]>;
//   has(name: keyof Entries): boolean;
//   getParent(): ContainerTyped<Entries> | null;
//   list(): Array<keyof Entries>;
// }

