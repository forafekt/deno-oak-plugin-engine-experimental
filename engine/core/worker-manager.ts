// core/worker-manager.ts
/**
 * Worker Manager
 * Handles background job execution, scheduling, and queue management
 */

import type { Container } from "./container.ts";
import type { Logger } from "../modules/logger.ts";
import { EventEmitter } from "../modules/events.ts";

/**
 * Worker definition
 */

export interface WorkerDefinition {
  name: string;
  handler: WorkerHandler;
  schedule?: string; // Cron expression for scheduled workers
  timeout?: number; // Timeout in milliseconds
  retries?: number; // Number of retries on failure
  concurrency?: number; // Max concurrent executions
}

export type WorkerHandler = (
  payload: WorkerPayload,
  container: Container
) => Promise<WorkerResult>;

export interface WorkerPayload {
  tenantId?: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface WorkerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface RegisteredWorker {
  plugin: string;
  definition: WorkerDefinition;
  runCount: number;
  lastRun?: Date;
  runningInstances: number;
}

export const WorketStatusEnum = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMEOUT: "timeout",
} as const;

export type WorkerStatusType = typeof WorketStatusEnum[keyof typeof WorketStatusEnum];

export interface WorkerJob {
  id: string;
  plugin: string;
  worker: string;
  payload: WorkerPayload;
  status: WorkerStatusType;
  result?: WorkerResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

export interface WorkerStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export class WorkerManager {
  private workers = new Map<string, RegisteredWorker>();
  private jobs = new Map<string, WorkerJob>();
  private queue: WorkerJob[] = [];
  private logger: Logger;
  private running = false;
  private concurrency: number;
  private currentJobs = 0;
  private jobIdCounter = 0;
  private eventEmitter?: EventEmitter;
  private shutdownRequested = false;

  constructor(
    logger: Logger, 
    concurrency = 5,
    eventEmitter?: EventEmitter
  ) {
    this.logger = logger;
    this.concurrency = concurrency;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Register a worker
   */
  register(
    plugin: string,
    definition: WorkerDefinition
  ): void {
    const key = `${plugin}.${definition.name}`;
    
    if (this.workers.has(key)) {
      throw new Error(`Worker '${key}' is already registered`);
    }

    this.workers.set(key, {
      plugin,
      definition,
      runCount: 0,
      runningInstances: 0,
    });
    
    this.logger.debug(`Worker registered: ${key}`);

    // Emit event
    if (this.eventEmitter) {
      this.eventEmitter.emit("worker:registered", {
        plugin,
        worker: definition.name,
      });
    }
  }

  /**
   * Register multiple workers from a plugin
   */
  registerWorkers(plugin: string, workers: WorkerDefinition[]): void {
    for (const worker of workers) {
      this.register(plugin, worker);
    }
  }

  /**
   * Dispatch a worker job
   */
  async dispatch(
    plugin: string,
    workerName: string,
    payload: WorkerPayload,
    container: Container
  ): Promise<string> {
    const key = `${plugin}.${workerName}`;
    const worker = this.workers.get(key);

    if (!worker) {
      throw new Error(`Worker '${key}' not found`);
    }

    const jobId = this.generateJobId();
    const job: WorkerJob = {
      id: jobId,
      plugin,
      worker: workerName,
      payload,
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: worker.definition.retries ?? 1,
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);

    this.logger.debug(`Worker job dispatched: ${key} [${jobId}]`);

    // Emit event
    if (this.eventEmitter) {
      await this.eventEmitter.emit("worker:dispatched", {
        jobId,
        plugin,
        worker: workerName,
      });
    }

    // Start processing if not already running
    if (!this.running && !this.shutdownRequested) {
      this.processQueue(container);
    }

    return jobId;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): WorkerJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * List all jobs
   */
  listJobs(filter?: {
    status?: WorkerJob["status"];
    plugin?: string;
    worker?: string;
    tenantId?: string;
  }): WorkerJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter) {
      if (filter.status) {
        jobs = jobs.filter(j => j.status === filter.status);
      }
      if (filter.plugin) {
        jobs = jobs.filter(j => j.plugin === filter.plugin);
      }
      if (filter.worker) {
        jobs = jobs.filter(j => j.worker === filter.worker);
      }
      if (filter.tenantId) {
        jobs = jobs.filter(j => j.payload.tenantId === filter.tenantId);
      }
    }

