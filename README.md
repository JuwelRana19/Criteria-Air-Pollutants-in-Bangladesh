# Six Criteria Air Pollutants Across Bangladesh

Interactive web map of six criteria air pollutant exposure by district in Bangladesh, based on exposure surface data products developed by SAIST Foundation.

## Live map

**District map (64 districts, monthly, 2018–2024):** [district.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/district.html)

**Team members:** [team.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/team.html)

## Data access

For inquiries regarding dataset access or potential collaboration, please contact **juwelrana@saistbd.org**.

## Local preview

```bash
# After exporting JSON locally, bundle for the map:
python scripts/bundle_web_data.py

cd docs
python -m http.server 8080
```

## Data pipeline

Export flow:

1. `export_criteria_web.py` → writes JSON to `docs/data/criteria/` (local, gitignored)
2. `bundle_web_data.py` → bundles JSON into `docs/assets/district-data.js` for GitHub Pages

© Juwel Rana · SAIST Foundation
