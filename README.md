# Six Criteria Air Pollutants Across Bangladesh

Interactive web maps of six criteria air pollutant exposure in Bangladesh, developed by the SAIST Foundation.

## Live maps

- **District map (64 districts, monthly):** [district.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/district.html)
- **1 km grid map (preview):** [index.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/)

## Data access

The maps are for **visual exploration only**. Downloadable datasets (CSV/RDS/GeoJSON exports) are **not** published in this repository.

To request the underlying data, contact **juwelrana@saistbd.org**.

## Local preview

```bash
# After exporting JSON locally, bundle for the map:
python scripts/bundle_web_data.py

cd docs
python -m http.server 8080
```

Open http://localhost:8080/district.html

## Data pipeline

Extraction and export scripts live in the private [AP-Exposure-Surface-BD](https://github.com/JuwelRana19/AP-Exposure-Surface-BD) repository.

Export flow:

1. `export_criteria_web.py` → writes JSON to `docs/data/criteria/` (local, gitignored)
2. `bundle_web_data.py` → bundles JSON into `docs/assets/*-data.js` for GitHub Pages

© Juwel Rana · SAIST Foundation
