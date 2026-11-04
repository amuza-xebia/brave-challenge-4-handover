import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const good = [
  line('2026-11-01T01:00:00+01:00', 'zeta/fail', 'fail', null, 'boom'),
  line('2026-11-01T01:10:00+01:00', 'beta/retry', 'retry', 'rook', 'upstream 503'),
  line('2026-11-01T01:11:00+01:00', 'beta/retry', 'retry', 'rook', 'upstream 503'),
  line('2026-11-01T01:12:00+01:00', 'beta/retry', 'retry', 'rook', 'upstream 503'),
  line('2026-11-01T01:13:00+01:00', 'beta/retry', 'ok', 'rook'),
  line('2026-11-01T02:00:00+01:00', 'alpha/ok', 'ok', 'lane-07'),
];
const jobsSorted = ['alpha/ok', 'beta/retry', 'zeta/fail'];

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(dir, '2026-11-01.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(dir, '2026-11-02.jsonl'), '');
  writeFileSync(join(dir, '2026-11-03.jsonl'), good.join('\n') + '\n{"at":"2026-11-01T03:00:00+01:0');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

// Job names in the order they first appear in the page.
const pageOrder = (html: string) =>
  jobsSorted
    .map((j) => ({ j, at: html.indexOf(j) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.j);

// The table row (chunk between <tr) that mentions a job.
const rowOf = (html: string, job: string) => html.split('<tr').find((c) => c.includes(job)) ?? '';

type Body = { night: string; rows: { job: string; owner: string | null }[]; badLines: number };

describe('GET /digest/:night', () => {
  it('renders a night with data, one row per job', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const j of jobsSorted) expect(html).toContain(j);
    expect(html).not.toContain('nothing ran');
    expect(html).not.toContain("didn't parse");
  });

  it('marks rows with 3 or more retries or a last status of fail with class="warn"', async () => {
    const html = await (await app.request('/digest/2026-11-01')).text();
    expect(rowOf(html, 'beta/retry')).toContain('class="warn"');
    expect(rowOf(html, 'zeta/fail')).toContain('class="warn"');
    expect(rowOf(html, 'alpha/ok')).not.toContain('class="warn"');
  });

  it('is 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-12-31');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it("still renders the good jobs and says what didn't parse for a bad line", async () => {
    const res = await app.request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const j of jobsSorted) expect(html).toContain(j);
    expect(html).toContain("didn't parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('returns { night, rows, badLines } sorted by job', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.night).toBe('2026-11-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(jobsSorted);
    expect(body.rows.find((r) => r.job === 'zeta/fail')!.owner).toBeNull();
    expect(body.rows.find((r) => r.job === 'beta/retry')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
  });

  it('is 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-12-31');
    expect(res.status).toBe(404);
  });

  it('gives 200 with no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-11-02', rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-11-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(jobsSorted);
  });
});

describe('page and JSON agree', () => {
  it('lists the jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-11-01')).text();
    const body = (await (await app.request('/api/digest/2026-11-01')).json()) as Body;
    expect(pageOrder(html)).toEqual(body.rows.map((r) => r.job));
  });
});
