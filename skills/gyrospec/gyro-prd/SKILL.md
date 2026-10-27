---
name: gyro-prd
description: Write and validate a PRD from completed discovery, then request human approval.
disable-model-invocation: true
---

# PRD

1. Call the Skill tool with "gyro". Follow its script resolution, Node 20+ check, language rules, and approval etiquette. Reply in the user's language; keep convention keywords English.
2. Run `gyro status <slug> --json`. Read `.gyro/<slug>/discovery.md`. It must exist, be nonempty, record the user's agreement that discovery is complete, and contain no open or conflicted blocker. Otherwise name the missing input or blocker, suggest `/gyro-discovery <slug>`, and stop. Respect the computed `next`; when revisiting an earlier gate, explain downstream review consequences without advancing another phase.
3. Write `.gyro/<slug>/prd.md` from discovery only, in this order. Section headings stay in English; the prose follows the user's language.

   ```markdown
   # PRD: <feature title>

   ## Objective
   <Exactly one core objective, in one sentence.>

   ## Success Metrics
   | Metric | Baseline | Target |
   |---|---|---|
   | <what is measured> | <current value from discovery> | <target value> |

   ## User Journey
   <The process flow from entry to completion, including alternate paths. A Mermaid flowchart in a fenced block is allowed.>

   ## Scope
   <Included behavior and explicit exclusions.>

   ## Requirements

   ### REQ-001 <short title>
   Given I am a <persona>
   And I am on <place in the product>
   And <what already happened>
   Then <the outcome I get>
   **Status:** decided · **Criticality:** blocker

   - [AC-001] Given <context>, when <action>, then <observable result>
   - [AC-002] Given <context>, when <invalid action>, then <rejection the user sees>
   ```

   - Objective: one objective only. If discovery recorded several, ask the user which one is the core objective and treat the rest as scope or metrics; never merge them into one long sentence.
   - Success Metrics: every metric has its baseline and target from discovery. A baseline that discovery left unknown stays `unknown` in the table and its open question becomes an `open` REQ; do not invent a number.
   - User Journey: describe the flow only. Wireframes, layouts, and screens belong to `/gyro-prototype`, not the PRD.
   - Requirement statements are user stories in the Given I am a / And I am on / And / Then form above. Drop an `And` line that adds nothing.
   - Acceptance criteria stay one line each as `- [AC-NNN] ...`, either scenario-oriented (Given / When / Then) or rule-oriented (a single checkable rule). Each requirement covers its negative scenarios (invalid input, missing permission, failure) as separate ACs, never folded into a positive one.
   - Preserve IDs from any existing PRD and approved snapshots. Never renumber, reuse, or delete a previous requirement block: retain retired requirements with status `removed`.
4. Use confirmed discovery decisions as decided requirements. Keep assumptions visible and unconfirmed. Nonblocking open questions become `open` REQs at their user-confirmed criticality. Do not invent requirements or make recommendations into decisions. If a required statement or criterion needs new information, return the question to the human and suggest discovery; stop rather than fill the gap. Do not request approval while any blocker is `open` or `conflicted`.
5. Run `gyro check <slug> prd`. Show errors verbatim, fix the cause without adding product scope, and repeat until clean. Run `gyro status <slug> --json` to obtain the current revision and REQ diff.
6. Summarize the requirements by `blocker`, `major`, and `minor`, call out remaining nonblocking questions, and show the gate `prd`, next revision, and changes since the last approval. Ask a direct yes/no approval question. Wait for an explicit yes; silence and partial praise do not qualify. On yes run `gyro approve prd <slug> --quote "<the user's words>"`. If refused, show every line verbatim and fix the cause; ask again if content changes. Verify approval with `gyro status <slug> --json`.
7. Only once the PRD is approved, tell the user the next step is `/gyro-prototype <slug>` and stop. Do not invoke it.
