// engine/runtime/module_registry.ts
const moduleCache = new Map<string, unknown>();

export async function loadModule(specifier: string) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier);
  }

  const mod = await import(specifier);
  moduleCache.set(specifier, mod);
  return mod;
}
