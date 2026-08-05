"""Export MortalityPM RDS (2018-2024, 6 criteria pollutants) for web choropleth."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pyreadr

ROOT = Path(__file__).resolve().parents[1]
RDS_PATH = Path(
    r"D:/OneDrive - SAIST Foundation/Research and Innovation/Research Project"
    r"/Environment, Climate Change and Health Hub/Air Pollution and Mortality"
    r"/MortalityPM_28082025.RDS"
)
BOUNDARIES_PATH = ROOT / "docs/data/district/boundaries.geojson"
OUT_DIR = ROOT / "docs/data/criteria"

POLLUTANTS = {
    "pm25": ("mean_PM25ug", "PM2.5", "µg/m³"),
    "pm10": ("mean_PM10ug", "PM10", "µg/m³"),
    "co": ("mean_CO_ugm3", "CO", "µg/m³"),
    "no2": ("mean_NO2_ugm3", "NO2", "µg/m³"),
    "so2": ("mean_SO2_ugm3", "SO2", "µg/m³"),
    "o3": ("mean_O3_ugm3", "O3", "µg/m³"),
}

DISTRICT_ALIASES = {
    "barishal": "barisal",
    "bogura": "bogra",
    "chattogram": "chittagong",
    "cumilla": "comilla",
    "jashore": "jessore",
    "moulvibazar": "maulvibazar",
    "netrokona": "netrakona",
    "brahmanbaria": "brahamanbaria",
    "chapainawabganj": "nawabganj",
    "cox's bazar": "cox's bazar",
    "coxs bazar": "cox's bazar",
}

DIVISION_ALIASES = {
    "chattogram": "chittagong",
    "barishal": "barisal",
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def build_district_lookup(boundaries: dict) -> dict[tuple[str, str], str]:
    lookup = {}
    for feat in boundaries["features"]:
        p = feat["properties"]
        div = norm(p["division"])
        dist = norm(p["district"])
        lookup[(div, dist)] = p["district_id"]
        lookup[(norm(DISTRICT_ALIASES.get(div, div)), dist)] = p["district_id"]
    return lookup


def map_district_id(row, lookup: dict[tuple[str, str], str]) -> str:
    div = norm(str(row["Division"]))
    dist = norm(str(row["District"]))
    dist = norm(DISTRICT_ALIASES.get(dist, dist))
    div = norm(DIVISION_ALIASES.get(div, div))
    key = (div, dist)
    if key in lookup:
        return lookup[key]
    # fallback: match district name only
    for (d_div, d_name), did in lookup.items():
        if d_name == dist:
            return did
    raise KeyError(f"No district_id for {row['District']} ({row['Division']})")


def main() -> None:
    df = pyreadr.read_r(str(RDS_PATH))[None]
    boundaries = json.loads(BOUNDARIES_PATH.read_text(encoding="utf-8"))
    lookup = build_district_lookup(boundaries)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    df = df.copy()
    df["district_id"] = df.apply(lambda r: map_district_id(r, lookup), axis=1)

    dates_exported: list[str] = []
    pollutant_stats: dict[str, dict] = {}

    for (year, month), sub in df.groupby(["year", "month"], sort=True):
        y, m = int(year), int(month)
        date_iso = f"{y:04d}-{m:02d}-01"
        values = []
        for _, row in sub.iterrows():
            item = {
                "district_id": row["district_id"],
                "district": row["District"],
                "division": row["Division"],
                "year": y,
                "month": m,
            }
            for pid, (col, _, _) in POLLUTANTS.items():
                val = row[col]
                item[pid] = None if val != val else float(val)
            values.append(item)

        out_path = OUT_DIR / f"values_{y:04d}_{m:02d}.json"
        out_path.write_text(
            json.dumps({"date": date_iso, "values": values}, separators=(",", ":")),
            encoding="utf-8",
        )
        dates_exported.append(date_iso)

        pm25 = [v["pm25"] for v in values if v["pm25"] is not None]
        pollutant_stats[date_iso] = {
            "min": round(min(pm25), 2),
            "mean": round(sum(pm25) / len(pm25), 2),
            "max": round(max(pm25), 2),
        }
        print(f"Wrote {out_path.name}")

    years = sorted(int(y) for y in df["year"].unique())
    manifest = {
        "title": "Bangladesh District Criteria Air Pollutants",
        "subtitle": "64 districts · monthly · 2018–2024 · MortalityPM model",
        "level": "district",
        "n_districts": int(df["district_id"].nunique()),
        "years": years,
        "dates": dates_exported,
        "default_date": dates_exported[0],
        "default_pollutant": "pm25",
        "pollutants": [
            {"id": pid, "label": meta[1], "unit": meta[2]}
            for pid, meta in POLLUTANTS.items()
        ],
        "pollutant_stats": pollutant_stats,
        "boundaries": "../district/boundaries.geojson",
        "data_pattern": "values_{year}_{month}.json",
        "source": "MortalityPM_28082025.RDS",
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done: {len(dates_exported)} months, {manifest['n_districts']} districts")


if __name__ == "__main__":
    main()
