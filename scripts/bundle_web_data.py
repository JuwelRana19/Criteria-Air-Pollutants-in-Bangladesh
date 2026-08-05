"""Bundle local criteria JSON into annual district-data.js for GitHub Pages."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = DOCS / "assets"
POLLUTANTS = ("pm25", "pm10", "co", "no2", "so2", "o3")


def compact_json(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def aggregate_annual(months: dict[str, dict]) -> dict[str, dict]:
    accum: dict[int, dict[str, dict[str, list[float]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    meta: dict[tuple[int, str], dict] = {}

    for payload in months.values():
        for row in payload.get("values", []):
            year = int(row["year"])
            did = row["district_id"]
            meta[(year, did)] = {
                "district_id": did,
                "district": row["district"],
                "division": row["division"],
                "year": year,
            }
            for pid in POLLUTANTS:
                val = row.get(pid)
                if val is None:
                    continue
                try:
                    val = float(val)
                except (TypeError, ValueError):
                    continue
                if val == val:
                    accum[year][did][pid].append(val)

    years: dict[str, dict] = {}
    for year in sorted(accum):
        values = []
        for did in sorted(accum[year]):
            item = dict(meta[(year, did)])
            for pid in POLLUTANTS:
                nums = accum[year][did][pid]
                item[pid] = round(sum(nums) / len(nums), 2) if nums else None
            values.append(item)
        years[str(year)] = {"year": year, "values": values}
    return years


def load_months_from_criteria(criteria_dir: Path) -> dict[str, dict]:
    months: dict[str, dict] = {}
    for path in sorted(criteria_dir.glob("values_*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        months[payload["date"]] = payload
    return months


def load_months_from_bundle() -> dict[str, dict]:
    bundled = ASSETS / "district-data.js"
    text = bundled.read_text(encoding="utf-8")
    match = re.search(r"window\.__DISTRICT_MAP_BUNDLE__=(.+);\s*$", text, re.S)
    if not match:
        raise FileNotFoundError("Could not parse existing district-data.js")
    bundle = json.loads(match.group(1))
    if bundle.get("years") and not bundle.get("months"):
        raise RuntimeError("district-data.js is already annual-only")
    months = bundle.get("months") or {}
    if not months:
        raise FileNotFoundError("No monthly data found to aggregate")
    return months


def build_manifest(source_manifest: dict, years: dict[str, dict]) -> dict:
    year_list = sorted(int(y) for y in years)
    pollutants = source_manifest.get(
        "pollutants",
        [
            {"id": "pm25", "label": "PM2.5", "unit": "µg/m³"},
            {"id": "pm10", "label": "PM10", "unit": "µg/m³"},
            {"id": "co", "label": "CO", "unit": "µg/m³"},
            {"id": "no2", "label": "NO2", "unit": "µg/m³"},
            {"id": "so2", "label": "SO2", "unit": "µg/m³"},
            {"id": "o3", "label": "O3", "unit": "µg/m³"},
        ],
    )

    stats: dict[str, dict] = {}
    for y, payload in years.items():
        pm25 = [
            row["pm25"]
            for row in payload["values"]
            if row.get("pm25") is not None
        ]
        if pm25:
            stats[y] = {
                "min": round(min(pm25), 2),
                "mean": round(sum(pm25) / len(pm25), 2),
                "max": round(max(pm25), 2),
            }

    return {
        "title": source_manifest.get(
            "title", "Bangladesh District Criteria Air Pollutants"
        ),
        "subtitle": "64 districts · annual average · 2018–2024 · SAIST Foundation",
        "temporal": "annual",
        "level": "district",
        "n_districts": source_manifest.get("n_districts", 64),
        "years": year_list,
        "default_year": year_list[0] if year_list else None,
        "default_pollutant": source_manifest.get("default_pollutant", "pm25"),
        "pollutants": pollutants,
        "year_stats": stats,
        "source": source_manifest.get("source", "SAIST Foundation"),
    }


def bundle_district() -> None:
    criteria_dir = DOCS / "data" / "criteria"
    manifest_path = criteria_dir / "manifest.json"

    if manifest_path.is_file() and any(criteria_dir.glob("values_*.json")):
        source_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        months = load_months_from_criteria(criteria_dir)
    else:
        months = load_months_from_bundle()
        bundled = ASSETS / "district-data.js"
        text = bundled.read_text(encoding="utf-8")
        match = re.search(r"window\.__DISTRICT_MAP_BUNDLE__=(.+);\s*$", text, re.S)
        source_manifest = json.loads(match.group(1)).get("manifest", {})

    years = aggregate_annual(months)
    manifest = build_manifest(source_manifest, years)
    bundle = {"manifest": manifest, "years": years}

    out = ASSETS / "district-data.js"
    out.write_text(
        "/* Generated by scripts/bundle_web_data.py — annual averages only */\n"
        f"window.__DISTRICT_MAP_BUNDLE__={compact_json(bundle)};\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {out.name} ({len(years)} years, "
        f"{out.stat().st_size // 1024} KB, annual only)"
    )


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    bundle_district()


if __name__ == "__main__":
    main()
