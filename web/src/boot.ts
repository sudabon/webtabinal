import type { AppConfig } from './types';

export function bootErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function loadInitialConfig(
  getConfig: () => Promise<AppConfig>,
): Promise<{ ok: true; config: AppConfig } | { ok: false; error: string }> {
  try {
    return { ok: true, config: await getConfig() };
  } catch (err) {
    return { ok: false, error: bootErrorMessage(err) };
  }
}
