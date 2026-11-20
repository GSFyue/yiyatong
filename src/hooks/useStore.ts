import { useSyncExternalStore } from "react";
import { getLimits, getTasks, subscribe } from "../sync";
import type { Limits, Task } from "../types";

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks, getTasks);
}

export function useLimits(): Limits {
  return useSyncExternalStore(subscribe, getLimits, getLimits);
}
