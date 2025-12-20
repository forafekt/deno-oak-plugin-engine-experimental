// engine/runtime/reload_graph.ts


export class ReloadGraph {
private deps = new Map<string, Set<string>>();


addEdge(from: string, to: string) {
if (!this.deps.has(from)) this.deps.set(from, new Set());
this.deps.get(from)!.add(to);
}


affected(entry: string): Set<string> {
const out = new Set<string>();
const visit = (n: string) => {
if (out.has(n)) return;
out.add(n);
this.deps.get(n)?.forEach(visit);
};
visit(entry);
return out;
}
}