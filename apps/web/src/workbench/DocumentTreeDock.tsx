import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from "react";
import { Icon } from "../ui/Icon";
import type {
  DocumentTreeGroup,
  DocumentTreeProjection,
  DocumentTreeRow,
  DocumentTreeSelection
} from "./documentTreeProjection";
import {
  collectVisibleRowIds,
  resolveDocumentTreeEditingKeys,
  resolveDocumentTreeSelectedKeys,
  toggleTreeExpansion
} from "./documentTreeState";
import "../styles/tree.css";

export interface DocumentTreeDockProps {
  readonly projection: DocumentTreeProjection;
  /** Single selected row key (backward compatible). */
  readonly selectedKey?: string;
  /**
   * Optional additional/override selection keys. A row is selected when its id
   * is in this list or equals `selectedKey`. Prefer this when App remaps a
   * feature click to a body selection.
   */
  readonly selectedKeys?: readonly string[];
  /** Single editing row key (backward compatible). */
  readonly editingKey?: string;
  /**
   * Optional additional/override editing keys. Use for sketch editors whose
   * source id is a sketch id rather than a feature id.
   */
  readonly editingKeys?: readonly string[];
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
  selectedKeys,
  editingKey,
  editingKeys,
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
  const [clickedRowId, setClickedRowId] = useState<string>();
  const treeRef = useRef<HTMLUListElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const visibleRowIds = useMemo(
    () => collectVisibleRowIds(projection.groups, expandedIds),
    [projection.groups, expandedIds]
  );
  const resolvedSelectedKeys = useMemo(
    () =>
      resolveDocumentTreeSelectedKeys({
        selectedKey,
        selectedKeys,
        clickedRowId,
        rowsById: projection.rowsById
      }),
    [clickedRowId, projection.rowsById, selectedKey, selectedKeys]
  );
  const resolvedEditingKeys = useMemo(
    () =>
      resolveDocumentTreeEditingKeys({
        editingKey,
        editingKeys,
        rowsById: projection.rowsById
      }),
    [editingKey, editingKeys, projection.rowsById]
  );

  useEffect(() => {
    if (!activeMenuId || typeof document === "undefined") return;

    const closeIfOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuWrapRef.current?.contains(target)) return;
      setActiveMenuId(undefined);
    };

    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("focusin", closeIfOutside);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("focusin", closeIfOutside);
    };
  }, [activeMenuId]);

  function toggleExpanded(id: string, next?: boolean) {
    setExpandedIds((current) => toggleTreeExpansion(current, id, next));
  }

  function closeMenu(options?: { readonly restoreFocus?: boolean }) {
    setActiveMenuId(undefined);
    if (options?.restoreFocus) {
      const focus = () => menuTriggerRef.current?.focus();
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(focus);
      } else {
        focus();
      }
    }
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
            selectedKeys={resolvedSelectedKeys}
            editingKeys={resolvedEditingKeys}
            activeMenuId={activeMenuId}
            menuWrapRef={menuWrapRef}
            menuTriggerRef={menuTriggerRef}
            onToggleGroup={() => toggleExpanded(`group:${group.id}`)}
            onToggleRow={toggleExpanded}
            onSelect={(selection, rowId) => {
              setClickedRowId(rowId);
              onSelect(selection);
            }}
            onToggleVisibility={onToggleVisibility}
            onRename={onRename}
            onEdit={onEdit}
            onDelete={onDelete}
            onMenuChange={setActiveMenuId}
            onCloseMenu={closeMenu}
            onRowKeyDown={handleKeyDown}
          />
        ))}
      </ul>
    </section>
  );
}

