import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { run, tempRepo } from './helpers.js';
describe('init', () => {
  it('creates local files and refuses overwriting', async () => {
    const root = tempRepo();
    const args = ['init', 'agreement-validation', '--title', 'Agreement validation', '--size', 'medium'];
    expect((await run(root, ...args)).code).toBe(0);
    const dir = join(root, '.gyro/agreement-validation');
    expect(JSON.parse(readFileSync(join(root, '.gyro/config.json'), 'utf8'))).toEqual({ mode: 'local', formatVersion: 1 });
    expect(JSON.parse(readFileSync(join(dir, 'ticket.json'), 'utf8'))).toEqual({ title: 'Agreement validation', size: 'medium', platformKey: null, createdAt: expect.stringMatching(/^\d{4}-.*Z$/) });
    const gates = JSON.parse(readFileSync(join(dir, 'gates.json'), 'utf8'));
    for (const gate of Object.values(gates)) expect(gate).toEqual({ status: 'draft', revision: 0, history: [] });
    expect(readdirSync(join(dir, 'approved'))).toEqual([]);
    expect(readdirSync(join(dir, 'tickets'))).toEqual([]);
    expect(await run(root, ...args)).toMatchObject({ code: 1, err: ['Ticket agreement-validation already exists'] });
  });
  it.each(['Agreement', 'a--b', '-a', 'a'.repeat(61), '../escape'])('rejects slug %s', async slug => {
    expect((await run(tempRepo(), 'init', slug, '--title', 'X', '--size', 'small')).code).toBe(2);
  });
  it('rejects bad size and missing title', async () => {
    const root = tempRepo();
    expect((await run(root, 'init', 'demo', '--title', 'X', '--size', 'huge')).code).toBe(2);
    expect((await run(root, 'init', 'demo', '--size', 'small')).code).toBe(2);
  });
  it('handles missing workspaces and unknown commands without a stack', async () => {
    expect(await run(tempRepo(), 'status', 'unknown-slug')).toMatchObject({ code: 2, err: ['No Gyrospec ticket named unknown-slug. Run /gyro-discovery first'] });
    expect((await run(tempRepo(), 'wat')).err.join('')).toContain('init, check, status, approve, ticket');
  });
  it.each([
    [{ mode: 'local', formatVersion: 2 }, '.gyro/config.json has formatVersion 2; this gyro supports formatVersion 1. Update the gyrospec plugin'],
    [{ mode: 'local' }, '.gyro/config.json has no formatVersion; this gyro supports formatVersion 1'],
  ])('refuses every command on an unsupported workspace format %j', async (config, message) => {
    const root = tempRepo();
    await run(root, 'init', 'demo', '--title', 'Demo', '--size', 'small');
    writeFileSync(join(root, '.gyro/config.json'), JSON.stringify(config));
    for (const argv of [['status', 'demo'], ['status'], ['check', 'demo'], ['init', 'other', '--title', 'X', '--size', 'small']]) {
      expect(await run(root, ...argv), argv.join(' ')).toMatchObject({ code: 2, err: [message] });
    }
  });
  it('refuses init outside a repository root without creating files', async () => {
    const sub = join(tempRepo(), 'packages');
    mkdirSync(sub);
    expect(await run(sub, 'init', 'demo', '--title', 'X', '--size', 'small')).toMatchObject({ code: 2, err: ['Run gyro from the product repository root (the folder that holds .git). Run /gyro-discovery first'] });
    expect(existsSync(join(sub, '.gyro'))).toBe(false);
  });
  it('accepts a git worktree root, where .git is a file', async () => {
    const root = tempRepo();
    rmSync(join(root, '.git'), { recursive: true }); writeFileSync(join(root, '.git'), 'gitdir: elsewhere\n');
    expect((await run(root, 'init', 'demo', '--title', 'X', '--size', 'small')).code).toBe(0);
  });
  it('reports a missing workspace for status without a slug', async () => {
    const result = await run(tempRepo(), 'status', '--json');
    expect(result.code).toBe(2);
    expect(result.err).toEqual(['No Gyrospec workspace here. Run /gyro-discovery first']);
  });
});
