import { currentBase } from "./router";
import { KEYS } from "./sync";
import type { Task } from "./types";

export function encodePayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayload<T>(encoded: string): T | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

/** 6 位数字口令，由任务内容派生，口述时按 3+3 分组。 */
export function makePasscode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return String(hash % 1000000).padStart(6, "0");
}

export function formatPasscode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export interface TaskPayload {
  id: string;
  kind: Task["kind"];
  title: string;
  from: string;
  to: string;
  amount: number;
  channel: string;
  at: number;
}

/** 父母端 → 子女端的跨设备链接。 */
export function buildChildLink(task: Task): string {
  const payload: TaskPayload = {
    id: task.id,
    kind: task.kind,
    title: task.title,
    from: task.from,
    to: task.to,
    amount: task.amount,
    channel: task.channel,
    at: task.at,
  };
  return `${currentBase()}#/child?task=${encodePayload(payload)}`;
}

/** 子女端 → 父母端的回执链接。带上任务本体，跨设备时父母端也能建档。 */
export function buildReceiptLink(task: Task): string {
  const payload = {
    id: task.id,
    state: task.state,
    reason: task.reason,
    task: {
      kind: task.kind,
      title: task.title,
      from: task.from,
      to: task.to,
      amount: task.amount,
      channel: task.channel,
      at: task.at,
    },
  };
  return `${currentBase()}#/parent?receipt=${encodePayload(payload)}`;
}

/** 同设备兜底：口令 → 任务 id 的本地映射。 */
export function rememberPasscode(code: string, taskId: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(KEYS.PASSCODE_KEY) || "{}") as Record<string, string>;
    map[code] = taskId;
    localStorage.setItem(KEYS.PASSCODE_KEY, JSON.stringify(map));
  } catch {
    // 忽略
  }
}

export function lookupPasscode(code: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(KEYS.PASSCODE_KEY) || "{}") as Record<string, string>;
    return map[code.trim()] ?? null;
  } catch {
    return null;
  }
}
