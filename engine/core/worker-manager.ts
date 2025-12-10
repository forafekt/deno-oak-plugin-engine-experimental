// engine/core/worker-manager.ts
/** WorkerManager
 *
 * Simple pool/registry for Web Workers used by plugins and engine tasks.
 * Each worker is registered under an id and can be used to run tasks
 * which return responses via a simple request/response message envelope.
 *
 * Assumptions:
 *  - worker scripts follow a small protocol: they receive { taskId, payload }
 *    and post back { taskId, result } or { taskId, error }.
 */

import { logger } from "../modules/logger.ts";
import { Logger } from "./types.ts";

export interface WorkerTask {
  taskId: string;
  resolve: (value: any) => void;
  reject: (err: any) => void;
  timeout?: any;
}

export class WorkerManager {
  private workers = new Map<string, Worker>();
  private pending = new Map<string, WorkerTask>();
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }

  async waitFor(taskId: string, timeoutMs = 30_000): Promise<any> {
    return await this.runTask(taskId, null, timeoutMs);
  }

  createWorker(id: string, scriptUrl: string | URL, options: WorkerOptions = { type: "module" }) {
    if (!scriptUrl) {
      logger.warn("WorkerManager.createWorker: missing scriptUrl");
      return;
    }
    if (this.workers.has(id)) return this.workers.get(id)!;
    const worker = new Worker(scriptUrl, options);

    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data || {};
      const { taskId, result, error } = data;
      if (!taskId) return;
      const task = this.pending.get(taskId);
      if (!task) return;
      if (error) task.reject(error);
      else task.resolve(result);
      this.pending.delete(taskId);
    };

    worker.onerror = (err) => {
      // try to reject any pending tasks that belong to this worker
      for (const [taskId, task] of this.pending.entries()) {
        // we don't track which task belongs to which worker in this minimal impl,
        // so we only log here. Plugins should design their own task scoping if needed.
      }
      console.error("WorkerManager: worker error", err);
    };

    this.workers.set(id, worker);
    return worker;
  }

  runTask<T = any>(workerId: string, payload: any, timeoutMs = 30_000): Promise<T> {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker '${workerId}' not found`);
    const taskId = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const t: WorkerTask = { taskId, resolve, reject };
      this.pending.set(taskId, t);

      // attach timeout
      if (timeoutMs && timeoutMs > 0) {
        t.timeout = setTimeout(() => {
          this.pending.delete(taskId);
          reject(new Error("Worker task timed out"));
        }, timeoutMs);
      }

      worker.postMessage({ taskId, payload });
    });
  }

  terminateWorker(id: string) {
    const w = this.workers.get(id);
    if (!w) return;
    try {
      w.terminate();
    } finally {
      this.workers.delete(id);
    }
  }

  terminateAll() {
    for (const id of Array.from(this.workers.keys())) {
      this.terminateWorker(id);
    }
  }

  getStats() {
    return { workers: Array.from(this.workers.values()), pending: Array.from(this.pending.values()) };
  }

  getJob(id: string) {
    return this.pending.get(id);
  }

  dispatch(plugin: string, worker: string, payload: any, container: any, timeoutMs = 30_000): Promise<any> {
    return this.runTask(plugin, payload, timeoutMs);
  }

  registerWorkers(plugin: string, workers: Record<string, any>[]) {
    for (const worker of workers) {
      this.createWorker(`${plugin}:${worker?.id || worker?.name}`, worker?.scriptUrl);
    }
  }
}
