import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode
} from "react";
import { Icon, type IconName } from "./Icon";

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-disabled"
> {
  readonly icon?: IconName;
  readonly tone?: "neutral" | "primary" | "danger";
  readonly density?: "standard" | "dense";
  readonly pending?: boolean;
  readonly unavailableReason?: string;
  /** Called when a blocked (aria-disabled) control is activated by click or keyboard. */
  readonly onUnavailableActivate?: (reason: string) => void;
  readonly children: ReactNode;
}

export function Button({
  icon,
  tone = "neutral",
  density = "standard",
  pending = false,
  unavailableReason,
  onUnavailableActivate,
  disabled,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const nativeDisabled = disabled || pending;
  const blocked = Boolean(unavailableReason) && !nativeDisabled;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault();
      if (unavailableReason) onUnavailableActivate?.(unavailableReason);
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...props}
      className={[
        "pb-button",
        `pb-button--${tone}`,
        density === "dense" ? "pb-button--dense" : "",
        pending ? "is-pending" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      type={props.type ?? "button"}
      disabled={nativeDisabled}
      aria-disabled={blocked || undefined}
      aria-busy={pending || undefined}
      title={unavailableReason ?? props.title}
      onClick={handleClick}
    >
      {icon ? <Icon name={icon} size={density === "dense" ? 16 : 20} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  icon,
  label,
  ...props
}: Omit<ButtonProps, "children" | "icon" | "aria-label"> & {
  readonly icon: IconName;
  readonly label: string;
}) {
  return (
    <Button {...props} icon={icon} aria-label={label}>
      <span className="pb-visually-hidden">{label}</span>
    </Button>
  );
}
