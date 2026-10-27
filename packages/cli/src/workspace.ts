import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { refused, usage } from './errors.js';
export type Size = 'small' | 'medium' | 'large';
export type GateKind = 'prd' | 'prototype' | 'spec';
export const ARTIFACT_FILES: Record<GateKind, string> = { prd: 'prd.md', prototype: 'prototype.html', spec: 'spec.md' };
export interface TicketMeta { title: string; size: Size; createdAt: string; platformKey: string | null }
export interface Approval {
  revision: number; sha256: string | null; approvedAt: string; quote: string;
  notApplicable: string | null; basedOn: { prd?: number; prototype?: number };
}
export interface GateRecord {
  status: 'draft' | 'approved' | 'not_applicable'; revision: number;
  sha256?: string; approvedAt?: string; quote?: string; reason?: string; basedOn?: Approval['basedOn']; history: Approval[];
}
export type Gates = Record<GateKind, GateRecord>;
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export function validateSlug(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) throw usage('Invalid ticket slug');
}
/** The .gyro layout version this gyro reads and writes; config.json records it. */
export const FORMAT_VERSION = 1;
export class Workspace {
  readonly gyroDir: string;
  constructor(readonly root: string) { this.gyroDir = join(root, '.gyro'); }
  /** Refuses a workspace written in a layout this gyro does not know. No-op before the first init. */
  assertFormat(): void {
    const path = join(this.gyroDir, 'config.json');
    if (!existsSync(path)) return;
    const version: unknown = JSON.parse(readFileSync(path, 'utf8')).formatVersion;
    if (version === FORMAT_VERSION) return;
    if (version === undefined) throw usage(`.gyro/config.json has no formatVersion; this gyro supports formatVersion ${FORMAT_VERSION}`);
    throw usage(`.gyro/config.json has formatVersion ${JSON.stringify(version)}; this gyro supports formatVersion ${FORMAT_VERSION}. Update the gyrospec plugin`);
  }
  slugDir(slug: string): string {
    this.assertFormat();
    validateSlug(slug);
    const dir = join(this.gyroDir, slug);
    if (!existsSync(join(dir, 'ticket.json'))) throw usage(`No Gyrospec ticket named ${slug}. Run /gyro-discovery first`);
    return dir;
  }
  listSlugs(): string[] {
    this.assertFormat();
    return existsSync(this.gyroDir) ? readdirSync(this.gyroDir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(this.gyroDir, d.name, 'ticket.json'))).map(d => d.name).sort() : [];
  }
  readTicket(slug: string): TicketMeta { return JSON.parse(readFileSync(join(this.slugDir(slug), 'ticket.json'), 'utf8')); }
  readArtifact(slug: string, kind: GateKind): string | null {
    const path = join(this.slugDir(slug), ARTIFACT_FILES[kind]);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  }
  readGates(slug: string): Gates { return JSON.parse(readFileSync(join(this.slugDir(slug), 'gates.json'), 'utf8')); }
  writeGates(slug: string, gates: Gates): void { writeJson(join(this.slugDir(slug), 'gates.json'), gates); }
  snapshotPath(slug: string, kind: GateKind, revision: number): string { return join(this.slugDir(slug), 'approved', `${kind}.${revision}.${kind === 'prototype' ? 'html' : 'md'}`); }
  /** Runs fn while holding .gyro/<slug>/.lock, so two gyro processes never interleave changes to one ticket. */
  withLock<T>(slug: string, fn: () => T): T {
    const lock = join(this.slugDir(slug), '.lock');
    try { closeSync(openSync(lock, 'wx')); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw refused(`Another gyro command is changing .gyro/${slug}. If none is running, delete .gyro/${slug}/.lock and retry`);
      throw e;
    }
    try { return fn(); } finally { rmSync(lock, { force: true }); }
  }
}
/** Writes through a temporary file and a rename, so a crash never leaves half a JSON file. */
function writeJson(path: string, value: unknown) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, path);
}
export function initTicket(ws: Workspace, slug: string, input: { title: string; size: Size }, now = new Date()): void {
  // .git is a folder in a repository and a file in a git worktree.
  if (!existsSync(join(ws.root, '.git'))) throw usage('Run gyro from the product repository root (the folder that holds .git). Run /gyro-discovery first');
  ws.assertFormat();
  validateSlug(slug);
  if (!input.title?.trim() || !['small', 'medium', 'large'].includes(input.size)) throw usage('init requires --title and --size small, medium, or large');
  const dir = join(ws.gyroDir, slug);
  mkdirSync(ws.gyroDir, { recursive: true });
  // A non-recursive mkdir claims the slug atomically: of two concurrent inits only one creates the folder.
  try { mkdirSync(dir); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw refused(`Ticket ${slug} already exists`);
    throw e;
  }
  const config = join(ws.gyroDir, 'config.json');
  if (!existsSync(config)) writeJson(config, { mode: 'local', formatVersion: FORMAT_VERSION });
  writeJson(join(dir, 'ticket.json'), { ...input, createdAt: now.toISOString(), platformKey: null });
  const draft = () => ({ status: 'draft' as const, revision: 0, history: [] });
  ws.writeGates(slug, { prd: draft(), prototype: draft(), spec: draft() });
  for (const folder of ['approved', 'tickets']) mkdirSync(join(dir, folder));
}
