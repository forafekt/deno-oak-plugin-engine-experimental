// core/container.ts
/**
 * Dependency Injection Container
 * Manages service registration and resolution with support for
 * factories, singletons, and hierarchical scoping
 */

export interface Container {
  // Service registration
  register<T>(name: string, instance: T): void;
  registerFactory<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void;
  registerSingleton<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void;
  
  // Service resolution
  resolve<T>(name: string): T;
  resolveAsync<T>(name: string): Promise<T>;
  has(name: string): boolean;
  
  // Scoping
  createChild(): Container;
  getParent(): Container | null;
  
  // Additional methods
  list(): string[];
  clear(): void;
}

type ServiceFactory<T> = (container: Container) => T | Promise<T>;

interface ServiceRegistration<T> {
  type: "instance" | "factory" | "singleton";
  value: T | ServiceFactory<T>;
  singleton?: T;
}

export class DIContainer implements Container {
  private services = new Map<string, ServiceRegistration<unknown>>();
  private parent: Container | null = null;

  constructor(parent?: Container) {
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
  registerFactory<T>(
    name: string,
    factory: ServiceFactory<T>
  ): void {
    this.services.set(name, {
      type: "factory",
      value: factory,
    });
  }

  /**
   * Register a singleton factory (called once, cached)
   */
  registerSingleton<T>(
    name: string,
    factory: ServiceFactory<T>
  ): void {
    this.services.set(name, {
      type: "singleton",
      value: factory,
    });
  }

  /**
   * Resolve a service synchronously
   */
  resolve<T>(name: string): T {
    const registration = this.services.get(name);

    if (!registration) {
      // Try parent container
      if (this.parent && this.parent.has(name)) {
        return this.parent.resolve<T>(name);
      }
      throw new Error(`Service not found: ${name}`);
    }

    switch (registration.type) {
      case "instance":
        return registration.value as T;

      case "factory": {
        const factory = registration.value as ServiceFactory<T>;
        const result = factory(this);
        if (result instanceof Promise) {
          throw new Error(
            `Service '${name}' is async. Use resolveAsync() instead.`
          );
        }
        return result;
      }

      case "singleton": {
        if (registration.singleton !== undefined) {
          return registration.singleton as T;
        }
        const factory = registration.value as ServiceFactory<T>;
        const result = factory(this);
        if (result instanceof Promise) {
          throw new Error(
            `Service '${name}' is async. Use resolveAsync() instead.`
          );
        }
        registration.singleton = result;
        return result;
      }

      default:
        throw new Error(`Unknown registration type for service: ${name}`);
    }
  }

  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T>(name: string): Promise<T> {
    const registration = this.services.get(name);

    if (!registration) {
      // Try parent container
      if (this.parent && this.parent.has(name)) {
        return this.parent.resolveAsync<T>(name);
      }
      throw new Error(`Service not found: ${name}`);
    }

    switch (registration.type) {
      case "instance":
        return Promise.resolve(registration.value as T);

      case "factory": {
        const factory = registration.value as ServiceFactory<T>;
        return await Promise.resolve(factory(this));
      }

      case "singleton": {
        if (registration.singleton !== undefined) {
          return Promise.resolve(registration.singleton as T);
        }
        const factory = registration.value as ServiceFactory<T>;
        const result = await Promise.resolve(factory(this));
        registration.singleton = result;
        return result;
      }

      default:
        throw new Error(`Unknown registration type for service: ${name}`);
    }
  }

  /**
   * Check if a service exists
   */
  has(name: string): boolean {
    if (this.services.has(name)) {
      return true;
    }
    return this.parent ? this.parent.has(name) : false;
  }

  /**
   * Create a child container (for tenant-scoped services)
   */
  createChild(): Container {
    return new DIContainer(this);
  }

  /**
   * Get parent container
   */
  getParent(): Container | null {
    return this.parent;
  }

  /**
   * List all registered services (debugging)
   */
  list(): string[] {
    const keys = Array.from(this.services.keys());
    if (this.parent) {
      // Avoid duplicates
      const parentKeys = this.parent.list().filter(k => !keys.includes(k));
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
  clone(): Container {
    const cloned = this.parent ? new DIContainer(this.parent) : new DIContainer();
    this.services.forEach((registration, name) => {
      cloned.services.set(name, { ...registration });
    });
    return cloned;
  }
}

/**
 * Create a new container instance
 */
export function createContainer(parent?: Container): Container {
  return new DIContainer(parent);
}