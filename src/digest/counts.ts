import { readFileSync } from 'node:fs';
import { nightFile } from './read.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Same rules as readNight: a line counts only when it is a well-formed run line.
function lineStatus(text: string): RunStatus | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  if (o.owner !== null && o.owner !== undefined && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && o.error !== null && typeof o.error !== 'string') return null;
  return o.status as RunStatus;
}

/** Per-status line counts for a night; `null` when the night has no file. */
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  const file = nightFile(runsDir, night);
  if (!file) return null;
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const s = lineStatus(raw);
    if (s) counts[s]++;
  }
  return counts;
}
