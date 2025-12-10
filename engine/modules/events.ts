// engine/modules/events.ts
/** EventBus
 *
 * Simple event emitter used across the engine. Supports:
 *  - on(event, handler)
 *  - off(event, handler)
 *  - once(event, handler)
 *  - emit(event, payload)
 *
 * Special wildcard event "*" will receive all events.
 */

export type EventHandler<T = any> = (payload: T, meta?: { event: string }) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  off(event: string, handler?: EventHandler) {
    if (!this.handlers.has(event)) return this;
    if (!handler) {
      this.handlers.delete(event);
      return this;
    }
    this.handlers.get(event)!.delete(handler);
    return this;
  }

  once(event: string, handler: EventHandler) {
    const wrapper = async (payload: any, meta?: { event: string }) => {
      try {
        await handler(payload, meta);
      } finally {
        this.off(event, wrapper);
      }
    };
    // @ts-ignore - wrapper signature matches
    return this.on(event, wrapper);
  }

  async emit(event: string, payload?: any) {
    const specific = Array.from(this.handlers.get(event) ?? []);
    const wildcard = Array.from(this.handlers.get("*") ?? []);
    const all = specific.concat(wildcard);
    const meta = { event };
    for (const h of all) {
      try {
        await h(payload, meta);
      } catch (e) {
        // swallow handler errors; individual listeners should handle their own errors
        console.error("EventBus handler error for event", event, e);
      }
    }
  }
}

export const events = new EventBus();

export function createEventEmitter() {
  return new EventBus();
}


export class SimpleEventEmitter extends EventBus {

  constructor() {
    super();
  }
  
}