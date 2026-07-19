import { useId, type ReactElement, type ReactNode } from "react";

/** Focus/hover tooltip primitive. The trigger receives the relationship ID. */
export function Tooltip({
  children,
  content
}: {
  readonly children: (props: {
    readonly "aria-describedby": string;
  }) => ReactElement;
  readonly content: ReactNode;
}) {
  const id = useId();
  return (
    <span className="pb-tooltip">
      {children({ "aria-describedby": id })}
      <span id={id} className="pb-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
