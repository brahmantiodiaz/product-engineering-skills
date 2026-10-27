import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { run, tempRepo } from './helpers.js';
const bundle = resolve('../../skills/gyrospec/gyro/scripts/gyro.mjs');
function node(args: string[], cwd: string) { return spawnSync(process.execPath, args, { cwd, encoding: 'utf8' }); }
it('builds identical bytes and has no external format imports', () => {
  const output = join(tempRepo(), 'gyro.mjs');
  const result = node(['scripts/bundle.mjs', '--outfile', output], process.cwd());
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output)).toEqual(readFileSync(bundle));
  expect(readFileSync(bundle, 'utf8')).not.toMatch(/(?:require\(|from )['"]@gyrospec/);
});
it('ships the licenses of every bundled third-party package next to the bundle', () => {
  const dir = tempRepo();
  const result = node(['scripts/bundle.mjs', '--outfile', join(dir, 'gyro.mjs')], process.cwd());
  expect(result.status, result.stderr).toBe(0);
  const committed = resolve('../../skills/gyrospec/gyro/scripts/THIRD_PARTY_LICENSES.txt');
  expect(readFileSync(join(dir, 'THIRD_PARTY_LICENSES.txt'))).toEqual(readFileSync(committed));
  const text = readFileSync(committed, 'utf8');
  for (const needle of ['htmlparser2', 'entities', 'Chris Winberry', 'Copyright (c) Felix', 'Redistribution and use in source and binary forms']) expect(text, needle).toContain(needle);
  expect(text).not.toContain('@gyrospec');
});
it('contains no em dash, including bundled dependency comments', () => {
  expect(readFileSync(bundle, 'utf8').includes(String.fromCharCode(0x2014))).toBe(false);
});
it('reports version and runs init/status with source parity offline', async () => {
  const root = tempRepo();
  expect(node([bundle, '--version'], root)).toMatchObject({ status: 0, stdout: 'gyro 0.1.0\n' });
  const init = node([bundle, 'init', 'demo', '--title', 'Demo', '--size', 'small'], root);
  expect(init.status, init.stderr).toBe(0);
  const result = node([bundle, 'status', 'demo', '--json'], root);
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(JSON.parse((await run(root, 'status', 'demo', '--json')).out.join('\n')));
});
it('reports missing workspace/slug as exit 2 with discovery guidance and no stack', () => {
  const result = node([bundle, 'status', 'nope'], tempRepo());
  expect(result.status).toBe(2);
  expect(result.stderr.trim()).toBe('No Gyrospec ticket named nope. Run /gyro-discovery first');
});
