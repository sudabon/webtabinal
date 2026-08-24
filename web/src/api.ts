import type { SavedImage } from './image-attach';
import type { AppConfig, AppConfigPatch, SessionInfo } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listSessions: () => req<{ sessions: SessionInfo[] }>('/api/sessions'),
  createSession: (cwd?: string) =>
    req<SessionInfo>('/api/sessions', { method: 'POST', body: JSON.stringify({ cwd }) }),
  duplicateSession: (id: string) =>
    req<SessionInfo>(`/api/sessions/${id}/duplicate`, { method: 'POST' }),
  restartSession: (id: string) =>
    req<SessionInfo>(`/api/sessions/${id}/restart`, { method: 'POST' }),
  deleteSession: (id: string) =>
    req<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
  patchSessionMemo: (id: string, memo: string) =>
    req<SessionInfo>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ memo }),
    }),
  reorderSessions: (ids: string[]) =>
    req<{ sessions: SessionInfo[] }>('/api/sessions/order', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
  // Raw bytes, not JSON: the daemon sniffs the format itself, so a base64
  // round-trip would only inflate the upload.
  uploadSessionImage: (id: string, blob: Blob) =>
    req<SavedImage>(`/api/sessions/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    }),
  getConfig: () => req<AppConfig>('/api/config'),
  patchConfig: (patch: AppConfigPatch) =>
    req<AppConfig>('/api/config', { method: 'PATCH', body: JSON.stringify(patch) }),
};
