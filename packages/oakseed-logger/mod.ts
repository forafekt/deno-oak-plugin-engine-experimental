// modules/logger.ts
/**
 * Logger module
 * Provides structured logging with levels and metadata
 */


export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level?: LogLevel | string;
  prefix?: string;
  useColors?: boolean;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, ...meta: any[]): void;
  info(message: string, meta?: Record<string, unknown>): void;
  info(message: string, ...meta: any[]): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, meta?: Record<string, unknown>): void;
  error(message: string, ...meta: any[]): void;
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

const LOG_LEVELS: Record<LogLevel | string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  private level: LogLevel | string;
  private prefix: string;
  private useColors: boolean;

  constructor(
    level: LogLevel | string = "info",
    prefix: string | undefined = `[${this.getRootDirname()}]`,
    useColors: boolean = true
  ) {
    this.level = level;
    this.prefix = prefix || "";
    this.useColors = useColors && Deno.stdout.isTerminal();
  }

  private getRootDirname() {
    return Deno.cwd().split('/').pop() || "";
  }

  private shouldLog(level: LogLevel | string): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel | string,
    message: string,
    meta?: Record<string, unknown> | any[]
  ): string {
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "/").split("/").reverse().join("/");
    const timeStr = new Date().toISOString().split("T")[1].substring(0, 5);
    const timestamp = `${dateStr} ${timeStr}`;
    const levelUpper = level.toUpperCase().padEnd(5).trim();
    
    let output = "";

    if (this.useColors) {
      const color = LOG_COLORS[level as LogLevel];
      const reset = LOG_COLORS.reset;
      const dim = LOG_COLORS.dim;
      const bold = LOG_COLORS.bold;
      
      output = `${dim}${timestamp}${reset} ${color}[${levelUpper}]${reset} ${this.prefix}\n${bold}${message}${reset}\n`;
    } else {
      output = `${timestamp} [${levelUpper}] ${this.prefix}\n${message}\n`;
    }

    if (meta && Array.isArray(meta)) {
      const metaStr = JSON.stringify(meta, this.safeJsonReplacer(), 2);
      const indent = "  ";
      output += `\n${indent}${metaStr.split("\n").join("\n" + indent)}`;
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
    return (_key: string, value: unknown) => {
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

  debug(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown> | any[]): void {
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

  getLevel(): LogLevel | string {
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
    meta?: Record<string, unknown> | any[];
    timestamp: Date;
  }> = [];

  private level: LogLevel = "info";
  protected prefix: string = "[Test]";

  debug(message: string, meta?: Record<string, unknown> | any[]): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown> | any[]): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown> | any[]): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown> | any[]): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown> | any[]): void {
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
  options?: LoggerOptions
): Logger {
  return new ConsoleLogger(options?.level, options?.prefix, options?.useColors);
}

/**
 * Create a logger from environment variables
 */
export function createLoggerFromEnv(prefix: string | undefined): Logger {
  const level = Deno.env.get("LOG_LEVEL") as LogLevel | undefined;
  
  return createLogger(
    {
      level: level || "info",
      prefix,
      useColors: true
    }
  );
}