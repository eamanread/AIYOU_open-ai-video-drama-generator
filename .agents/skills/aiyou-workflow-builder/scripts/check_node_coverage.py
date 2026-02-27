#!/usr/bin/env python3
"""Audit required workflow nodes against AIYOU project integration points.

Checks each required node type for:
1) NodeType enum declaration (types.ts)
2) Node service registration (services/nodes/registry.ts)
3) Validation rule existence (utils/nodeValidation.ts)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise SystemExit(f"[ERROR] File not found: {path}")


def extract_nodetype_enum_names(types_content: str) -> Set[str]:
    match = re.search(r"export\s+enum\s+NodeType\s*\{([\s\S]*?)\n\}", types_content)
    if not match:
        return set()

    block = match.group(1)
    names: Set[str] = set()
    for line in block.splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=", line)
        if m:
            names.add(m.group(1))
    return names


def extract_registered_nodes(registry_content: str) -> Set[str]:
    return set(re.findall(r"NodeServiceRegistry\.register\('([A-Z0-9_]+)'", registry_content))


def extract_validation_nodes(validation_content: str) -> Set[str]:
    return set(re.findall(r"\[NodeType\.([A-Z0-9_]+)\]\s*:", validation_content))


def parse_required(raw: str) -> List[str]:
    values = [v.strip().upper() for v in raw.split(",") if v.strip()]
    deduped: List[str] = []
    seen = set()
    for value in values:
        if value not in seen:
            deduped.append(value)
            seen.add(value)
    return deduped


def make_report(required: List[str], enum_names: Set[str], registered: Set[str], validated: Set[str]) -> Dict[str, object]:
    rows = []
    for node in required:
        in_enum = node in enum_names
        in_registry = node in registered
        in_validation = node in validated
        complete = in_enum and in_registry and in_validation
        rows.append(
            {
                "node": node,
                "in_node_type_enum": in_enum,
                "in_registry": in_registry,
                "in_validation_rules": in_validation,
                "complete": complete,
            }
        )

    missing = [r["node"] for r in rows if not r["complete"]]
    return {
        "required": required,
        "summary": {
            "total": len(required),
            "complete": len(required) - len(missing),
            "missing": len(missing),
            "all_complete": len(missing) == 0,
        },
        "rows": rows,
        "missing_nodes": missing,
    }


def print_human(report: Dict[str, object]) -> None:
    summary = report["summary"]
    rows = report["rows"]
    missing_nodes = report["missing_nodes"]

    print("[Node Coverage Audit]")
    print(
        f"- total: {summary['total']}  complete: {summary['complete']}  "
        f"missing: {summary['missing']}  all_complete: {summary['all_complete']}"
    )
    print("\nNODE | ENUM | REGISTRY | VALIDATION | COMPLETE")
    print("-----|------|----------|------------|---------")

    for row in rows:
        print(
            f"{row['node']} | "
            f"{'Y' if row['in_node_type_enum'] else 'N'} | "
            f"{'Y' if row['in_registry'] else 'N'} | "
            f"{'Y' if row['in_validation_rules'] else 'N'} | "
            f"{'Y' if row['complete'] else 'N'}"
        )

    if missing_nodes:
        print("\nMissing/Incomplete nodes:")
        for node in missing_nodes:
            print(f"- {node}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit required workflow nodes in AIYOU project")
    parser.add_argument("--project-root", default=".", help="Project root path")
    parser.add_argument("--required", required=True, help="Comma-separated required node type names")
    parser.add_argument("--json", action="store_true", help="Print report as JSON")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    required = parse_required(args.required)
    if not required:
        print("[ERROR] --required is empty")
        return 2

    types_path = project_root / "types.ts"
    registry_path = project_root / "services" / "nodes" / "registry.ts"
    validation_path = project_root / "utils" / "nodeValidation.ts"

    enum_names = extract_nodetype_enum_names(read_text(types_path))
    registered = extract_registered_nodes(read_text(registry_path))
    validated = extract_validation_nodes(read_text(validation_path))

    report = make_report(required, enum_names, registered, validated)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_human(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
