import { DEFAULT_LIMITS, type Limits, type Task } from "./types";
import { seedTasks, upgradeSeedTasks, SEED_VERSION } from "./seed";

const CH = "yiyatong-v1";
const TASK_KEY = "yyt:tasks:v1";
const LIMIT_KEY = "yyt:limits:v1";
const SEED_KEY = "yyt:seed:v1";
const VOICE_KEY = "yyt:voice:v1";
const PASSCODE_KEY = "yyt:passcode:v1";
const VERSION_KEY = "yyt:version:v1";
const FOCUS_KEY = "yyt:focus:v1";
const REJECT_KEY = "yyt:reject:v1";

export const KEYS = { TASK_KEY, LIMIT_KEY, SEED_KEY, VOICE_KEY, PASSCODE_KEY, VERSION_KEY, FOCUS_KEY, REJECT_KEY };

type Listener = () => void;
const listeners = new Set<Listener>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式或配额用尽时降级为纯内存态，不阻断流程
  }
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadTasks(): Task[] {
  return readJSON<Task[]>(TASK_KEY, []);
}

export function saveTasks(list: Task[]): void {
  writeRaw(TASK_KEY, JSON.stringify(list));
}

export function loadLimits(): Limits {
  const stored = readJSON<Partial<Limits>>(LIMIT_KEY, {});
  return {
    perTx: typeof stored.perTx === "number" ? stored.perTx : DEFAULT_LIMITS.perTx,
    perDay: typeof stored.perDay === "number" ? stored.perDay : DEFAULT_LIMITS.perDay,
    nightStart: typeof stored.nightStart === "number" ? stored.nightStart : DEFAULT_LIMITS.nightStart,
    nightEnd: typeof stored.nightEnd === "number" ? stored.nightEnd : DEFAULT_LIMITS.nightEnd,
    passcode: typeof stored.passcode === "string" ? stored.passcode : undefined,
    trustedList: Array.isArray(stored.trustedList) ? stored.trustedList : [],
  };
}

export function saveLimits(limits: Limits): void {
  writeRaw(LIMIT_KEY, JSON.stringify(limits));
}

let tasksSnapshot: Task[] = [];
let limitsSnapshot: Limits = clone(DEFAULT_LIMITS);
let tasksRaw = "";
let limitsRaw = "";
let lastSyncAt = Date.now();
/** 单调递增的状态版本：只有版本变大时才落盘，避免 storage 事件互相触发写死循环。 */
let version = Number(readRaw(VERSION_KEY) || 0);

export function getVersion(): number {
  return version;
}

function emit(): void {
  listeners.forEach((l) => l());
}

function setTasks(list: Task[]): void {
  tasksSnapshot = list;
  tasksRaw = JSON.stringify(list);
  lastSyncAt = Date.now();
  emit();
}

function setLimits(limits: Limits): void {
  limitsSnapshot = limits;
  limitsRaw = JSON.stringify(limits);
  lastSyncAt = Date.now();
  emit();
}

let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(CH);
} catch {
  bc = null;
}

function broadcast(message: unknown): void {
  try {
    bc?.postMessage(message);
  } catch {
    // 通道不可用时靠 storage 事件与轮询兜底
  }
}

if (bc) {
  bc.onmessage = (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; list?: Task[]; limits?: Limits; version?: number; taskId?: string; reason?: string; ts?: number }
      | null;
    if (!data) return;
    if (data.type === "tasks" && Array.isArray(data.list)) {
      if (typeof data.version === "number") {
        if (data.version < version) return;
        version = data.version;
      }
      setTasks(data.list);
      return;
    }
    if (data.type === "limits" && data.limits) {
      setLimits(data.limits);
      return;
    }
    if (data.type === "focus" && data.taskId) {
      emitSignal({ type: "focus", taskId: data.taskId, ts: data.ts ?? Date.now() });
      return;
    }
    if (data.type === "reject-request" && data.taskId) {
      emitSignal({ type: "reject-request", taskId: data.taskId, ts: data.ts ?? Date.now() });
      return;
    }
    if (data.type === "reject-reply" && data.taskId) {
      emitSignal({ type: "reject-reply", taskId: data.taskId, reason: data.reason ?? "", ts: data.ts ?? Date.now() });
    }
  };
}

addEventListener("storage", (event) => {
  if (event.key === TASK_KEY) setTasks(loadTasks());
  if (event.key === LIMIT_KEY) setLimits(loadLimits());
  if (event.key === FOCUS_KEY) {
    const data = readJSON<{ taskId?: string; ts?: number } | null>(FOCUS_KEY, null);
    if (data?.taskId) emitSignal({ type: "focus", taskId: data.taskId, ts: data.ts ?? Date.now() });
  }
  if (event.key === REJECT_KEY) {
    const data = readJSON<{ type?: string; taskId?: string; reason?: string; ts?: number } | null>(REJECT_KEY, null);
    if (data?.taskId && data.type === "reject-request") {
      emitSignal({ type: "reject-request", taskId: data.taskId, ts: data.ts ?? Date.now() });
    }
    if (data?.taskId && data.type === "reject-reply") {
      emitSignal({ type: "reject-reply", taskId: data.taskId, reason: data.reason ?? "", ts: data.ts ?? Date.now() });
    }
  }
});

