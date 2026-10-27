# Gyrospec local mode

Run discovery, PRD, prototype (or not applicable), spec, sub-ticket breakdown, planning, and execution inside a product repository. Artifacts and approval snapshots live in its committed `.gyro/` folder. Each phase ends with a suggested command for the human to invoke. The bundled offline script needs Node 20 or later, with no npm installation, platform, or token at runtime. Local approvals record explicit chat answers; platform approvals will be requested again when platform mode is available.

## User-invoked

- [gyro-discovery](gyro-discovery/SKILL.md): Interview in rounds and record discovery.
- [gyro-prd](gyro-prd/SKILL.md): Turn discovery into a checked PRD and ask for approval.
- [gyro-prototype](gyro-prototype/SKILL.md): Build a local HTML prototype or record approved non-applicability.
- [gyro-spec](gyro-spec/SKILL.md): Design against the approved requirements and ask for approval.
- [gyro-breakdown](gyro-breakdown/SKILL.md): Draft and validate vertical sub-tickets.
- [gyro-writing-plans](gyro-writing-plans/SKILL.md): Write a TDD plan for a ready sub-ticket.
- [gyro-executing-plans](gyro-executing-plans/SKILL.md): Execute a current plan and record progress and the PR.

## Model-invoked

- [gyro](gyro/SKILL.md): Shared files, formats, script commands, and approval etiquette.

## What it runs and what it touches

- **One local script.** The skills tell the agent to run `node <plugin>/gyro/scripts/gyro.mjs` from your product repository's root. It is readable bundled source: the `gyro` CLI from `packages/cli` in [gyrospec/skills](https://github.com/gyrospec/skills) plus the `htmlparser2` and `entities` packages (licenses in `gyro/scripts/THIRD_PARTY_LICENSES.txt`). It makes no network requests, reads no environment credentials, and sends no data anywhere.
- **Files.** The script reads and writes only `.gyro/` in the current repository (`config.json`, `ticket.json`, `gates.json`, `approved/` snapshots, `tickets/`, and the artifacts you write with the skills). The phase skills also write the PRD, prototype, spec, discovery log, sub-tickets, and implementation plans (`docs/superpowers/plans/`) in that repository, and the executing skill changes your code as its plan says.
- **Git and tests.** `gyro-executing-plans` runs `git status`, `git diff`, and your project's own test commands, and opens a pull request only when you ask for one. Commits, pushes, and PRs follow your instructions; invoking a skill does not grant them.
- **No hooks, no MCP servers, no background processes, no installs.** Nothing runs unless you type a phase skill or the agent follows one.
- **Needs a shell and Node 20 or later.** It works in agents that can run commands in your repository, such as Claude Code and Codex. In an app without a shell or code execution, the phases cannot run `gyro`.

## Installation

Gyrospec installs in any agent that reads Agent Skills folders (`SKILL.md`). Install two things: this plugin, and `gyrospec-upstream-skills`, which provides the upstream skills the phases call (`grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling`, `codebase-design`). Both come from the [Gyrospec marketplace](https://github.com/gyrospec/marketplace). Every agent needs Node 20 or later, because the skills run `gyro.mjs` with `node`.

| Agent | How | Tested |
|---|---|---|
| Claude Code | Gyrospec marketplace | Yes |
| Codex | Gyrospec marketplace | Yes |
| GitHub Copilot CLI | Gyrospec marketplace | Not yet |
| Gemini CLI | `gemini skills install` | Not yet |
| Any other agent | Copy the skill folders | The Codex copy route is tested |

Pick one route per agent: a plugin install plus a folder copy gives you every skill twice.

If you added Gyrospec from the Claude plugin directory, also add Matt Pocock's skills there (`mattpocock-skills`), which provide the same upstream skills; do not also install `gyrospec-upstream-skills`, or every upstream skill appears twice.

### Claude Code

```text
/plugin marketplace add gyrospec/marketplace
/plugin install gyrospec@gyrospec
/plugin install gyrospec-upstream-skills@gyrospec
```

Start a new session afterwards. Update with `/plugin marketplace update gyrospec`, then update the plugins from `/plugin`.

### Codex

```bash
codex plugin marketplace add gyrospec/marketplace
codex plugin add gyrospec@gyrospec
codex plugin add gyrospec-upstream-skills@gyrospec
```

Update with `codex plugin marketplace upgrade gyrospec`. On Windows, keep `CODEX_HOME` on a short path; a very long one fails the clone with `Filename too long`.

### GitHub Copilot CLI (not tested yet)

```bash
copilot plugin marketplace add gyrospec/marketplace
copilot plugin install gyrospec@gyrospec
copilot plugin install gyrospec-upstream-skills@gyrospec
```

### Gemini CLI (not tested yet)

```bash
gemini skills install https://github.com/gyrospec/skills.git --path skills/gyrospec
gemini skills install https://github.com/gyrospec/skills.git --path skills/engineering
gemini skills install https://github.com/gyrospec/skills.git --path skills/productivity
```

### Any other agent: copy the folders

Copy (or symlink) each of the eight `skills/gyrospec/<skill>` folders into the agent's skills directory (for Codex without plugins, `~/.agents/skills`), then these upstream folders, each as its own skill folder:

- `skills/productivity/grilling`
- `skills/engineering/prototype`
- `skills/engineering/tdd`
- `skills/engineering/code-review`
- `skills/engineering/domain-modeling`
- `skills/engineering/codebase-design` (called by `tdd`)

Copied folders do not update themselves: copy them again after a release.

Keep each folder whole: its `agents/openai.yaml`, its `NOTICE.md` where present, and, for `gyro`, the `scripts/gyro.mjs` bundle with its `scripts/THIRD_PARTY_LICENSES.txt`. Notices for the plugin are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Run all script commands from the product repository root.
