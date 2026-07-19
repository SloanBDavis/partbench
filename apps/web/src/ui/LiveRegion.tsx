import type { ReactNode } from "react";

export function LiveRegion({
  children,
  urgency = "polite",
  visuallyHidden = false
}: {
  readonly children: ReactNode;
  readonly urgency?: "polite" | "assertive";
  readonly visuallyHidden?: boolean;
}) {
  return (
    <div
      className={visuallyHidden ? "pb-visually-hidden" : "pb-live-region"}
      role={urgency === "assertive" ? "alert" : "status"}
      aria-live={urgency}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