/** 所有写操作：先落盘 → 再广播 → 再刷新本地视图。内容没变就不落盘，保证写入幂等。 */
export function commitTasks(mut: (draft: Task[]) => Task[] | void): Task[] {
  const base = clone(loadTasks());
  const out = mut(base);
  const next = out ?? base;
  const raw = JSON.stringify(next);
  if (raw === tasksRaw) return next;
  writeRaw(TASK_KEY, raw);
  version += 1;
  writeRaw(VERSION_KEY, String(version));
  broadcast({ type: "tasks", list: next, version, ts: Date.now() });
  setTasks(next);
  return next;
}

export function commitLimits(mut: (draft: Limits) => Limits | void): Limits {
  const base = clone(loadLimits());
  const out = mut(base);
  const next = out ?? base;
  const raw = JSON.stringify(next);
  if (raw === limitsRaw) return next;
  writeRaw(LIMIT_KEY, raw);
  version += 1;
  writeRaw(VERSION_KEY, String(version));
  broadcast({ type: "limits", limits: next, version, ts: Date.now() });
  setLimits(next);
  return next;
}

export function getTasks(): Task[] {
  return tasksSnapshot;
}

export function getLimits(): Limits {
  return limitsSnapshot;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastSyncAt(): number {
  return lastSyncAt;
}

export type Signal =
  | { type: "focus"; taskId: string; ts: number }
  | { type: "reject-request"; taskId: string; ts: number }
  | { type: "reject-reply"; taskId: string; reason: string; ts: number };

const signalListeners = new Set<(signal: Signal) => void>();

export function subscribeSignal(listener: (signal: Signal) => void): () => void {
  signalListeners.add(listener);
  return () => {
    signalListeners.delete(listener);
  };
}

function emitSignal(signal: Signal): void {
  signalListeners.forEach((l) => l(signal));
}

export type SignalInput =
  | { type: "focus"; taskId: string }
  | { type: "reject-request"; taskId: string }
  | { type: "reject-reply"; taskId: string; reason: string };

/** 跨上下文的一次性信号（定位高亮、拒绝原因问询），走同一条广播通道。 */
export function sendSignal(signal: SignalInput): void {
  const full = { ...signal, ts: Date.now() } as Signal;
  const key = full.type === "focus" ? FOCUS_KEY : REJECT_KEY;
  writeRaw(key, JSON.stringify(full));
  broadcast(full);
}

/** 清空本机数据；保留种子标记，避免刷新后演示数据自动回来。 */
export function clearAll(): void {
  [TASK_KEY, LIMIT_KEY, VOICE_KEY, PASSCODE_KEY].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 忽略
    }
  });
  tasksSnapshot = [];
  tasksRaw = "[]";
  limitsSnapshot = clone(DEFAULT_LIMITS);
  limitsRaw = JSON.stringify(limitsSnapshot);
  version += 1;
  writeRaw(VERSION_KEY, String(version));
  broadcast({ type: "tasks", list: tasksSnapshot, version, ts: Date.now() });
  broadcast({ type: "limits", limits: limitsSnapshot, version, ts: Date.now() });
  emit();
}

function initSeed(): void {
  const marker = readRaw(SEED_KEY);
  if (!marker) {
    writeRaw(TASK_KEY, JSON.stringify(seedTasks()));
    writeRaw(SEED_KEY, String(SEED_VERSION));
    return;
  }
  if (Number(marker) < SEED_VERSION) {
    const current = loadTasks();
    const upgraded = upgradeSeedTasks(current);
    if (JSON.stringify(upgraded) !== JSON.stringify(current)) writeRaw(TASK_KEY, JSON.stringify(upgraded));
    writeRaw(SEED_KEY, String(SEED_VERSION));
  }
}

initSeed();
tasksSnapshot = loadTasks();
tasksRaw = JSON.stringify(tasksSnapshot);
limitsSnapshot = loadLimits();
limitsRaw = JSON.stringify(limitsSnapshot);

setInterval(() => {
  const raw = readRaw(TASK_KEY);
  if (raw !== null && raw !== tasksRaw) setTasks(loadTasks());
  const lraw = readRaw(LIMIT_KEY);
  if (lraw !== null && lraw !== limitsRaw) setLimits(loadLimits());
}, 1000);
