// engine/runtime/dev_runtime.ts


type ReloadReason = "app" | "plugin" | "dependency";


interface ReloadEvent {
reason: ReloadReason;
changed: string[];
timestamp: number;
}


export class DevRuntime {
private version = 0;
private listeners = new Set<(e: ReloadEvent) => void>();


onReload(fn: (e: ReloadEvent) => void) {
this.listeners.add(fn);
}


emit(event: ReloadEvent) {
this.version++;
for (const l of this.listeners) l(event);
}


importFresh<T = unknown>(path: string): Promise<T> {
return import(`${path}?v=${this.version}`) as Promise<T>;
}
}