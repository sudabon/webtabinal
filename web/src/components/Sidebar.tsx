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
import { Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SessionInfo } from '../types';
import { cwdBasename, formatElapsed } from '../util';
import { AgentStatePill } from './AgentStatePill';

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
  onResizeWidth: (w: number) => void;
  onResizeWidthCommit: (w: number) => void;
};

function SortableTab({
  session,
  active,
  unread,
  memoEditorOpen,
  onSelect,
  onEditMemo,
  onDuplicate,
  onRestart,
  onClose,
}: {
  session: SessionInfo;
  active: boolean;
  unread: boolean;
  memoEditorOpen: boolean;
  onSelect: () => void;
  onEditMemo: () => void;
  onDuplicate: () => void;
  onRestart: () => void;
  onClose: () => void;
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
        const action = window.prompt(
          'Action: duplicate | restart | close',
          session.state === 'exited' ? 'restart' : 'close',
        );
        if (action === 'duplicate') onDuplicate();
        if (action === 'restart') onRestart();
        if (action === 'close') onClose();
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

export function Sidebar(props: Props) {
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
                onDuplicate={() => props.onDuplicate(s.id)}
                onRestart={() => props.onRestart(s.id)}
                onClose={() => props.onClose(s.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
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
