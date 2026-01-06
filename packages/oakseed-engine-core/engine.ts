// packages/oakseed-engine-core/engine.ts

/**
 * OakSeed Engine contract interface
 *
 * @property {string} name - Name of the engine
 * @property {Promise<void>} initialize - Initialize the engine
 * @property {Promise<void>} boot - Boot the engine
 * @property {Promise<void>} listen - Listen for incoming connections
 * @property {Promise<void>} shutdown - Shutdown the engine
 */
export interface OakSeedEngine {
  /**
   * Name of the engine
   */
  readonly name: string;

  /**
   * Initialize the engine
   */
  initialize(): Promise<void>;

  /**
   * Boot the engine
   */
  boot(): Promise<void>;

  /**
   * Listen for incoming connections
   * 
   * This is not required unless the engine needs to bind to a port for long-running services
   * and requires an HTTP server to be started.
   */
  listen?(): Promise<void>;

  /**
   * Shutdown the engine
   */
  shutdown?(): Promise<void>;
}
