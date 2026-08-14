import type { KeyBindings } from './keymap';

export type { KeyBindings };

export type SessionState = 'starting' | 'idle' | 'running' | 'exited';

export type SessionInfo = {
  id: string;
  order: number;
  cwd: string;
  command: string;
  state: SessionState;
  exit: number | null;
  integrated: boolean;
  memo: string;
  run_ms?: number;
};

export type ColorScheme = 'light' | 'dark' | 'system';

export type AppConfig = {
  port: number;
  shell: string;
  scrollback_lines: number;
  ring_buffer_bytes: number;
  font_family: string;
  font_size: number;
  sidebar_width: number;
  color_scheme: ColorScheme;
  notification: {
    enabled: boolean;
    always: boolean;
    min_duration_ms: number;
    sound: boolean;
  };
  confirm_close_running: boolean;
  copy_on_select: boolean;
  quit_when_no_tabs: boolean;
  close_tab_on_clean_exit: boolean;
  key_bindings: KeyBindings;
};

export type ServerMsg =
  | { t: 'sessions'; list: SessionInfo[] }
  | { t: 'state'; sid: string; cwd: string; cmd: string; state: SessionState; exit: number | null; integrated: boolean; run_ms?: number }
  | { t: 'notify'; sid: string; title: string; body: string }
  | { t: 'output'; sid: string; data: string }
  | { t: 'replay'; sid: string; data: string; done: boolean }
  | { t: 'error'; sid?: string; code?: string; message: string };
