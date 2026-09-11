#!/usr/bin/env python3
"""Structural validator for the terraform-master Agent Skill."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "SKILL.md",
    "README.md",
    "agents/terraform-fundamentals-mentor.md",
    "agents/terraform-developer.md",
    "agents/terraform-architect.md",
    "agents/terraform-module-reviewer.md",
    "agents/terraform-ops-troubleshooter.md",
    "agents/terraform-security-reviewer.md",
    "references/README.md",
    "references/sources.md",
    "references/fundamentals.md",
    "references/style-conventions.md",
    "references/configuration-language.md",
    "references/providers-versions.md",
    "references/modules.md",
    "references/state-backends.md",
    "references/testing-validation.md",
    "references/security-secrets.md",
    "references/workflows-cicd.md",
    "references/refactoring-migrations.md",
    "references/providers/aws.md",
    "references/providers/azure.md",
    "hooks/README.md",
    "hooks/pre-task.md",
    "hooks/post-task.md",
    "hooks/reference-freshness.py",
    "hooks/manifest.example.yaml",
    "scripts/validate_skill.py",
]

FRESHNESS_RE = re.compile(r"(?m)^last_reviewed:\s*\d{4}-\d{2}-\d{2}\s*$")
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def check_required(errors: list[str]) -> None:
    for rel in REQUIRED_FILES:
        if not (ROOT / rel).is_file():
            fail(errors, f"missing required file: {rel}")


def check_reference_freshness_metadata(errors: list[str]) -> None:
    for path in sorted((ROOT / "references").rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        if not FRESHNESS_RE.search(text):
            fail(errors, f"missing/invalid last_reviewed metadata: {path.relative_to(ROOT)}")


def check_no_gcp_reference(errors: list[str]) -> None:
    providers = ROOT / "references/providers"
    for name in ("gcp.md", "google.md", "google-cloud.md"):
        if (providers / name).exists():
            fail(errors, f"unnecessary GCP provider reference introduced: references/providers/{name}")


def check_internal_links(errors: list[str]) -> None:
    for path in sorted(ROOT.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK_RE.findall(text):
            target = raw_target.strip().split("#", 1)[0]
            if not target or target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            if target.startswith("<") and target.endswith(">"):
                target = target[1:-1]
            candidate = (path.parent / target).resolve()
            try:
                candidate.relative_to(ROOT.resolve())
            except ValueError:
                fail(errors, f"link escapes skill root in {path.relative_to(ROOT)}: {raw_target}")
                continue
            if not candidate.exists():
                fail(errors, f"broken internal link in {path.relative_to(ROOT)}: {raw_target}")


def check_skill_routing(errors: list[str]) -> None:
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    required_tokens = [
        "references/fundamentals.md",
        "references/state-backends.md",
        "references/testing-validation.md",
        "references/security-secrets.md",
        "references/providers/aws.md",
        "references/providers/azure.md",
        "hooks/pre-task.md",
        "hooks/post-task.md",
    ]
    for token in required_tokens:
        if token not in text:
            fail(errors, f"SKILL.md does not route to required layer: {token}")


def check_core_provider_agnostic(errors: list[str]) -> None:
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    # Provider names are allowed for routing, but provider-specific resource/data
    # addresses in the core orchestrator would indicate knowledge leakage.
    forbidden_patterns = {
        r"\baws_[a-z0-9_]+\b": "AWS resource/data address",
        r"\bazurerm_[a-z0-9_]+\b": "AzureRM resource/data address",
        r"\bazapi_[a-z0-9_]+\b": "AzAPI resource/data address",
    }
    for pattern, label in forbidden_patterns.items():
        if re.search(pattern, text, flags=re.IGNORECASE):
            fail(errors, f"SKILL.md is not provider agnostic; contains {label}")


def check_skill_identity(errors: list[str]) -> None:
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    if "name: terraform-master" not in text:
        fail(errors, "SKILL.md front matter does not declare name: terraform-master")
    if "progressive disclosure" not in text.lower():
        fail(errors, "SKILL.md does not state progressive disclosure")


def main() -> int:
    errors: list[str] = []
    check_required(errors)
    if not (ROOT / "SKILL.md").exists():
        print("FAIL: SKILL.md missing")
        return 1

    check_reference_freshness_metadata(errors)
    check_no_gcp_reference(errors)
    check_internal_links(errors)
    check_skill_routing(errors)
    check_core_provider_agnostic(errors)
    check_skill_identity(errors)

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"  - {error}")
        return 1

    ref_count = len(list((ROOT / "references").rglob("*.md")))
    agent_count = len(list((ROOT / "agents").glob("*.md")))
    print("Validation passed.")
    print(f"  root: {ROOT}")
    print(f"  agents: {agent_count}")
    print(f"  references: {ref_count}")
    print("  required hooks: present")
    print("  internal Markdown links: resolved")
    print("  provider-agnostic core guard: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
