#!/usr/bin/env python3
"""Flag Azure reference files whose last_reviewed metadata is stale."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

DATE_RE = re.compile(r"^last_reviewed:\s*[\"']?(\d{4}-\d{2}-\d{2})[\"']?\s*$", re.MULTILINE)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-days", type=int, default=45)
    parser.add_argument("--as-of", help="Override current date (YYYY-MM-DD) for deterministic checks")
    args = parser.parse_args()

    skill_root = Path(__file__).resolve().parents[1]
    refs = skill_root / "references"
    as_of = dt.date.fromisoformat(args.as_of) if args.as_of else dt.date.today()

    failures: list[str] = []
    checked = 0

    for path in sorted(refs.rglob("*.md")):
        if path.name == "README.md":
            continue
        checked += 1
        text = path.read_text(encoding="utf-8")
        match = DATE_RE.search(text)
        if not match:
            failures.append(f"{path.relative_to(refs)}: missing last_reviewed metadata")
            continue
        reviewed = dt.date.fromisoformat(match.group(1))
        age = (as_of - reviewed).days
        if age < 0:
            failures.append(f"{path.relative_to(refs)}: last_reviewed is in the future ({reviewed})")
        elif age > args.max_age_days:
            failures.append(f"{path.relative_to(refs)}: stale ({age} days; reviewed {reviewed})")

    if failures:
        print("Reference freshness check failed:")
        for failure in failures:
            print(f"- {failure}")
        print("Revalidate stale files against official Microsoft documentation.")
        return 1

    print(f"Reference freshness OK: {checked} files checked as of {as_of}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
