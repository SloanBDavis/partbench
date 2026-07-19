import { useId, type SVGAttributes } from "react";

export type IconName =
  | "partbench"
  | "undo"
  | "redo"
  | "search"
  | "help"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "more"
  | "project"
  | "solid"
  | "sketch"
  | "inspect"
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "extrude"
  | "revolve"
  | "sweep"
  | "loft"
  | "transform"
  | "hole"
  | "fillet"
  | "chamfer"
  | "shell"
  | "linear-pattern"
  | "circular-pattern"
  | "mirror"
  | "point"
  | "line"
  | "rectangle"
  | "circle"
  | "arc"
  | "constraint"
  | "dimension"
  | "measure"
  | "mass-properties"
  | "reference"
  | "repair"
  | "fit"
  | "top-view"
  | "front-view"
  | "right-view"
  | "isometric"
  | "file"
  | "save"
  | "import"
  | "export"
  | "warning"
  | "error"
  | "success"
  | "visibility"
  | "visibility-off"
  | "delete"
  | "edit"
  | "add";

type IconGeometry = readonly string[];

const ICONS: Readonly<Record<IconName, IconGeometry>> = {
  partbench: [
    "M4 6.5 12 2l8 4.5v9L12 20l-8-4.5v-9Z",
    "M4 6.5 12 11l8-4.5M12 11v9"
  ],
  undo: ["M9 7 4 12l5 5", "M5 12h8a6 6 0 0 1 6 6"],
  redo: ["m15 7 5 5-5 5", "M19 12h-8a6 6 0 0 0-6 6"],
  search: [
    "m20 20-4.6-4.6",
    "M10.8 17.5a6.7 6.7 0 1 0 0-13.4 6.7 6.7 0 0 0 0 13.4Z"
  ],
  help: [
    "M9.6 9a2.8 2.8 0 1 1 4.4 2.3c-1.2.8-2 1.3-2 2.7",
    "M12 18h.01",
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
  ],
  close: ["m6 6 12 12", "M18 6 6 18"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-right": ["m9 6 6 6-6 6"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  project: ["M3 6h7l2 2h9v11H3V6Z", "M3 10h18"],
  solid: ["m4 7 8-4 8 4v10l-8 4-8-4V7Z", "m4 7 8 4 8-4", "M12 11v10"],
  sketch: ["M4 19 16 7l3 3L7 22H4v-3Z", "M14 9 17 12"],
  inspect: [
    "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
  ],
  box: ["m4 7 8-4 8 4v10l-8 4-8-4V7Z", "m4 7 8 4 8-4", "M12 11v10"],
  cylinder: [
    "M5 6c0-2 14-2 14 0v12c0 2-14 2-14 0V6Z",
    "M5 6c0 2 14 2 14 0",
    "M5 18c0-2 14-2 14 0"
  ],
  sphere: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3 12h18",
    "M12 3c4 4 4 14 0 18",
    "M12 3c-4 4-4 14 0 18"
  ],
  cone: ["M12 3 5 18c0 3 14 3 14 0L12 3Z", "M5 18c0-3 14-3 14 0"],
  torus: [
    "M12 19c5 0 9-3.1 9-7s-4-7-9-7-9 3.1-9 7 4 7 9 7Z",
    "M12 15c2.5 0 4.5-1.3 4.5-3S14.5 9 12 9s-4.5 1.3-4.5 3 2 3 4.5 3Z"
  ],
  extrude: ["M5 14h9V5H5v9Z", "m14 5 5 5v9h-9l-5-5", "M14 14h5"],
  revolve: ["M7 7a7 7 0 1 1-1.8 7", "m3 3 4 4-5 2", "M12 4v16"],
  sweep: ["M4 18c4-12 10 4 16-12", "m16 6-1 5-5-1", "M5 21h5"],
  loft: [
    "M5 18c2 3 12 3 14 0",
    "M7 12c2 2 8 2 10 0",
    "M9 6c1 1 5 1 6 0",
    "M5 18 9 6M19 18 15 6"
  ],
  transform: [
    "M12 3v18M3 12h18",
    "m8 7 4-4 4 4",
    "m8 17 4 4 4-4",
    "m7 8-4 4 4 4",
    "m17 8 4 4-4 4"
  ],
  hole: ["M4 7h16v10H4V7Z", "M12 7v10", "M9 10h6v4H9v-4Z"],
  fillet: ["M5 19V8a3 3 0 0 1 3-3h11", "M8 19c0-6 5-11 11-11"],
  chamfer: ["M5 19V9l4-4h10", "M9 5v4H5"],
  shell: ["m4 7 8-4 8 4v10l-8 4-8-4V7Z", "m8 9 4-2 4 2v5l-4 2-4-2V9Z"],
  "linear-pattern": [
    "M4 8h4v4H4V8ZM10 8h4v4h-4V8ZM16 8h4v4h-4V8Z",
    "M6 17h12",
    "m16 15 2 2-2 2"
  ],
  "circular-pattern": [
    "M10 3h4v4h-4V3ZM10 17h4v4h-4v-4ZM3 10h4v4H3v-4ZM17 10h4v4h-4v-4Z",
    "M8 8a6 6 0 0 1 8 0M16 16a6 6 0 0 1-8 0"
  ],
  mirror: ["M12 3v18", "m9 6-5 4v8l5-4V6ZM15 6l5 4v8l-5-4V6Z"],
  point: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  line: ["M5 19 19 5", "M4 18h2v2H4v-2ZM18 4h2v2h-2V4Z"],
  rectangle: ["M4 6h16v12H4V6Z"],
  circle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"],
  arc: ["M4 17A13 13 0 0 1 19 5", "M3 16h3v3H3v-3ZM18 4h3v3h-3V4Z"],
  constraint: ["M4 8h6v8H4V8ZM14 8h6v8h-6V8Z", "M10 12h4"],
  dimension: ["M5 7v10M19 7v10M5 12h14", "m8 9-3 3 3 3", "m16 9 3 3-3 3"],
  measure: ["m4 17 13-13 3 3-13 13-3-3Z", "m9 12 3 3M12 9l3 3M15 6l3 3"],
  "mass-properties": [
    "M6 20h12",
    "M8 20l2-11h4l2 11",
    "M10 9a2 2 0 1 1 4 0",
    "M7 14h10"
  ],
  reference: [
    "M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1",
    "M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"
  ],
  repair: [
    "M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z"
  ],
  fit: [
    "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5",
    "m3 8 5-5M21 8l-5-5M3 16l5 5M21 16l-5 5"
  ],
  "top-view": ["M4 5h16v14H4V5Z", "M8 9h8v6H8V9Z"],
  "front-view": ["M4 5h16v14H4V5Z", "M12 5v14"],
  "right-view": ["M6 5h12v14H6V5Z", "m12 5 3 3v8l-3 3"],
  isometric: ["m4 8 8-5 8 5-8 5-8-5Z", "M4 8v8l8 5 8-5V8M12 13v8"],
  file: ["M6 3h8l4 4v14H6V3Z", "M14 3v5h5"],
  save: ["M5 3h12l3 3v15H4V3h1Z", "M8 3v6h8V3", "M8 14h8v7H8v-7Z"],
  import: ["M4 15v5h16v-5", "M12 3v12", "m7 10 5 5 5-5"],
  export: ["M4 15v5h16v-5", "M12 16V4", "m7 9 5-5 5 5"],
  warning: ["M12 3 2 21h20L12 3Z", "M12 9v5M12 18h.01"],
  error: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m9 9 6 6M15 9l-6 6"],
  success: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m8 12 3 3 6-7"],
  visibility: [
    "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
  ],
  "visibility-off": [
    "m4 4 16 16",
    "M9.5 6.4A9.9 9.9 0 0 1 12 6c5.5 0 9 6 9 6a13 13 0 0 1-2.1 2.8M6.2 6.2A14 14 0 0 0 3 12s3.5 6 9 6c1 0 2-.2 2.8-.5"
  ],
  delete: ["M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"],
  edit: ["M4 20h4L20 8l-4-4L4 16v4Z", "m14 6 4 4"],
  add: ["M12 5v14M5 12h14"]
};

export interface IconProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  "children" | "name"
> {
  readonly name: IconName;
  /** Makes the icon semantic. Omit when a surrounding control supplies text. */
  readonly label?: string;
  readonly size?: 16 | 20 | 24 | number;
}

export function Icon({
  name,
  label,
  size = 16,
  className,
  ...props
}: IconProps) {
  const titleId = useId();
  const semantic = Boolean(label);
  return (
    <svg
      {...props}
      className={["pb-icon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={semantic ? "img" : undefined}
      aria-labelledby={semantic ? titleId : undefined}
      aria-hidden={semantic ? undefined : true}
    >
      {semantic ? <title id={titleId}>{label}</title> : null}
      {ICONS[name].map((path, index) => (
        <path key={`${name}-${index}`} d={path} />
      ))}
    </svg>
  );
}
