#!/usr/bin/env python3
"""Lightweight structural validation for the azure-master skill package."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    skill = root / "SKILL.md"

    errors: list[str] = []

    required_dirs = ["agents", "references", "references/languages", "hooks", "scripts"]
    for directory in required_dirs:
        if not (root / directory).is_dir():
            errors.append(f"Missing directory: {directory}/")

    if not skill.is_file():
        errors.append("Missing SKILL.md")
    else:
        text = skill.read_text(encoding="utf-8")
        if not text.startswith("---\n"):
            errors.append("SKILL.md must start with YAML frontmatter")
        if not re.search(r"^name:\s*azure-master\s*$", text, re.MULTILINE):
            errors.append("SKILL.md name must be azure-master")
        if not re.search(r"^description:\s*.+$", text, re.MULTILINE):
            errors.append("SKILL.md is missing description")

        relative_refs = set(re.findall(r"`((?:references|agents|hooks|scripts)/[^`]+)`", text))
        for rel in sorted(relative_refs):
            target = root / rel
            if not target.exists():
                errors.append(f"SKILL.md references missing file: {rel}")

    expected_refs = {
        "references/sources.md",
        "references/fundamentals.md",
        "references/compute.md",
        "references/networking.md",
        "references/identity-security.md",
        "references/storage-data.md",
        "references/observability-troubleshooting.md",
        "references/governance-cost.md",
        "references/iac-devops.md",
        "references/languages/dotnet.md",
        "references/languages/javascript-typescript.md",
        "references/languages/python.md",
    }
    for rel in sorted(expected_refs):
        if not (root / rel).is_file():
            errors.append(f"Missing reference file: {rel}")

    forbidden = [
        root / "references" / "dotnet-iac-devops.md",
        root / "references" / "languages" / "java.md",
    ]
    for path in forbidden:
        if path.exists():
            errors.append(f"Deprecated/unwanted file still present: {path.relative_to(root)}")

    if errors:
        print("azure-master validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("azure-master validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
