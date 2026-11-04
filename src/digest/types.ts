// Plan morning-digest § 1. The contract every part of § 2 builds against.

/** Status of one line in runs/<night>.jsonl. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from all of its lines in runs/<night>.jsonl. */
export type DigestRow = {
  job: string;
  /** `null` when the log has no owner; views render it as `—`. */
  owner: string | null;
  /** Number of lines for this job. */
  runs: number;
  /** Number of lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** `error` of the last line, `null` when it has none. */
  lastError: string | null;
  /** `at` of the first and the last line, as written in the log (offset kept). */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Rows sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse; counted, never thrown. */
  badLines: number;
};

/**
 * Reads runs/<night>.jsonl from `runsDir`.
 * Returns `null` when the night has no file. An empty file gives `rows: []`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
