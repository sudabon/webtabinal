import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PanelLeftClose, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SessionInfo } from '../types';
import { cwdBasename, formatElapsed } from '../util';
import { AgentStatePill } from './AgentStatePill';
import { TabContextMenu } from './TabContextMenu';

const MEMO_TOOLTIP_DELAY_MS = 1000;

type Props = {
  sessions: SessionInfo[];
  activeId: string | null;
  width: number;
  unread: Set<string>;
  memoEditorOpen: boolean;
  onSelect: (id: string) => void;
  onEditMemo: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onReorder: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onRestart: (id: string) => void;
  onClose: (id: string) => void;
  onToggleNotifications: (id: string) => void;
  onResizeWidth: (w: number) => void;
  onResizeWidthCommit: (w: number) => void;
  onCollapse: () => void;
};

function SortableTab({
  session,
  active,
  unread,
  memoEditorOpen,
  onSelect,
  onEditMemo,
  onOpenMenu,
}: {
  session: SessionInfo;
  active: boolean;
  unread: boolean;
  memoEditorOpen: boolean;
  onSelect: () => void;
  onEditMemo: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  const tabElRef = useRef<HTMLDivElement | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const hideTooltip = () => {
    clearHoverTimer();
    setTooltipVisible(false);
    setTooltipPos(null);
  };

  const setTabRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    tabElRef.current = node;
  };

  useEffect(() => {
    if (memoEditorOpen || isDragging) {
      clearHoverTimer();
      setTooltipVisible(false);
      setTooltipPos(null);
    }
  }, [memoEditorOpen, isDragging]);

  useEffect(() => () => clearHoverTimer(), []);

  useEffect(() => {
    if (!tooltipVisible) return;
    const onRepositionHide = () => {
      clearHoverTimer();
      setTooltipVisible(false);
      setTooltipPos(null);
    };
    const scrollParent = tabElRef.current?.closest('.sidebar-tabs');
    scrollParent?.addEventListener('scroll', onRepositionHide, { passive: true });
    window.addEventListener('resize', onRepositionHide);
    return () => {
      scrollParent?.removeEventListener('scroll', onRepositionHide);
      window.removeEventListener('resize', onRepositionHide);
    };
  }, [tooltipVisible]);

  const cmdOpacity = session.state === 'running' ? 1 : 0.5;
  const stateLabel =
    session.state === 'running'
      ? `● running ${formatElapsed(session.run_ms)}`
      : session.state === 'exited'
        ? `■ exit ${session.exit ?? '?'}`
        : session.state === 'starting'
          ? '○ starting'
          : '○ idle';

  const memo = session.memo?.trim() ?? '';

  return (
    <div
      ref={setTabRef}
      style={style}
      className={`tab ${active ? 'active' : ''} ${session.state === 'exited' ? 'exited' : ''}`}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEditMemo();
      }}
      onMouseEnter={() => {
        if (!memo || memoEditorOpen) return;
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => {
          const rect = tabElRef.current?.getBoundingClientRect();
          if (!rect) return;
          setTooltipPos({ top: rect.top, left: rect.right + 8 });
          setTooltipVisible(true);
        }, MEMO_TOOLTIP_DELAY_MS);
      }}
      onMouseLeave={hideTooltip}
      onContextMenu={(e) => {
        e.preventDefault();
        hideTooltip();
        onOpenMenu(e.clientX, e.clientY);
      }}
      {...attributes}
      {...listeners}
    >
      {tooltipVisible && memo && tooltipPos && createPortal(
        <div
          className="tab-memo-tooltip"
          role="tooltip"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {memo}
        </div>,
        document.body,
      )}
      <div className="tab-cwd">
        {cwdBasename(session.cwd)}
        {!session.integrated && <span className="no-int" title="shell integration off">◌</span>}
        {unread && <span className="unread" title="unread completion" />}
        <AgentStatePill agent={session.agent} state={session.agent_state} />
      </div>
      <div className="tab-cmd" style={{ opacity: cmdOpacity }} title={session.command}>
        {session.command || 'zsh'}
      </div>
      <div className={`tab-state ${session.state} ${session.exit && session.exit !== 0 ? 'err' : ''}`}>
        {stateLabel}
      </div>
    </div>
  );
}

type MenuState = { sessionId: string; x: number; y: number };

export function Sidebar(props: Props) {
  // One menu for the whole sidebar, so opening another tab's menu replaces it.
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuReturnFocus = useRef<HTMLElement | null>(null);
  const menuSession = menu ? props.sessions.find((s) => s.id === menu.sessionId) : undefined;

  const openMenu = (sessionId: string, x: number, y: number) => {
    // Right-clicking another tab first dismisses the open menu, leaving focus
    // on <body>; keep the original target rather than capturing that.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.closest('.tab-menu')) {
      menuReturnFocus.current = active;
    }
    setMenu({ sessionId, x, y });
  };

  const dismissMenu = useCallback((restoreFocus: boolean) => {
    setMenu(null);
    if (!restoreFocus) return;
    const target = menuReturnFocus.current;
    menuReturnFocus.current = null;
    if (target?.isConnected) target.focus();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = props.sessions.findIndex((s) => s.id === active.id);
    const newIndex = props.sessions.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(props.sessions, oldIndex, newIndex).map((s) => s.id);
    props.onReorder(next);
  };

  return (
    <aside className="sidebar" style={{ width: props.width }}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-collapse"
          aria-label="サイドバーを閉じる"
          onClick={props.onCollapse}
        >
          <PanelLeftClose size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="sidebar-tabs">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={props.sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {props.sessions.map((s) => (
              <SortableTab
                key={s.id}
                session={s}
                active={s.id === props.activeId}
                unread={props.unread.has(s.id)}
                memoEditorOpen={props.memoEditorOpen}
                onSelect={() => props.onSelect(s.id)}
                onEditMemo={() => props.onEditMemo(s.id)}
                onOpenMenu={(x, y) => openMenu(s.id, x, y)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {menu && menuSession && (
        <TabContextMenu
          key={`${menu.sessionId}:${menu.x}:${menu.y}`}
          x={menu.x}
          y={menu.y}
          exited={menuSession.state === 'exited'}
          notificationsMuted={!!menuSession.notifications_muted}
          onDuplicate={() => props.onDuplicate(menuSession.id)}
          onRestart={() => props.onRestart(menuSession.id)}
          onClose={() => props.onClose(menuSession.id)}
          onToggleNotifications={() => props.onToggleNotifications(menuSession.id)}
          onDismiss={dismissMenu}
        />
      )}
      <button className="new-tab" type="button" onClick={props.onNew}>
        ＋ 新規タブ
      </button>
      <button className="sidebar-settings" type="button" onClick={props.onOpenSettings}>
        <Settings className="sidebar-settings-icon" size={22} strokeWidth={2} aria-hidden />
        設定
      </button>
      <div
        className="sidebar-resizer"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = props.width;
          let currentW = startW;
          const onMove = (ev: MouseEvent) => {
            const w = Math.min(480, Math.max(160, startW + (ev.clientX - startX)));
            currentW = w;
            props.onResizeWidth(w);
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            props.onResizeWidthCommit(currentW);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
    </aside>
  );
}
