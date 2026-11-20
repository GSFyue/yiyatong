import { useSyncExternalStore } from "react";

export interface SplitState {
  active: boolean;
  frameLoaded: boolean;
  frameFailed: boolean;
}

let state: SplitState = { active: false, frameLoaded: false, frameFailed: false };
const listeners = new Set<() => void>();

export function getSplit(): SplitState {
  return state;
}

export function setSplit(patch: Partial<SplitState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeSplit(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSplit(): SplitState {
  return useSyncExternalStore(subscribeSplit, getSplit, getSplit);
}
