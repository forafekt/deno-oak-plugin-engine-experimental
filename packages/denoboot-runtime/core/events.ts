// ============================================================================
// core/events.ts - Event bus
// ============================================================================

import { SimpleEventEmitter } from "@denoboot/events/mod.ts";


export class EventEmitter extends SimpleEventEmitter {
  constructor() {
    super();
    this.setMaxListeners(10);
  }
}

// export class EventEmitter {
//   private listeners = new Map<string, Set<Function>>();

//   on(event: string, handler: Function): void {
//     if (!this.listeners.has(event)) {
//       this.listeners.set(event, new Set());
//     }
//     this.listeners.get(event)!.add(handler);
//   }

//   off(event: string, handler: Function): void {
//     this.listeners.get(event)?.delete(handler);
//   }

//   emit(event: string, ...args: any[]): void {
//     const handlers = this.listeners.get(event);
//     if (handlers) {
//       for (const handler of handlers) {
//         handler(...args);
//       }
//     }
//   }

//   once(event: string, handler: Function): void {
//     const wrappedHandler = (...args: any[]) => {
//       handler(...args);
//       this.off(event, wrappedHandler);
//     };
//     this.on(event, wrappedHandler);
//   }
// }