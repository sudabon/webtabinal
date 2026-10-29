import { Check } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { nextEnabledIndex, placeMenu } from '../tab-menu';

type Props = {
  x: number;
  y: number;
  exited: boolean;
  notificationsMuted: boolean;
  onDuplicate: () => void;
  onRestart: () => void;
  onClose: () => void;
  onToggleNotifications: () => void;
  // `restoreFocus` is false when the user dismissed the menu by moving
  // elsewhere, so focus must stay wherever they went.
  onDismiss: (restoreFocus: boolean) => void;
};

type Item = {
  label: string;
  disabled?: boolean;
  checked?: boolean;
  run: () => void;
};

export function TabContextMenu(props: Props) {
  const { onDismiss } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pos, setPos] = useState({ left: props.x, top: props.y });

  const items: Item[] = [
    { label: '複製', run: props.onDuplicate },
    { label: '再起動', disabled: !props.exited, run: props.onRestart },
    { label: '閉じる', run: props.onClose },
    { label: '通知', checked: !props.notificationsMuted, run: props.onToggleNotifications },
  ];
  const disabled = items.map((item) => !!item.disabled);
  const firstEnabled = disabled.indexOf(false);

  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(placeMenu({
      x: props.x,
      y: props.y,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    if (firstEnabled >= 0) itemRefs.current[firstEnabled]?.focus();
  }, [props.x, props.y, firstEnabled]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onDismiss(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss(true);
    };
    const onMove = () => onDismiss(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    // Capture sees the sidebar list's scroll, which does not bubble.
    document.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('blur', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('blur', onMove);
    };
  }, [onDismiss]);

  const choose = (item: Item) => {
    if (item.disabled) return;
    onDismiss(true);
    item.run();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = nextEnabledIndex(disabled, current, 1);
    else if (e.key === 'ArrowUp') next = nextEnabledIndex(disabled, current < 0 ? 0 : current, -1);
    else if (e.key === 'Home') next = nextEnabledIndex(disabled, -1, 1);
    else if (e.key === 'End') next = nextEnabledIndex(disabled, items.length, -1);
    else if (e.key === 'Tab') {
      e.preventDefault();
      onDismiss(true);
      return;
    } else return;
    e.preventDefault();
    if (next >= 0) itemRefs.current[next]?.focus();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="tab-menu"
      role="menu"
      aria-label="タブの操作"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onMenuKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
          className="tab-menu-item"
          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={item.checked}
          aria-disabled={item.disabled || undefined}
          tabIndex={-1}
          onClick={() => choose(item)}
        >
          <span className="tab-menu-check" aria-hidden>
            {item.checked && <Check size={14} strokeWidth={2.5} />}
          </span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
