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

## Installation

For Claude Code, add the Gyrospec marketplace and install both plugins. `mattpocock-skills` provides the upstream skills the phases call (`grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling`).

```text
/plugin marketplace add gyrospec/marketplace
/plugin install gyrospec@gyrospec
/plugin install mattpocock-skills@gyrospec
```

For Codex, copy or symlink each of the eight `skills/gyrospec/<skill>` folders into `~/.agents/skills`, then do the same for these upstream folders, each as its own skill folder:

- `skills/productivity/grilling`
- `skills/engineering/prototype`
- `skills/engineering/tdd`
- `skills/engineering/code-review`
- `skills/engineering/domain-modeling`
- `skills/engineering/codebase-design` (called by `tdd`)

Keep each folder whole: its `agents/openai.yaml`, its `NOTICE.md` where present, and, for `gyro`, the `scripts/gyro.mjs` bundle with its `scripts/THIRD_PARTY_LICENSES.txt`. Notices for the plugin are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Run all script commands from the product repository root. Install Node 20+ before beginning discovery.
