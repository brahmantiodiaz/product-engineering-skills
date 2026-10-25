# @gyrospec/format

Parser and validator for the Gyrospec artifact formats: PRDs, specs, and HTML prototypes. It turns each artifact into an index of requirement (`REQ-`) and acceptance criterion (`AC-`) IDs, enforces the ID rules, and computes per-requirement diffs between revisions. The CLI, the platform server, and the web editor all use this one package, so every consumer reports the same errors with the same text. It has no Node built-in dependencies and runs in the browser too.

## Installing

The package is published to GitHub Packages under the `gyrospec` organization. Point the scope at the GitHub registry in the consumer's `.npmrc`, with a token that has `read:packages` (GitHub requires one even for public packages):

```
@gyrospec:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then depend on it by name:

```json
"dependencies": {
  "@gyrospec/format": "0.1.0"
}
```

## API

| Function | Purpose |
|---|---|
| `parsePrd(source)` | Index REQ blocks (title, statement, status, criticality, acceptance criteria, fingerprint) and report format errors |
| `checkRevision(previous, next)` | Reject REQ IDs that were deleted instead of marked `removed`, or revived after removal |
| `diffRequirements(previous, next)` | List REQ IDs that were added, changed, or removed. Prose outside REQ blocks never counts as a change |
| `findBlockers(prd)` | REQs with criticality `blocker` and status `open` or `conflicted`, which block PRD approval |
| `parseSpec(source)` | Collect `**Implements:**` references per spec section |
| `validateReferences(prd, references)` | Flag references to REQ IDs that do not exist or are `removed` |
| `parsePrototype(html)` | Map `data-req` references to `data-screen` screens, with line numbers |
| `uncoveredRequirements(prd, prototype)` | Active REQs that no prototype element references |
| `formatError(error)` | The only way to render an error: `line N: message [CODE]` |

Every parser returns an `errors` array of `{ code, line, message }`. Line `0` means the whole document.

## Format

The conventions are defined in section 7 of the [Gyrospec design spec](../../docs/superpowers/specs/2026-10-25-gyrospec-design.md):

```md
### REQ-001 Agreement required before Product Order
A Product Order can only be created when its Agreement is Approved.
**Status:** decided · **Criticality:** blocker

- [AC-001] Given a Draft Agreement, when a user creates a Product Order, then it is rejected
```

Specs mark each section with `**Implements:** REQ-001, REQ-003`. Prototypes wrap each screen in `data-screen="<name>"` and mark elements with `data-req="REQ-001 REQ-004"`.

Convention keywords and their values are English only, whatever language the document is written in (spec section 4). A PRD written in Indonesian still writes `**Status:** decided`.

## Fixtures

`fixtures/` holds golden cases that other packages can run against their own integration of this package:

```
fixtures/prd/<case>/input.md + expected.json
fixtures/diff/<case>/prev.md + next.md + expected.json
fixtures/spec/<case>/prd.md + input.md + expected.json
fixtures/prototype/<case>/prd.md + input.html + expected.json
```

They are published with the package and resolve as `@gyrospec/format/fixtures/<kind>/<case>/<file>`. `test/fixtures.test.ts` shows how each kind maps to the public functions. Every `errors` entry is `formatError` output ordered by line, so the fixtures also lock the message text.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```
