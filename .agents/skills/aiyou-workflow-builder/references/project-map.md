# AIYOU Project Map (for Workflow Builder Skill)

Use this map to avoid blind exploration and to keep edits consistent with current architecture.

## Core Workflow Files
- `types.ts`
: NodeType, Connection, workflow-related contracts.
- `services/pipelineEngine.ts`
: DAG execution engine (layers, pause/resume, failure handling).
- `services/workflowTemplates.ts`
: Built-in workflow templates.
- `services/workflowSolidifier.ts`
: Workflow snapshot/instantiate logic.

## Node System
- `services/nodes/registry.ts`
: Node service registration and exports.
- `services/nodes/*.service.ts`
: Node implementations.
- `utils/nodeValidation.ts`
: Connection compatibility and execution precheck rules.
- `services/connectionValidator.ts`
: Port-level compatibility checks.

## Tests
- `tests/*.test.ts`
: Pipeline/system-level tests.
- `utils/nodeValidation.test.ts`
: Validation rule tests.
- `utils/nodeHelpers.test.ts`
: Node helper tests.
- `vitest.config.ts`
: Test config.

## Typical Verification Commands
```bash
npm test
```

```bash
npm run build
```

## Node Coverage Audit Script
```bash
python3 .agents/skills/aiyou-workflow-builder/scripts/check_node_coverage.py \
  --project-root . \
  --required SCRIPT_PARSER,STYLE_PRESET,CHARACTER_NODE
```