    return jobs;
  }

  /**
   * Wait for a job to complete
   */
  async waitFor(jobId: string, timeout = 30000): Promise<WorkerResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = this.jobs.get(jobId);
      
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (job.status === "completed" && job.result) {
        return job.result;
      }

      if (job.status === "failed" || job.status === "timeout") {
        throw new Error(job.error || "Worker failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Job timeout: ${jobId}`);
  }

  /**
   * Cancel a job
   */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === "pending") {
      // Remove from queue
      const index = this.queue.findIndex(j => j.id === jobId);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
      
      job.status = "failed";
      job.error = "Job cancelled";
      job.completedAt = new Date();
      
      this.logger.debug(`Job cancelled: ${jobId}`);
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string, container: Container): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "failed") {
      throw new Error(`Cannot retry job ${jobId}`);
    }

    // Create new job with same payload
    return await this.dispatch(
      job.plugin,
      job.worker,
      job.payload,
      container
    );
  }

  /**
   * Process the job queue
   */
  private async processQueue(container: Container): Promise<void> {
    this.running = true;

    while (
      (this.queue.length > 0 || this.currentJobs > 0) && 
      !this.shutdownRequested
    ) {
      // Process jobs up to concurrency limit
      while (
        this.queue.length > 0 &&
        this.currentJobs < this.concurrency
      ) {
        const job = this.queue.shift()!;
        this.currentJobs++;
        
        // Don't await - run in parallel
        this.executeJob(job, container).catch(error => {
          this.logger.error("Unexpected error in job execution", {
            error: error.message,
          });
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.running = false;
    
    if (this.shutdownRequested) {
      this.logger.info("Worker manager stopped (shutdown requested)");
    }
  }

  /**
   * Execute a single job
   */
  private async executeJob(
    job: WorkerJob,
    container: Container
  ): Promise<void> {
    const key = `${job.plugin}.${job.worker}`;
    const worker = this.workers.get(key);

    if (!worker) {
      job.status = "failed";
      job.error = `Worker not found: ${key}`;
      job.completedAt = new Date();
      this.currentJobs--;
      return;
    }

    job.status = "running";
    job.startedAt = new Date();
    job.attempts++;
    worker.runningInstances++;

    this.logger.debug(`Executing worker: ${key} [${job.id}]`, {
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
    });

    // Emit event
    if (this.eventEmitter) {
      await this.eventEmitter.emit("worker:started", {
        jobId: job.id,
        plugin: job.plugin,
        worker: job.worker,
      });
    }

    try {
      // Get tenant container if tenant is specified
      let workerContainer = container;
      if (job.payload.tenantId) {
        const tenantManager = container.has("tenantManager") 
          ? container.resolve<any>("tenantManager") 
          : null;
        
        if (tenantManager) {
          const tenantContainer = tenantManager.getContainer(job.payload.tenantId);
          if (tenantContainer) {
            workerContainer = tenantContainer;
          }
        }
      }

      // Execute with timeout
      const timeout = worker.definition.timeout || 30000;
      const result = await this.executeWithTimeout(
        worker.definition.handler(job.payload, workerContainer),
        timeout
      );

      job.status = "completed";
      job.result = result;
      job.completedAt = new Date();
      worker.runCount++;
      worker.lastRun = new Date();

      this.logger.debug(`Worker completed: ${key} [${job.id}]`);

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit("worker:completed", {
          jobId: job.id,
          plugin: job.plugin,
          worker: job.worker,
          result,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes("timeout");

      // Check if we should retry
      if (job.attempts < job.maxAttempts && !isTimeout) {
        job.status = "pending";
        this.queue.push(job);
        
        this.logger.warn(`Worker failed, will retry: ${key} [${job.id}]`, {
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: errorMessage,
        });
      } else {
        job.status = isTimeout ? "timeout" : "failed";
        job.error = errorMessage;
        job.completedAt = new Date();

        this.logger.error(`Worker failed: ${key} [${job.id}]`, {
          error: errorMessage,
          attempts: job.attempts,
        });

        // Emit event
        if (this.eventEmitter) {
          await this.eventEmitter.emit("worker:failed", {
            jobId: job.id,
            plugin: job.plugin,
            worker: job.worker,
            error: errorMessage,
          });
        }
      }
    } finally {
      worker.runningInstances--;
      this.currentJobs--;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Worker timeout")), timeout)
      ),
    ]);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    this.jobIdCounter++;
    return `job_${Date.now()}_${this.jobIdCounter}`;
  }

  /**
   * Clear completed jobs (cleanup)
   */
  clearCompleted(olderThan?: number): number {
    const cutoff = olderThan 
      ? Date.now() - olderThan 
      : 0;

    let cleared = 0;
    
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt &&
        job.completedAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} completed jobs`);
    }

    return cleared;
  }

  /**
   * Get queue stats
   */
  getStats(): WorkerStats {
    const jobs = Array.from(this.jobs.values());
    return {
      queued: jobs.filter(j => j.status === "pending").length,
      running: jobs.filter(j => j.status === "running").length,
      completed: jobs.filter(j => j.status === "completed").length,
      failed: jobs.filter(j => j.status === "failed" || j.status === "timeout").length,
      total: jobs.length,
    };
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(plugin?: string, worker?: string): Array<{
    plugin: string;
    worker: string;
    runCount: number;
    runningInstances: number;
    lastRun?: Date;
  }> {
    const stats: Array<any> = [];

    for (const [key, registered] of this.workers.entries()) {
      if (plugin && registered.plugin !== plugin) continue;
      if (worker && registered.definition.name !== worker) continue;

      stats.push({
        plugin: registered.plugin,
        worker: registered.definition.name,
        runCount: registered.runCount,
        runningInstances: registered.runningInstances,
        lastRun: registered.lastRun,
      });
    }

    return stats;
  }

  /**
   * Get registered workers
   */
  listWorkers(plugin?: string): Array<{
    plugin: string;
    name: string;
    schedule?: string;
    timeout?: number;
    retries?: number;
  }> {
    const workers: Array<any> = [];

    for (const [_, registered] of this.workers.entries()) {
      if (plugin && registered.plugin !== plugin) continue;

      workers.push({
        plugin: registered.plugin,
        name: registered.definition.name,
        schedule: registered.definition.schedule,
        timeout: registered.definition.timeout,
        retries: registered.definition.retries,
      });
    }

    return workers;
  }

  /**
   * Set concurrency limit
   */
  setConcurrency(concurrency: number): void {
    if (concurrency < 1) {
      throw new Error("Concurrency must be at least 1");
    }
    this.concurrency = concurrency;
    this.logger.debug(`Worker concurrency set to ${concurrency}`);
  }

  /**
   * Get concurrency limit
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Check if queue is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Shutdown the worker manager
   */
  async shutdown(graceful = true): Promise<void> {
    this.shutdownRequested = true;
    this.logger.info("Shutting down worker manager...");

    if (graceful) {
      // Wait for running jobs to complete
      const maxWait = 30000; // 30 seconds
      const startTime = Date.now();

      while (this.currentJobs > 0 && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (this.currentJobs > 0) {
        this.logger.warn(`${this.currentJobs} jobs still running after graceful shutdown timeout`);
      }
    }

    // Clear pending jobs
    this.queue = [];
    this.logger.info("Worker manager shut down");
  }
}