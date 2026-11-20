import type { ReactNode } from "react";

export function BigCard({
  icon,
  label,
  sub,
  onClick,
  guide,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  guide?: string;
}) {
  return (
    <button type="button" className="yp-big-card" onClick={onClick} data-guide={guide}>
      <span className="yp-big-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="yp-big-card-label">{label}</span>
      <span className="yp-big-card-sub">{sub}</span>
    </button>
  );
}