interface TreeGroupProps {
  readonly group: DocumentTreeGroup;
  readonly expanded: boolean;
  readonly expandedIds: ReadonlySet<string>;
  readonly selectedKeys: ReadonlySet<string>;
  readonly editingKeys: ReadonlySet<string>;
  readonly activeMenuId?: string;
  readonly menuWrapRef: RefObject<HTMLDivElement | null>;
  readonly menuTriggerRef: RefObject<HTMLButtonElement | null>;
  readonly onToggleGroup: () => void;
  readonly onToggleRow: (id: string, next?: boolean) => void;
  readonly onSelect: (selection: DocumentTreeSelection, rowId: string) => void;
  readonly onToggleVisibility?: DocumentTreeDockProps["onToggleVisibility"];
  readonly onRename?: DocumentTreeDockProps["onRename"];
  readonly onEdit?: DocumentTreeDockProps["onEdit"];
  readonly onDelete?: DocumentTreeDockProps["onDelete"];
  readonly onMenuChange: (id: string | undefined) => void;
  readonly onCloseMenu: (options?: { readonly restoreFocus?: boolean }) => void;
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
  selectedKeys,
  editingKeys,
  activeMenuId,
  menuWrapRef,
  menuTriggerRef,
  onToggleGroup,
  onToggleRow,
  onSelect,
  onToggleVisibility,
  onRename,
  onEdit,
  onDelete,
  onMenuChange,
  onCloseMenu,
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
                selectedKeys={selectedKeys}
                editingKeys={editingKeys}
                activeMenuId={activeMenuId}
                menuWrapRef={menuWrapRef}
                menuTriggerRef={menuTriggerRef}
                onToggleRow={onToggleRow}
                onSelect={onSelect}
                onToggleVisibility={onToggleVisibility}
                onRename={onRename}
                onEdit={onEdit}
                onDelete={onDelete}
                onMenuChange={onMenuChange}
                onCloseMenu={onCloseMenu}
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
  selectedKeys,
  editingKeys,
  activeMenuId,
  menuWrapRef,
  menuTriggerRef,
  onToggleRow,
  onSelect,
  onToggleVisibility,
  onRename,
  onEdit,
  onDelete,
  onMenuChange,
  onCloseMenu,
  onRowKeyDown
}: TreeRowProps) {
  const hasChildren = row.children.length > 0;
  const expanded = hasChildren && expandedIds.has(row.id);
  const selected = selectedKeys.has(row.id);
  const editing = editingKeys.has(row.id);
  const menuOpen = activeMenuId === row.id;
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
          onClick={() => onSelect(row.selection, row.id)}
          onKeyDown={(event) => onRowKeyDown(event, row, parentId)}
        >
          <Icon name={row.icon} size={16} />
          <span className="pb-tree-row__copy">
            <span className="pb-tree-row__label" title={row.label}>
              {row.label}
            </span>
            {row.detail ? (
              <span className="pb-tree-row__detail" title={row.detail}>
                {row.detail}
              </span>
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
          <div
            className="pb-tree-row__menu-wrap"
            ref={menuOpen ? menuWrapRef : undefined}
          >
            <button
              type="button"
              className="pb-tree-row__action"
              aria-label={`Actions for ${row.label}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              ref={menuOpen ? menuTriggerRef : undefined}
              onClick={(event) => {
                stopRowEvent(event);
                onMenuChange(menuOpen ? undefined : row.id);
              }}
            >
              <Icon name="more" size={16} />
            </button>
            {menuOpen ? (
              <div
                className="pb-tree-menu"
                role="menu"
                aria-label={`Actions for ${row.label}`}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseMenu({ restoreFocus: true });
                }}
              >
                {row.capabilities.canEdit && onEdit ? (
                  <TreeMenuButton
                    label="Edit"
                    icon="edit"
                    onClick={() => {
                      onEdit(row.selection);
                      onCloseMenu();
                    }}
                  />
                ) : null}
                {row.capabilities.canRename && onRename ? (
                  <TreeMenuButton
                    label="Rename"
                    icon="edit"
                    onClick={() => {
                      onRename(row.selection);
                      onCloseMenu();
                    }}
                  />
                ) : null}
                {row.capabilities.canDelete && onDelete ? (
                  <TreeMenuButton
                    label="Delete"
                    icon="delete"
                    danger
                    onClick={() => {
                      onDelete(row.selection);
                      onCloseMenu();
                    }}
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
              selectedKeys={selectedKeys}
              editingKeys={editingKeys}
              activeMenuId={activeMenuId}
              menuWrapRef={menuWrapRef}
              menuTriggerRef={menuTriggerRef}
              onToggleRow={onToggleRow}
              onSelect={onSelect}
              onToggleVisibility={onToggleVisibility}
              onRename={onRename}
              onEdit={onEdit}
              onDelete={onDelete}
              onMenuChange={onMenuChange}
              onCloseMenu={onCloseMenu}
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

function stopRowEvent(event: ReactMouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function escapeSelector(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
