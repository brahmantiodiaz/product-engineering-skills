---
name: gyro-prototype
description: Build a requirement-linked HTML prototype or record approved non-applicability.
disable-model-invocation: true
---

# Prototype

1. Call the Skill tool with "gyro". Follow its Node 20+ preflight, script location, language, and approval instructions. Reply in the user's language and keep convention keywords English.
2. Run `gyro status <slug> --json`. The PRD must be `approved` with no `changedSince`. If it is not, name the reason, suggest `/gyro-prd <slug>` (or the reported `next` when discovery is missing), and stop. Read the current approved PRD snapshot and discovery context. Do not introduce behavior outside those requirements.
3. Ask whether this feature has a UI. If it has none, ask for a nonempty reason. Show gate `prototype`, the next revision, and the proposed reason. Ask for explicit yes/no approval of marking the prototype not applicable. Only on an explicit yes run `gyro approve prototype <slug> --not-applicable "<reason>" --quote "<the user's words>"`. A reason alone is not approval. Show refusal lines verbatim and resolve them. Verify `not_applicable` with `gyro status <slug> --json`, suggest `/gyro-spec <slug>`, and stop.
4. For a UI feature, Call the Skill tool with "prototype". Constrain its UI branch to `.gyro/<slug>/prototype.html`: exactly one self-contained HTML file with inline CSS, JS, and assets; hash routing (`#/screen-name`); one unique `data-screen="screen-name"` wrapper per screen; and `data-req="REQ-001 REQ-004"` on the relevant elements. Include entry, success, validation, empty, and failure states that the PRD actually requires. Do not replace this with a framework app or publish it.
5. Run `gyro check <slug> prototype`. Fix format and reference errors until clean. For each `Uncovered requirements` note, either add its actual UI representation or ask the user to confirm why it has no screen. Record that coverage explanation in the HTML as a comment so it survives the chat. Do not attach IDs to unrelated elements just to satisfy coverage.
6. Tell the user to open `.gyro/<slug>/prototype.html` in a local browser and review routes, interactions, and requirement coverage. Ask for corrections before approval. After any changes rerun the check. Run `gyro status <slug> --json`, summarize changes, gate `prototype`, and the next revision. Ask a direct yes/no approval question and wait. On an explicit yes run `gyro approve prototype <slug> --quote "<the user's words>"`; show refusal lines verbatim if needed.
7. Verify the gate with `gyro status <slug> --json`. Once approved, tell the user the next step is `/gyro-spec <slug>` and stop. Do not invoke it.
