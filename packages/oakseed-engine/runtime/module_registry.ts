// engine/runtime/module_registry.ts
const moduleCache = new Map<string, unknown>();

export async function loadModule<T = unknown>(specifier: string): Promise<T> {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier) as T;
  }

  const mod = await import(specifier);
  moduleCache.set(specifier, mod);
  return mod as T;
}