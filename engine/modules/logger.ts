export interface LoggerOptions {
  level?: "debug" | "info" | "warn" | "error";
  format?: "json" | "text";
  timestamp?: boolean;
  colors?: boolean;
  prefix?: string;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  data?: any;
  prefix?: string;
}

export class Logger {
  private level: string;
  private format: string;
  private timestamp: boolean;
  private colors: boolean;
  private prefix?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || "info";
    this.format = options.format || "text";
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? (Deno.env.get("NODE_ENV") !== "production");
    this.prefix = options.prefix;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      this.log("debug", message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog("info")) {
      this.log("info", message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog("warn")) {
      this.log("warn", message, data);
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog("error")) {
      this.log("error", message, data);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: string, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      prefix: this.prefix,
    };

    const output = this.format === "json"
      ? JSON.stringify(entry)
      : this.formatText(entry);

    const consoleMethod = level === "error" ? "error"
      : level === "warn" ? "warn"
      : level === "info" ? "info"
      : "debug";

    console[consoleMethod](output);
  }

  private formatText(entry: LogEntry): string {
    let output = "";

    if (this.timestamp) {
      const timestamp = entry.timestamp.toISOString();
      output += this.colors ? `\x1b[90m${timestamp}\x1b[0m ` : `${timestamp} `;
    }

    if (this.prefix) {
      output += this.colors ? `\x1b[35m[${this.prefix}]\x1b[0m ` : `[${this.prefix}] `;
    }

    const levelColor = this.getLevelColor(entry.level);
    const levelText = entry.level.toUpperCase().padEnd(5);
    
    if (this.colors && levelColor) {
      output += `${levelColor}${levelText}\x1b[0m `;
    } else {
      output += `${levelText} `;
    }

    output += entry.message;

    if (entry.data) {
      output += " " + (typeof entry.data === "object"
        ? JSON.stringify(entry.data, null, this.format === "json" ? 2 : 0)
        : String(entry.data));
    }

    return output;
  }

  private getLevelColor(level: string): string {
    switch (level) {
      case "debug": return "\x1b[36m"; // Cyan
      case "info": return "\x1b[32m"; // Green
      case "warn": return "\x1b[33m"; // Yellow
      case "error": return "\x1b[31m"; // Red
      default: return "\x1b[0m"; // Reset
    }
  }

  child(context: Record<string, any>): Logger {
    const child = new Logger({
      level: this.level as any,
      format: this.format as any,
      timestamp: this.timestamp,
      colors: this.colors,
      prefix: this.prefix,
    });

    const originalLog = child["log"].bind(child);
    child["log"] = (level: string, message: string, data?: any) => {
      originalLog(level, message, { ...context, ...data });
    };

    return child;
  }

  setLevel(level: "debug" | "info" | "warn" | "error"): void {
    this.level = level;
  }

  setFormat(format: "json" | "text"): void {
    this.format = format;
  }
}


export const logger = new Logger({ colors: true, format: "text", level: "debug", prefix: "[Kernel]", timestamp: true });



export function createLogger(options?: LoggerOptions) {
  return new Logger(options);
}

export class ConsoleLogger extends Logger {
  constructor() {
    super();
  }
}