// modules/logger.ts
/**
 * Logger module
 * Provides structured logging with levels and metadata
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  useColors?: boolean;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  setPrefix(prefix: string): void;
}

const LOG_COLORS = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private prefix: string;
  private useColors: boolean;

  constructor(
    level: LogLevel = "info",
    prefix: string = "[Cortex]",
    useColors: boolean = true
  ) {
    this.level = level;
    this.prefix = prefix;
    this.useColors = useColors && typeof process !== "undefined" && process.stdout?.isTTY;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    
    let output = "";

    if (this.useColors) {
      const color = LOG_COLORS[level];
      const reset = LOG_COLORS.reset;
      const dim = LOG_COLORS.dim;
      
      output = `${dim}${timestamp}${reset} ${color}[${levelUpper}]${reset} ${this.prefix} ${message}`;
    } else {
      output = `${timestamp} [${levelUpper}] ${this.prefix} ${message}`;
    }
    
    if (meta && Object.keys(meta).length > 0) {
      const metaStr = JSON.stringify(meta, this.safeJsonReplacer(), 2);
      const indent = "  ";
      output += `\n${indent}${metaStr.split("\n").join("\n" + indent)}`;
    }
    
    return output;
  }

  private safeJsonReplacer(): (key: string, value: unknown) => unknown {
    const seen = new WeakSet();
    return (key: string, value: unknown) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      
      // Handle special types
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      
      if (typeof value === "function") {
        return "[Function]";
      }
      
      if (typeof value === "bigint") {
        return value.toString() + "n";
      }
      
      return value;
    };
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, meta));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  getPrefix(): string {
    return this.prefix;
  }
}

/**
 * Null logger that does nothing (useful for testing)
 */
export class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  setLevel(): void {}
  setPrefix(): void {}
}

/**
 * Logger that stores logs in memory (useful for testing)
 */
export class MemoryLogger implements Logger {
  private logs: Array<{
    level: LogLevel;
    message: string;
    meta?: Record<string, unknown>;
    timestamp: Date;
  }> = [];

  private level: LogLevel = "info";
  private prefix: string = "[Test]";

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] >= LOG_LEVELS[this.level]) {
      this.logs.push({
        level,
        message,
        meta,
        timestamp: new Date(),
      });
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getLogs(): typeof this.logs {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  getLogsByLevel(level: LogLevel): typeof this.logs {
    return this.logs.filter(log => log.level === level);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  level: LogLevel = "info",
  prefix = "[Cortex]",
  useColors = true
): Logger {
  return new ConsoleLogger(level, prefix, useColors);
}

/**
 * Create a logger from environment variables
 */
export function createLoggerFromEnv(prefix = "[Cortex]"): Logger {
  const level = (
    typeof process !== "undefined" 
      ? process.env?.LOG_LEVEL 
      : (globalThis as any).Deno?.env?.get?.("LOG_LEVEL")
  ) as LogLevel | undefined;
  
  return createLogger(
    level || "info",
    prefix
  );
}