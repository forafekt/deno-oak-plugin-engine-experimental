// ============================================================================
// hmr/protocol.ts - WebSocket messages
// ============================================================================
export type HMRMessage =
  | { type: "connected" }
  | { type: "update"; updates: HMRUpdate[] }
  | { type: "full-reload"; path?: string }
  | { type: "error"; error: { message: string; stack?: string } }
  | { type: "pong" };

export interface HMRUpdate {
  path: string;
  code: string;
  timestamp: number;
  type: "js-update" | "css-update";
}

export function encodeMessage(message: HMRMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(data: string): HMRMessage {
  return JSON.parse(data);
}

