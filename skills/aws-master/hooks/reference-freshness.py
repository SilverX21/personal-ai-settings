#!/usr/bin/env python3
"""Warn when aws-master references have not been reviewed recently."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

DATE_RE = re.compile(r"^last_reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$", re.MULTILINE)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-days", type=int, default=45)
    parser.add_argument("--as-of", default=date.today().isoformat())
    args = parser.parse_args()

    as_of = datetime.strptime(args.as_of, "%Y-%m-%d").date()
    root = Path(__file__).resolve().parents[1]
    refs = sorted((root / "references").rglob("*.md"))

    checked = 0
    stale: list[str] = []
    missing: list[str] = []

    for path in refs:
        if path.name == "README.md":
            continue
        text = path.read_text(encoding="utf-8")
        match = DATE_RE.search(text)
        if not match:
            missing.append(str(path.relative_to(root)))
            continue
        reviewed = datetime.strptime(match.group(1), "%Y-%m-%d").date()
        age = (as_of - reviewed).days
        checked += 1
        if age > args.max_age_days:
            stale.append(f"{path.relative_to(root)}: {age} days old ({reviewed})")

    if missing or stale:
        print("Reference freshness warnings:")
        for item in missing:
            print(f"- Missing last_reviewed: {item}")
        for item in stale:
            print(f"- Stale: {item}")
        return 1

    print(f"Reference freshness OK: {checked} files checked as of {as_of}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
