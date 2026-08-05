# Criteria Air Pollutants in Bangladesh

Interactive web maps of PM2.5 exposure in Bangladesh, developed by the SAIST Foundation.

## Live maps

- **District map (64 districts, monthly):** [district.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/district.html)
- **1 km grid map (preview):** [index.html](https://juwelrana19.github.io/Criteria-Air-Pollutants-in-Bangladesh/)

Data: SatPM V6GL03 (ACAG) area-weighted district means.

## Local preview

```bash
cd docs
python -m http.server 8080
```

Open http://localhost:8080/district.html

## Data pipeline

Extraction and export scripts live in the private [AP-Exposure-Surface-BD](https://github.com/JuwelRana19/AP-Exposure-Surface-BD) repository.
