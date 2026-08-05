"""Build division boundaries by dissolving district polygons (GADM)."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DISTRICT_DIR = ROOT / "docs" / "data" / "district"


def main() -> None:
    src = DISTRICT_DIR / "boundaries.geojson"
    out = DISTRICT_DIR / "divisions.geojson"
    data = json.loads(src.read_text(encoding="utf-8"))

    by_div: dict[str, list] = defaultdict(list)
    for feat in data["features"]:
        by_div[feat["properties"]["division"]].append(shape(feat["geometry"]))

    features = []
    for div in sorted(by_div):
        merged = unary_union(by_div[div])
        features.append(
            {
                "type": "Feature",
                "properties": {"division": div},
                "geometry": mapping(merged),
            }
        )

    out.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}),
        encoding="utf-8",
    )
    print(f"Wrote {out} ({len(features)} divisions)")


if __name__ == "__main__":
    main()
