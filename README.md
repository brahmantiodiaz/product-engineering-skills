<p align="center">
  <a href="https://brahmantiodiaz.com/">
    <img src="https://brahmantiodiaz.com/images/hero-developer.png" alt="Aulia Brahmantio Diaz" width="320">
  </a>
</p>

# Gyrospec

Human-driven product engineering for coding agents. Run discovery, PRD, prototype (or not applicable), spec, sub-ticket breakdown, planning, and execution inside your product repository, with a gate you approve at every step. Artifacts and approval snapshots live in a committed `.gyro/` folder, and an offline `gyro` script (Node 20 or later, no npm install, platform, or token) checks the formats, computes what is stale, and records your approvals.

Built by [Aulia Brahmantio Diaz](https://brahmantiodiaz.com/). Gyrospec is a fork of [mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock (MIT): it builds on his skills (`grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling`, `codebase-design`, and the `to-tickets` approach), and its planning and execution skills adapt [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT). Matt's skills are kept in this repository under `skills/engineering` and `skills/productivity`; his original README is in [UPSTREAM-README.md](UPSTREAM-README.md). Full notices: [skills/gyrospec/THIRD_PARTY_NOTICES.md](skills/gyrospec/THIRD_PARTY_NOTICES.md).

## The flow

You type each phase; none of them moves to the next on its own.

| Skill | What it does |
|---|---|
| [`/gyro-discovery`](skills/gyrospec/gyro-discovery/SKILL.md) | Interview in rounds and record facts, decisions, assumptions, and open questions |
| [`/gyro-prd`](skills/gyrospec/gyro-prd/SKILL.md) | Turn discovery into a checked PRD (objective, baselined metrics, user journey, user-story requirements) and ask for approval |
| [`/gyro-prototype`](skills/gyrospec/gyro-prototype/SKILL.md) | Build a local HTML prototype linked to the requirements, or record that there is no UI |
| [`/gyro-spec`](skills/gyrospec/gyro-spec/SKILL.md) | Design against the approved requirements and ask for approval |
| [`/gyro-breakdown`](skills/gyrospec/gyro-breakdown/SKILL.md) | Draft and validate vertical sub-tickets |
| [`/gyro-writing-plans`](skills/gyrospec/gyro-writing-plans/SKILL.md) | Write a TDD plan for a ready sub-ticket |
| [`/gyro-executing-plans`](skills/gyrospec/gyro-executing-plans/SKILL.md) | Execute a current plan and record progress and the PR |

The model-invoked [`gyro`](skills/gyrospec/gyro/SKILL.md) skill is the shared reference the phases call: the `.gyro/` layout, the format conventions, running the script, and how approvals are asked for and recorded.

## Installation

Gyrospec installs in any agent that reads Agent Skills folders (`SKILL.md`). Install two plugins from the [Gyrospec marketplace](https://github.com/gyrospec/marketplace): `gyrospec`, and `mattpocock-skills`, which provides the upstream skills the phases call.

| Agent | How | Tested |
|---|---|---|
| Claude Code | Gyrospec marketplace | Yes |
| Codex | Gyrospec marketplace | Yes |
| GitHub Copilot CLI | Gyrospec marketplace | Not yet |
| Gemini CLI | `gemini skills install` | Not yet |
| Any other agent | Copy the skill folders | The Codex copy route is tested |

Pick one route per agent: a plugin install plus a folder copy gives you every skill twice.

**Claude Code**

```text
/plugin marketplace add gyrospec/marketplace
/plugin install gyrospec@gyrospec
/plugin install mattpocock-skills@gyrospec
```

**Codex**

```bash
codex plugin marketplace add gyrospec/marketplace
codex plugin add gyrospec@gyrospec
codex plugin add mattpocock-skills@gyrospec
```

Copilot CLI, Gemini CLI, folder copies, and updates: see [skills/gyrospec/README.md](skills/gyrospec/README.md#installation).

## Start

In your product repository, start a new agent session and type `/gyro-discovery`. Each phase ends by naming the next one.

## License

MIT. See [LICENSE](LICENSE) and [skills/gyrospec/THIRD_PARTY_NOTICES.md](skills/gyrospec/THIRD_PARTY_NOTICES.md).
