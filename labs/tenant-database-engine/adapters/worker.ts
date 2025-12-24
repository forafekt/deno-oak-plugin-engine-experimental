// adapters/worker.ts
import type {
  DatabaseAdapter,
  Job,
  JobContext,
  JobHandler,
  JobOptions,
  WorkerAdapter,
  WorkerConfig,
} from "../types.ts";

export class BackgroundWorkerAdapter implements WorkerAdapter {
  private handlers = new Map<string, JobHandler>();
  private isRunning = false;
  private processingInterval?: number;
  private cleanupInterval?: number;
  private config: WorkerConfig;

  constructor(
    private databaseAdapter: DatabaseAdapter,
    config: WorkerConfig = {},
  ) {
    this.config = {
      concurrency: config.concurrency || 5,
      pollInterval: config.pollInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      cleanupInterval: config.cleanupInterval || 60000,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start job processing
    this.processingInterval = setInterval(
      () => this.processJobs(),
      this.config.pollInterval,
    );

    // Start cleanup
    this.cleanupInterval = setInterval(
      () => this.databaseAdapter.cleanup(),
      this.config.cleanupInterval,
    );

    await Promise.resolve();
    console.log("Background worker started");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await Promise.resolve();
    console.log("Background worker stopped");
  }

  async addJob(
    type: string,
    payload: Record<string, unknown>,
    options: JobOptions = {},
  ): Promise<string> {
    const job: Job = {
      id: crypto.randomUUID(),
      tenantId: options.tenantId || null,
      type,
      payload,
      priority: options.priority || 0,
      attempts: 0,
      maxRetries: options.maxRetries || this.config.maxRetries!,
      scheduledAt: new Date(Date.now() + (options.delay || 0)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dataAccess = this.databaseAdapter.getDataAccess();
    await dataAccess.execute(
      `
        INSERT INTO mt_jobs (
          id, tenant_id, type, payload, priority, attempts, max_retries, 
          scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        job.id,
        job.tenantId,
        job.type,
        JSON.stringify(job.payload),
        job.priority,
        job.attempts,
        job.maxRetries,
        job.scheduledAt,
        job.createdAt,
        job.updatedAt,
      ],
    );

    return job.id;
  }

  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  async processJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const dataAccess = this.databaseAdapter.getDataAccess();

      // Fetch available jobs
      const jobs = await dataAccess.query(
        `
          SELECT * FROM mt_jobs 
          WHERE scheduled_at <= NOW() 
          AND completed_at IS NULL 
          AND failed_at IS NULL 
          ORDER BY priority DESC, created_at ASC 
          LIMIT ?
        `,
        [this.config.concurrency],
      );

      if (jobs.length === 0) {
        return;
      }

      // Process jobs concurrently
      const promises = jobs.map((jobRow) => this.processJob(jobRow));
      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Error processing jobs:", error);
    }
  }

  private async processJob(jobRow: any): Promise<void> {
    const job: Job = {
      id: jobRow.id,
      tenantId: jobRow.tenant_id,
      type: jobRow.type,
      payload: JSON.parse(jobRow.payload),
      priority: jobRow.priority,
      attempts: jobRow.attempts,
      maxRetries: jobRow.max_retries,
      scheduledAt: new Date(jobRow.scheduled_at),
      createdAt: new Date(jobRow.created_at),
      updatedAt: new Date(jobRow.updated_at),
      completedAt: jobRow.completed_at
        ? new Date(jobRow.completed_at)
        : undefined,
      failedAt: jobRow.failed_at ? new Date(jobRow.failed_at) : undefined,
      error: jobRow.error,
    };

    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.warn(`No handler found for job type: ${job.type}`);
      await this.markJobAsFailed(job, "No handler found");
      return;
    }

    const dataAccess = this.databaseAdapter.getDataAccess();

    try {
      // Update job as processing
      await dataAccess.execute(
        `
          UPDATE mt_jobs 
          SET attempts = attempts + 1, updated_at = NOW() 
          WHERE id = ?
        `,
        [job.id],
      );

      job.attempts++;

      // Create job context
      const context: JobContext = {
        job,
        tenantId: job.tenantId,
        attempt: job.attempts,
        dataAccess: this.databaseAdapter.getDataAccess(
          job.tenantId || undefined,
        ),
      };

      // Execute handler
      await handler(job.payload, context);

      // Mark as completed
      await dataAccess.execute(
        `
          UPDATE mt_jobs 
          SET completed_at = NOW(), updated_at = NOW() 
          WHERE id = ?
        `,
        [job.id],
      );

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);

      if (job.attempts >= job.maxRetries) {
        await this.markJobAsFailed(job, (error as Error).message);
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(job.attempts);
        await dataAccess.execute(
          `
            UPDATE mt_jobs 
            SET scheduled_at = DATE_ADD(NOW(), INTERVAL ? MILLISECOND),
                error = ?,
                updated_at = NOW() 
            WHERE id = ?
          `,
          [retryDelay, (error as Error).message, job.id],
        );
      }
    }
  }

  private async markJobAsFailed(job: Job, error: string): Promise<void> {
    const dataAccess = this.databaseAdapter.getDataAccess();
    await dataAccess.execute(
      `
        UPDATE mt_jobs 
        SET failed_at = NOW(), error = ?, updated_at = NOW() 
        WHERE id = ?
      `,
      [error, job.id],
    );
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay!;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attempts - 1),
      30000,
    );
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.floor(exponentialDelay + jitter);
  }
}
