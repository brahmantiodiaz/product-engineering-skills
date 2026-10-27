import { it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parsePrd } from '@gyrospec/format';
import { fixture, run, tempRepo } from './helpers.js';
const root = resolve('../../skills/gyrospec');
const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')) as { skills: string[] };
const flow = ['gyro-discovery', 'gyro-prd', 'gyro-prototype', 'gyro-spec', 'gyro-breakdown', 'gyro-writing-plans', 'gyro-executing-plans'];
it('every skill listed in plugin.json exists', () => {
  expect(manifest.skills).toHaveLength(8);
  for (const folder of manifest.skills) expect(existsSync(join(root, folder, 'SKILL.md')), folder).toBe(true);
});
function lint(dir: string): string[] {
  const name = basename(dir), errors: string[] = [];
  const skillFile = join(dir, 'SKILL.md'), metaFile = join(dir, 'agents/openai.yaml');
  if (!existsSync(skillFile)) errors.push('missing SKILL.md');
  if (!existsSync(metaFile)) errors.push('missing agents/openai.yaml');
  const skill = existsSync(skillFile) ? readFileSync(skillFile, 'utf8') : '';
  const metadata = existsSync(metaFile) ? readFileSync(metaFile, 'utf8') : '';
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1] ?? '';
  if (!new RegExp(`^name: ${name}$`, 'm').test(front)) errors.push('name must match folder');
  if (!/^description: \S.+$/m.test(front)) errors.push('missing description');
  for (const key of ['display_name', 'short_description']) if (!new RegExp(`^  ${key}: "[^"\r\n]+"$`, 'm').test(metadata)) errors.push(`missing ${key}`);
  if (name === 'gyro') {
    if (/disable-model-invocation:/.test(front) || /^policy:/m.test(metadata)) errors.push('gyro must be model-invoked');
  } else {
    if (!/^disable-model-invocation: true$/m.test(front)) errors.push('phase must disable model invocation');
    if (!/^policy:\r?\n  allow_implicit_invocation: false$/m.test(metadata)) errors.push('phase must disable implicit invocation');
    if (!skill.includes('gyro status')) errors.push('missing status preflight');
    const next = flow[flow.indexOf(name) + 1];
    if (next && !skill.includes(next)) errors.push('missing next phase');
    for (const match of skill.matchAll(/Call the Skill tool with "([^"]+)"/g)) if (!['gyro', 'grilling', 'prototype', 'tdd', 'code-review', 'domain-modeling'].includes(match[1])) errors.push(`illegal dependency ${match[1]}`);
  }
  return errors;
}
it('validates invocation policy, metadata, and flow for existing skill folders', () => {
  for (const folder of manifest.skills) {
    const dir = join(root, folder);
    if (existsSync(dir)) expect(lint(dir), folder).toEqual([]);
  }
});
it('detects missing Codex metadata and an accidentally model-invoked phase', () => {
  const dir = join(tempRepo(), 'gyro-prd'); mkdirSync(dir);
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: gyro-prd\ndescription: Write a PRD.\n---\ngyro status\ngyro-prototype\n');
  expect(lint(dir)).toContain('missing agents/openai.yaml');
  expect(lint(dir)).toContain('phase must disable model invocation');
  rmSync(join(dir, 'SKILL.md'));
});
const repoSkills = resolve(root, '..');
function upstreamFolder(name: string): string | undefined {
  return readdirSync(repoSkills).map(bucket => join(repoSkills, bucket, name)).find(dir => existsSync(join(dir, 'SKILL.md')));
}
/** Upstream skills the phases call, plus every skill those call in turn. */
function reachableUpstream(): string[] {
  const seen = new Set<string>(), queue = ['grilling', 'prototype', 'tdd', 'code-review', 'domain-modeling'];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = upstreamFolder(name);
    if (!dir) continue;
    const text = readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith('.md')).map(f => readFileSync(join(dir, String(f)), 'utf8')).join('\n');
    for (const m of text.matchAll(/call the Skill tool with "([^"]+)"/gi)) queue.push(m[1]!);
  }
  return [...seen];
}
it('README names an existing folder for every upstream skill the phases reach', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  expect(reachableUpstream()).toContain('codebase-design');
  for (const dep of reachableUpstream()) {
    const path = new RegExp(`skills/[a-z-]+/${dep}\\b`).exec(readme)?.[0];
    expect(path, dep).toBeDefined();
    expect(existsSync(join(root, '../..', path!, 'SKILL.md')), path).toBe(true);
  }
});
it('installs from the separate gyrospec marketplace, leaving the fork marketplace unchanged', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  expect(readme).toContain('/plugin marketplace add gyrospec/marketplace');
  expect(readme).toContain('/plugin install gyrospec@gyrospec');
  expect(readme).not.toContain('@mattpocock');
  const fork = JSON.parse(readFileSync(join(root, '../../.claude-plugin/marketplace.json'), 'utf8')) as { plugins: { name: string }[] };
  expect(fork.plugins.map(p => p.name)).toEqual(['gyrospec-upstream-skills']);
});
it('gives code-review a fixed point, the local spec and plan, and the uncommitted changes', () => {
  const skill = readFileSync(join(root, 'gyro-executing-plans/SKILL.md'), 'utf8');
  for (const needle of ['no issue tracker', 'approved/spec.', 'git diff', 'untracked', '**Execution start:**']) expect(skill, needle).toContain(needle);
});
it('lets review run with nothing committed, reconciles changes on resume, and recovers a plan after a new spec', () => {
  const exec = readFileSync(join(root, 'gyro-executing-plans/SKILL.md'), 'utf8');
  for (const needle of ['empty committed diff', 'skip its non-empty check', 'since the last session', 'out of scope', 'immediately before marking the ticket done', 'gate shows `draft`']) expect(exec, needle).toContain(needle);
  const plans = readFileSync(join(root, 'gyro-writing-plans/SKILL.md'), 'utf8');
  for (const needle of ['Revising an existing plan', 'in_progress', 'blocked', '**Execution start:**', 'completed tasks']) expect(plans, needle).toContain(needle);
});
it('requires a clean ticket check before planning and executing, and reviews done tickets before advancing them', () => {
  for (const folder of ['gyro-writing-plans', 'gyro-executing-plans']) expect(readFileSync(join(root, folder, 'SKILL.md'), 'utf8'), folder).toContain('`gyro check <slug> tickets` is clean');
  const breakdown = readFileSync(join(root, 'gyro-breakdown/SKILL.md'), 'utf8');
  for (const needle of ['stale `done` ticket', 'reopen', 'follow-up ticket', 'before moving its `spec_revision`', '`uncovered`']) expect(breakdown, needle).toContain(needle);
});
it('shapes the PRD around one objective, baselined metrics, a journey, and user-story REQs', () => {
  const prdSkill = readFileSync(join(root, 'gyro-prd/SKILL.md'), 'utf8');
  for (const needle of ['## Objective', '## Success Metrics', '| Metric | Baseline | Target |', '## User Journey', 'Given I am a', 'negative']) expect(prdSkill, needle).toContain(needle);
  const discovery = readFileSync(join(root, 'gyro-discovery/SKILL.md'), 'utf8');
  for (const needle of ['one core objective', 'current baseline']) expect(discovery, needle).toContain(needle);
});
it('the PRD template in gyro-prd passes gyro check unchanged', async () => {
  const prdSkill = readFileSync(join(root, 'gyro-prd/SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const template = /```markdown\n([\s\S]*?)\n {3}```/.exec(prdSkill)![1].split('\n').map(l => l.replace(/^ {3}/, '')).join('\n') + '\n';
  const { root: repo, put } = await fixture(); put('prd.md', template);
  expect(await run(repo, 'check', 'demo', 'prd')).toMatchObject({ code: 0, out: ['prd.md: OK'] });
  const req = parsePrd(template).requirements[0]!;
  expect(req.statement).toContain('Given I am a');
  expect(req.acceptanceCriteria.map(ac => ac.id)).toEqual(['AC-001', 'AC-002']);
});
it('carries upstream notices inside the plugin and inside every adapted skill folder', () => {
  const matt = 'Copyright (c) 2026 Matt Pocock', superpowers = 'Copyright (c) 2025 Jesse Vincent';
  const notices = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  for (const needle of [matt, superpowers]) expect(notices, needle).toContain(needle);
  const adapted: Record<string, string> = { 'gyro-breakdown': matt, 'gyro-writing-plans': superpowers, 'gyro-executing-plans': superpowers };
  for (const [folder, copyright] of Object.entries(adapted)) expect(readFileSync(join(root, folder, 'NOTICE.md'), 'utf8'), folder).toContain(copyright);
});
it('has no em dash in plugin files other than the generated bundle', () => {
  const walk = (dir: string) => { for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (item.name !== 'gyro.mjs') expect(readFileSync(file, 'utf8'), file).not.toContain(String.fromCharCode(0x2014));
  } };
  walk(root);
});
