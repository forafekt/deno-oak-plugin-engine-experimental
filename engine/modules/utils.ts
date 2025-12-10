// engine/modules/utils.ts
/**
 * Utility functions
 */

/**
 * Load JSON file
 */
export async function loadJSON<T>(path: string): Promise<T> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content) as T;
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

/**
 * Walk directory recursively
 */
export async function* walkDir(
  dir: string,
  extensions?: string[]
): AsyncIterableIterator<string> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      
      if (entry.isDirectory) {
        yield* walkDir(path, extensions);
      } else if (entry.isFile) {
        if (!extensions || extensions.some(ext => path.endsWith(ext))) {
          yield path;
        }
      }
    }
  } catch {
    // Directory doesn't exist, ignore
  }
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target;
  
  const result = { ...target };
  
  for (const source of sources) {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (isObject(sourceValue) && isObject(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Safe async function wrapper
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<[T | null, Error | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    if (errorMessage) {
      return [null, new Error(`${errorMessage}: ${error.message}`)];
    }
    return [null, error];
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate unique ID
 */
export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Parse connection string
 */
export function parseConnectionString(
  connectionString: string
): Record<string, string> {
  const url = new URL(connectionString);
  return {
    protocol: url.protocol.replace(":", ""),
    hostname: url.hostname,
    port: url.port,
    username: url.username,
    password: url.password,
    pathname: url.pathname.slice(1),
    database: url.pathname.slice(1),
  };
}