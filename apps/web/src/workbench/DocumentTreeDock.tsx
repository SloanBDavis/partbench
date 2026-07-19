import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { Icon } from "../ui/Icon";
import type {
  DocumentTreeGroup,
  DocumentTreeProjection,
  DocumentTreeRow,
  DocumentTreeSelection
} from "./documentTreeProjection";
import "../styles/tree.css";

export interface DocumentTreeDockProps {
  readonly projection: DocumentTreeProjection;
  readonly selectedKey?: string;
  readonly editingKey?: string;
  readonly initialExpandedIds?: readonly string[];
  readonly onSelect: (selection: DocumentTreeSelection) => void;
  readonly onToggleVisibility?: (
    selection: DocumentTreeSelection,
    visible: boolean
  ) => void;
  readonly onRename?: (selection: DocumentTreeSelection) => void;
  readonly onEdit?: (selection: DocumentTreeSelection) => void;
  readonly onDelete?: (selection: DocumentTreeSelection) => void;
}

export function DocumentTreeDock({
  projection,
  selectedKey,
  editingKey,
  initialExpandedIds = ["group:origin", "group:model", "group:references"],
  onSelect,
  onToggleVisibility,
  onRename,
  onEdit,
  onDelete
}: DocumentTreeDockProps) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialExpandedIds)
  );
  const [activeMenuId, setActiveMenuId] = useState<string>();
  const treeRef = useRef<HTMLUListElement>(null);
  const visibleRowIds = useMemo(
    () => collectVisibleRowIds(projection.groups, expandedIds),
    [projection.groups, expandedIds]
  );

  function toggleExpanded(id: string, next?: boolean) {
    setExpandedIds((current) => toggleTreeExpansion(current, id, next));
  }

  function focusRelative(rowId: string, offset: number) {
    const index = visibleRowIds.indexOf(rowId);
    const nextId = visibleRowIds[index + offset];
    if (!nextId) return;
    treeRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-tree-select="${escapeSelector(nextId)}"]`
      )
      ?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    row: DocumentTreeRow,
    parentId?: string
  ) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRelative(row.id, event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const id =
        event.key === "Home"
          ? visibleRowIds[0]
          : visibleRowIds[visibleRowIds.length - 1];
      if (id) {
        treeRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-tree-select="${escapeSelector(id)}"]`
          )
          ?.focus();
      }
      return;
    }
    if (event.key === "ArrowRight" && row.children.length > 0) {
      event.preventDefault();
      if (!expandedIds.has(row.id)) toggleExpanded(row.id, true);
      else focusRelative(row.id, 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      if (expandedIds.has(row.id)) {
        event.preventDefault();
        toggleExpanded(row.id, false);
      } else if (parentId) {
        event.preventDefault();
        treeRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-tree-select="${escapeSelector(parentId)}"]`
          )
          ?.focus();
      }
    }
  }

  return (
    <section className="pb-document-tree" aria-labelledby="document-tree-title">
      <header className="pb-document-tree__header">
        <h2 id="document-tree-title">Model</h2>
      </header>
      <ul
        ref={treeRef}
        className="pb-document-tree__root"
        role="tree"
        aria-label="Document tree"
      >
        {projection.groups.map((group) => (
          <TreeGroup
            key={group.id}
            group={group}
            expanded={expandedIds.has(`group:${group.id}`)}
            expandedIds={expandedIds}
            selectedKey={selectedKey}
            editingKey={editingKey}
            activeMenuId={activeMenuId}
            onToggleGroup={() => toggleExpanded(`group:${group.id}`)}
            onToggleRow={toggleExpanded}
            onSelect={onSelect}
            onToggleVisibility={onToggleVisibility}
            onRename={onRename}
            onEdit={onEdit}
            onDelete={onDelete}
            onMenuChange={setActiveMenuId}
            onRowKeyDown={handleKeyDown}
          />
        ))}
      </ul>
    </section>
  );
}

interface TreeGroupProps extends Pick<
  DocumentTreeDockProps,
  | "selectedKey"
  | "editingKey"
  | "onSelect"
  | "onToggleVisibility"
  | "onRename"
  | "onEdit"
  | "onDelete"
> {
  readonly group: DocumentTreeGroup;
  readonly expanded: boolean;
  readonly expandedIds: ReadonlySet<string>;
  readonly activeMenuId?: string;
  readonly onToggleGroup: () => void;
  readonly onToggleRow: (id: string, next?: boolean) => void;
  readonly onMenuChange: (id: string | undefined) => void;
  readonly onRowKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    row: DocumentTreeRow,
    parentId?: string
  ) => void;
}

function TreeGroup({
  group,
  expanded,
  expandedIds,
  selectedKey,
  editingKey,
  activeMenuId,
  onToggleGroup,
  onToggleRow,
  onSelect,
  onToggleVisibility,
  onRename,
  onEdit,
  onDelete,
  onMenuChange,
  onRowKeyDown
}: TreeGroupProps) {
  return (
    <li role="none" className="pb-tree-group">
      <button
        type="button"
        className="pb-tree-group__heading"
        role="treeitem"
        aria-level={1}
        aria-expanded={expanded}
        aria-controls={`tree-group-${group.id}`}
        onClick={onToggleGroup}
      >
        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={16} />
        <Icon name={group.icon} size={16} />
        <span>{group.label}</span>
        <span
          className="pb-tree-group__count"
          aria-label={`${group.rows.length} items`}
        >
          {group.rows.length}
        </span>
      </button>
      {expanded ? (
        <ul id={`tree-group-${group.id}`} role="group">
          {group.rows.length > 0 ? (
            group.rows.map((row) => (
              <TreeRow
                key={row.id}
                row={row}
                level={2}
                expandedIds={expandedIds}
                selectedKey={selectedKey}
                editingKey={editingKey}
                activeMenuId={activeMenuId}
                onToggleRow={onToggleRow}
                onSelect={onSelect}
                onToggleVisibility={onToggleVisibility}
                onRename={onRename}
                onEdit={onEdit}
                onDelete={onDelete}
                onMenuChange={onMenuChange}
                onRowKeyDown={onRowKeyDown}
              />
            ))
          ) : (
            <li role="none" className="pb-tree-empty">
              No {group.label.toLowerCase()}
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

interface TreeRowProps extends Omit<
  TreeGroupProps,
  "group" | "expanded" | "onToggleGroup"
> {
  readonly row: DocumentTreeRow;
  readonly level: number;
  readonly parentId?: string;
}

function TreeRow({
  row,
  level,
  parentId,
  expandedIds,
  selectedKey,
  editingKey,
  activeMenuId,
  onToggleRow,
  onSelect,
  onToggleVisibility,
  onRename,
  onEdit,
  onDelete,
  onMenuChange,
  onRowKeyDown
}: TreeRowProps) {
  const hasChildren = row.children.length > 0;
  const expanded = hasChildren && expandedIds.has(row.id);
  const selected = selectedKey === row.id;
  const editing = editingKey === row.id;
  const hasMenu =
    (row.capabilities.canRename && onRename) ||
    (row.capabilities.canEdit && onEdit) ||
    (row.capabilities.canDelete && onDelete);

  return (
    <li role="none">
      <div
        className={[
          "pb-tree-row",
          selected ? "is-selected" : "",
          editing ? "is-editing" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          {
            paddingInlineStart: `${Math.max(8, (level - 2) * 16 + 8)}px`
          } as CSSProperties
        }
      >
        {hasChildren ? (
          <button
            type="button"
            className="pb-tree-row__disclosure"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${row.label}`}
            tabIndex={-1}
            onClick={() => onToggleRow(row.id)}
          >
            <Icon
              name={expanded ? "chevron-down" : "chevron-right"}
              size={16}
            />
          </button>
        ) : (
          <span className="pb-tree-row__indent" aria-hidden="true" />
        )}
        <button
          type="button"
          className="pb-tree-row__select"
          data-tree-select={row.id}
          role="treeitem"
          aria-level={level}
          aria-selected={selected}
          aria-expanded={hasChildren ? expanded : undefined}
          onClick={() => onSelect(row.selection)}
          onKeyDown={(event) => onRowKeyDown(event, row, parentId)}
        >
          <Icon name={row.icon} size={16} />
          <span className="pb-tree-row__copy">
            <span className="pb-tree-row__label">{row.label}</span>
            {row.detail ? (
              <span className="pb-tree-row__detail">{row.detail}</span>
            ) : null}
          </span>
          {editing ? (
            <span className="pb-tree-row__editing">Editing</span>
          ) : null}
          {row.health ? (
            <span
              className={`pb-tree-row__health is-${row.health.tone}`}
              title={row.health.description}
              aria-label={`${row.health.label}: ${row.health.description}`}
            >
              <Icon
                name={row.health.tone === "warning" ? "warning" : "error"}
                size={16}
              />
            </span>
          ) : null}
        </button>
        {row.capabilities.visible !== undefined && onToggleVisibility ? (
          <button
            type="button"
            className="pb-tree-row__action"
            aria-label={`${row.capabilities.visible ? "Hide" : "Show"} ${row.label}`}
            aria-pressed={row.capabilities.visible}
            onClick={(event) => {
              stopRowEvent(event);
              onToggleVisibility(row.selection, !row.capabilities.visible);
            }}
          >
            <Icon
              name={row.capabilities.visible ? "visibility" : "visibility-off"}
              size={16}
            />
          </button>
        ) : null}
        {hasMenu ? (
          <div className="pb-tree-row__menu-wrap">
            <button
              type="button"
              className="pb-tree-row__action"
              aria-label={`Actions for ${row.label}`}
              aria-haspopup="menu"
              aria-expanded={activeMenuId === row.id}
              onClick={(event) => {
                stopRowEvent(event);
                onMenuChange(activeMenuId === row.id ? undefined : row.id);
              }}
            >
              <Icon name="more" size={16} />
            </button>
            {activeMenuId === row.id ? (
              <div
                className="pb-tree-menu"
                role="menu"
                aria-label={`Actions for ${row.label}`}
              >
                {row.capabilities.canEdit && onEdit ? (
                  <TreeMenuButton
                    label="Edit"
                    icon="edit"
                    onClick={() => onEdit(row.selection)}
                  />
                ) : null}
                {row.capabilities.canRename && onRename ? (
                  <TreeMenuButton
                    label="Rename"
                    icon="edit"
                    onClick={() => onRename(row.selection)}
                  />
                ) : null}
                {row.capabilities.canDelete && onDelete ? (
                  <TreeMenuButton
                    label="Delete"
                    icon="delete"
                    danger
                    onClick={() => onDelete(row.selection)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {expanded ? (
        <ul role="group">
          {row.children.map((child) => (
            <TreeRow
              key={child.id}
              row={child}
              level={level + 1}
              parentId={row.id}
              expandedIds={expandedIds}
              selectedKey={selectedKey}
              editingKey={editingKey}
              activeMenuId={activeMenuId}
              onToggleRow={onToggleRow}
              onSelect={onSelect}
              onToggleVisibility={onToggleVisibility}
              onRename={onRename}
              onEdit={onEdit}
              onDelete={onDelete}
              onMenuChange={onMenuChange}
              onRowKeyDown={onRowKeyDown}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeMenuButton({
  label,
  icon,
  danger,
  onClick
}: {
  readonly label: string;
  readonly icon: "edit" | "delete";
  readonly danger?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? "is-danger" : undefined}
      onClick={() => {
        onClick();
      }}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

export function toggleTreeExpansion(
  current: ReadonlySet<string>,
  id: string,
  next = !current.has(id)
): ReadonlySet<string> {
  const updated = new Set(current);
  if (next) updated.add(id);
  else updated.delete(id);
  return updated;
}

export function collectVisibleRowIds(
  groups: readonly DocumentTreeGroup[],
  expandedIds: ReadonlySet<string>
): readonly string[] {
  const visible: string[] = [];
  for (const group of groups) {
    if (!expandedIds.has(`group:${group.id}`)) continue;
    for (const row of group.rows) collectVisibleRow(row, expandedIds, visible);
  }
  return visible;
}

function collectVisibleRow(
  row: DocumentTreeRow,
  expandedIds: ReadonlySet<string>,
  target: string[]
) {
  target.push(row.id);
  if (!expandedIds.has(row.id)) return;
  for (const child of row.children)
    collectVisibleRow(child, expandedIds, target);
}

function stopRowEvent(event: ReactMouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function escapeSelector(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
