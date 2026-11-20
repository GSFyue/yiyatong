import { useSyncExternalStore } from "react";

export interface GuideState {
  active: boolean;
  index: number;
}

let state: GuideState = { active: false, index: 0 };
const listeners = new Set<() => void>();

export function getGuide(): GuideState {
  return state;
}

export function setGuide(patch: Partial<GuideState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeGuide(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGuide(): GuideState {
  return useSyncExternalStore(subscribeGuide, getGuide, getGuide);
}
