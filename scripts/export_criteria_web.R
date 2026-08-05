# Export district criteria pollutant RDS (2018-2024) for web map

suppressPackageStartupMessages({
  library(jsonlite)
})

rds_path <- Sys.getenv(
  "CRITERIA_POLLUTANTS_RDS",
  unset = "D:/OneDrive - SAIST Foundation/Research and Innovation/Research Project/Environment, Climate Change and Health Hub/Air Pollution and Mortality/MortalityPM_28082025.RDS"
)
out_dir <- "docs/data/criteria"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

df <- readRDS(rds_path)

pollutants <- list(
  pm25 = list(col = "mean_PM25ug", label = "PM2.5", unit = "µg/m³"),
  pm10 = list(col = "mean_PM10ug", label = "PM10", unit = "µg/m³"),
  co   = list(col = "mean_CO_ugm3", label = "CO", unit = "µg/m³"),
  no2  = list(col = "mean_NO2_ugm3", label = "NO2", unit = "µg/m³"),
  so2  = list(col = "mean_SO2_ugm3", label = "SO2", unit = "µg/m³"),
  o3   = list(col = "mean_O3_ugm3", label = "O3", unit = "µg/m³")
)

slugify <- function(x) {
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("^_|_$", "", x)
}

df$district_id <- paste(slugify(df$Division), slugify(df$District), sep = "_")
df$district_id <- gsub("chittagong", "chittagong", df$district_id)
df$district_id <- gsub("cox_s_bazar", "cox_s_bazar", df$district_id)
df$district_id <- gsub("brahmanbaria", "brahamanbaria", df$district_id)

dates_exported <- character()
stats <- list()

combos <- unique(df[, c("year", "month")])
combos <- combos[order(combos$year, combos$month), , drop = FALSE]

for (i in seq_len(nrow(combos))) {
  y <- combos$year[[i]]
  m <- combos$month[[i]]
  sub <- df[df$year == y & df$month == m, , drop = FALSE]
  date_iso <- sprintf("%04d-%02d-01", y, m)

  values <- lapply(seq_len(nrow(sub)), function(j) {
    row <- sub[j, , drop = FALSE]
    vals <- list(
      district_id = row$district_id[[1]],
      district = row$District[[1]],
      division = row$Division[[1]],
      year = y,
      month = m
    )
    for (p in names(pollutants)) {
      col <- pollutants[[p]]$col
      vals[[p]] <- as.numeric(row[[col]][[1]])
    }
    vals
  })

  dest <- file.path(out_dir, sprintf("values_%04d_%02d.json", y, m))
  write_json(list(date = date_iso, values = values), dest, auto_unbox = TRUE, pretty = FALSE)
  dates_exported <- c(dates_exported, date_iso)

  pm25_vals <- vapply(values, function(v) v$pm25, numeric(1))
  pm25_vals <- pm25_vals[is.finite(pm25_vals)]
  stats[[date_iso]] <- list(
    min = round(min(pm25_vals), 2),
    mean = round(mean(pm25_vals), 2),
    max = round(max(pm25_vals), 2)
  )
  message("Wrote ", dest)
}

pollutant_meta <- lapply(names(pollutants), function(id) {
  list(
    id = id,
    label = pollutants[[id]]$label,
    unit = pollutants[[id]]$unit
  )
})
names(pollutant_meta) <- NULL

manifest <- list(
  title = "Bangladesh District Criteria Air Pollutants",
  subtitle = "64 districts · monthly · 2018–2024 · SAIST Foundation",
  level = "district",
  n_districts = length(unique(df$district_id)),
  years = sort(unique(df$year)),
  dates = dates_exported,
  default_date = dates_exported[[1]],
  default_pollutant = "pm25",
  pollutants = pollutant_meta,
  pollutant_stats = stats,
  boundaries = "../district/boundaries.geojson",
  data_pattern = "values_{year}_{month}.json",
  source = "SAIST Foundation"
)

write_json(manifest, file.path(out_dir, "manifest.json"), auto_unbox = TRUE, pretty = TRUE)
message("Done. ", length(dates_exported), " months exported to ", out_dir)
