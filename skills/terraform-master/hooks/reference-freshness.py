#!/usr/bin/env python3
"""Report freshness of terraform-master reference markdown files."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

DATE_RE = re.compile(r"(?m)^last_reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$")


@dataclass(frozen=True)
class Result:
    path: Path
    status: str
    reviewed: date | None
    age_days: int | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--threshold-days",
        type=int,
        default=45,
        help="Age in days after which a reference is reported stale (default: 45).",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Skill root directory (default: inferred from script location).",
    )
    return parser.parse_args()


def inspect(path: Path, today: date, threshold: int) -> Result:
    text = path.read_text(encoding="utf-8")
    match = DATE_RE.search(text)
    if not match:
        return Result(path, "MISSING", None, None)

    try:
        reviewed = datetime.strptime(match.group(1), "%Y-%m-%d").date()
    except ValueError:
        return Result(path, "INVALID", None, None)

    age = (today - reviewed).days
    if age < 0:
        return Result(path, "FUTURE", reviewed, age)
    return Result(path, "STALE" if age > threshold else "FRESH", reviewed, age)


def main() -> int:
    args = parse_args()
    if args.threshold_days < 0:
        print("ERROR: --threshold-days must be >= 0", file=sys.stderr)
        return 2

    references = args.root / "references"
    paths = sorted(references.rglob("*.md"))
    if not paths:
        print(f"ERROR: no references found under {references}", file=sys.stderr)
        return 2

    results = [inspect(path, date.today(), args.threshold_days) for path in paths]

    for result in results:
        rel = result.path.relative_to(args.root)
        if result.reviewed is None:
            print(f"[{result.status:7}] {rel}")
        else:
            print(
                f"[{result.status:7}] {rel} "
                f"last_reviewed={result.reviewed.isoformat()} age={result.age_days}d"
            )

    counts = {status: sum(r.status == status for r in results) for status in ["FRESH", "STALE", "MISSING", "INVALID", "FUTURE"]}
    print("\nSummary: " + ", ".join(f"{k.lower()}={v}" for k, v in counts.items()))

    # Stale content is a warning signal, not a structural failure. Missing/invalid/future
    # metadata is a package integrity failure.
    return 1 if counts["MISSING"] or counts["INVALID"] or counts["FUTURE"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
