---
name: aiyou-workflow-builder
description: Build or evolve AIYOU workflow pipelines from user goals. Use when users ask to define requirements first, compare 3 workflow方案, audit missing nodes, implement node gaps, auto-build workflow templates, run tests + code review, and decide merge/release.
---

# AIYOU Workflow Builder

## Overview
Execute a strict closed loop for AIYOU workflow delivery:
1) confirm requirements completely, 2) design with expert-level architecture thinking, 3) present 3 candidate workflows, 4) audit node completeness, 5) build missing nodes if needed, 6) construct workflow, 7) auto-test and code-review, 8) ask whether to merge/release.

## Hard Gates
- Start with requirement interview. Do not design or code before requirements are 100% confirmed.
- Ask one question at a time until all required fields are locked.
- After requirements lock, provide exactly 3 workflow方案 for user selection.
- After user picks a workflow, run node coverage audit before implementation.
- If nodes are missing, provide exactly 3 node-construction方案 and wait for user selection.
- After construction, run verification commands and code review before claiming success.
- End with: `是否现在提交、合并并上线？`

## Phase 1: Requirement Lock (Must Reach 100%)
Collect and confirm all items below:
- Business goal and success metric
- Input/source data and constraints
- Output artifacts and quality bar
- Runtime mode (`one_click` / `step_by_step` / hybrid)
- Non-functional constraints (latency/cost/reliability/compliance)
- Acceptance tests and rollout scope

Use this confirmation sentence before moving forward:
- `请确认：以上需求是否 100% 准确（是/否）？`

If user says no, continue Q&A and do not proceed.

## Phase 2: Expert-Council Reasoning
After requirement lock, reason as if a top cross-functional team is reviewing the architecture:
- Product lead: user value, flow simplicity, adoption friction
- Workflow architect: DAG shape, parallelism, failure recovery, wait points
- Node engineer: schema contracts, service boundaries, registry/validation fit
- Prompt/AI specialist: generation quality, guardrails, fallback strategy
- QA/SRE: observability, testability, rollback safety

Base all designs on current project architecture and file reality.

## Phase 3: Present 3 Workflow Options
Output exactly 3 options (A/B/C). Each option must include:
- Scenario fit
- Node chain (ordered)
- Reuse vs new-node ratio
- Complexity / delivery speed
- Risks and mitigation
- Test strategy

Then ask user to choose one option (`A`/`B`/`C`).

## Phase 4: Node Coverage Audit
After option selection, derive required node types and audit them.

Use:
```bash
python3 .agents/skills/aiyou-workflow-builder/scripts/check_node_coverage.py \
  --project-root <repo-root> \
  --required NODE_A,NODE_B,NODE_C
```

The audit checks:
- NodeType enum presence (`types.ts`)
- registry registration (`services/nodes/registry.ts`)
- dependency/validation rules (`utils/nodeValidation.ts`)

Decision:
- If all required nodes are complete: go to Phase 6.
- If any node is missing/incomplete: go to Phase 5.

## Phase 5: Missing Node Construction (3 Choices)
When gaps exist, provide exactly 3 build strategies and ask user to choose one:
- Option 1 (Fast Patch): implement minimal node + schema + registry for rapid delivery
- Option 2 (Balanced): full node service + validation + tests + docs update
- Option 3 (Robust Platform): reusable abstractions + stronger contracts + migration safety

After user selects:
- Implement missing `NodeType` entries when absent
- Add/extend node service in `services/nodes/*.service.ts`
- Register service in `services/nodes/registry.ts`
- Add/extend rules in `utils/nodeValidation.ts`
- Add/update tests in `utils/*.test.ts` and `tests/*.test.ts`

## Phase 6: Workflow Construction
Create or update workflow definitions using selected option:
- `services/workflowTemplates.ts` for templates
- `services/workflowSolidifier.ts` when snapshot/instantiate logic is involved
- `docs/data-contracts.md` if new data contracts or ports are introduced

Ensure workflow is executable under selected mode.

## Phase 7: Auto Verification + Code Review
Run verification before claiming completion:
```bash
npm test
```
If relevant to changed surface, also run:
```bash
npm run build
```

Then perform code review with findings-first output:
- Blocking: correctness/security/regression risks
- Important: maintainability/performance gaps
- Nit/Suggestion: optional improvements
- If no findings, state that explicitly

## Phase 8: Final Delivery Prompt
Provide:
- Chosen workflow and implemented node changes
- Verification evidence (commands + pass/fail)
- Code-review conclusion

End with exactly:
- `是否现在提交、合并并上线？`

## Project References
Read only as needed:
- [project-map](references/project-map.md)

## Resources
- `scripts/check_node_coverage.py`: required-node completeness audit
