import { STATE_LABEL, type TaskState } from "../types";

export function StatusBadge({ state }: { state: TaskState }) {
  return <span className={`yyt-badge yyt-badge-${state}`}>{STATE_LABEL[state]}</span>;
}
