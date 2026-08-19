import type { KeyBindings } from './keymap';

export type { KeyBindings };

export type SessionState = 'starting' | 'idle' | 'running' | 'exited';

export type AgentState = 'none' | 'idle' | 'working' | 'blocked';

export type AgentStateSignal =
  | ''
  | 'screen'
  | 'activity'
  | 'osc'
  | 'command'
  | 'process'
  | 'fallback';

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
  agent?: string;
  agent_state?: AgentState;
  agent_state_since?: string;
  agent_state_signal?: AgentStateSignal | string;
  agent_state_detail?: string;
};

export type ColorScheme = 'light' | 'dark' | 'system';

export type NotificationConfig = {
  enabled: boolean;
  always: boolean;
  min_duration_ms: number;
  sound: boolean;
  // Session commands allowed to raise a banner. Empty disables the restriction.
  commands: string[];
};

export type StateConfig = {
  enabled: boolean;
  debounce_ms: number;
  quiescence_ms: number;
  bottom_lines: number;
  notify_on_blocked: boolean;
  // Screen-derived prompt return. Off by default; a stop hook reports the same
  // thing without mistaking a thinking pause for a finished turn.
  notify_on_idle: boolean;
  manifest_dir: string;
};

export type RestoreConfig = {
  enabled: boolean;
  // Agent ID -> resume command. Overrides a built-in; an empty string disables
  // that agent. Edited in config.json only, never from the settings UI.
  commands: Record<string, string>;
  max_sessions: number;
  max_age_hours: number;
};

export type AppConfig = {
  port: number;
  shell: string;
  scrollback_lines: number;
  ring_buffer_bytes: number;
  font_family: string;
  font_size: number;
  sidebar_width: number;
  color_scheme: ColorScheme;
  notification: NotificationConfig;
  state: StateConfig;
  restore: RestoreConfig;
  confirm_close_running: boolean;
  copy_on_select: boolean;
  quit_when_no_tabs: boolean;
  close_tab_on_clean_exit: boolean;
  shift_enter_newline: boolean;
  key_bindings: KeyBindings;
};

export type AppConfigPatch = Omit<Partial<AppConfig>, 'notification' | 'state' | 'restore'> & {
  notification?: Partial<NotificationConfig>;
  state?: Partial<StateConfig>;
  restore?: Partial<RestoreConfig>;
};

export type ServerMsg =
  | { t: 'sessions'; list: SessionInfo[] }
  | { t: 'state'; sid: string; cwd: string; cmd: string; state: SessionState; exit: number | null; integrated: boolean; run_ms?: number }
  | {
      t: 'agent_state';
      sid: string;
      agent: string;
      agent_state: AgentState;
      agent_state_since: string;
      agent_state_signal: AgentStateSignal | string;
      agent_state_detail?: string;
    }
  | {
      t: 'notify';
      sid: string;
      title: string;
      body: string;
      kind?: string;
      source?: string;
    }
  | { t: 'output'; sid: string; data: string }
  | { t: 'replay'; sid: string; data: string; done: boolean }
  | { t: 'error'; sid?: string; code?: string; message: string };
