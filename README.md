# Dende

An open-source land mapping, coordinate conversion, and boundary verification protocol. Dende solves the opacity in buying real estate across emerging markets (starting with Nigeria) by converting physical, paper-based survey plans into interactive geographic maps and verifying boundary integrity.

---

## 1. The Problem

For diaspora buyers looking to purchase land in countries like Nigeria, verifying the location and legitimacy of a plot is incredibly difficult:
*   **Opaque Survey Plans:** Physical survey plans contain coordinates written in local projection formats (e.g. **Eastings** and **Northings** using the local **Minna Datum** or UTM Zone 31N/32N) rather than standard GPS coordinates (Latitude/Longitude). They cannot be plugged into standard mapping software like Google Maps.
*   **Government Registry Access:** Accessing official Geographic Information Systems (GIS) at local land ministries is slow, expensive, and non-digitized.
*   **Double Allocation & Overlaps:** Fraudulent sellers often sell overlapping plots or land inside government-reserved areas (forest reserves, road expansions) because buyers have no easy way to cross-reference coordinates.

---

## 2. Core Architecture

Dende is designed as a modular toolset consisting of three major pillars:

```
[Paper Survey Scan] ──> [1. OCR/AI Parser] ──> [2. Projection Engine] ──> [3. Spatial Registry]
                              (Extraction)         (Minna ➔ WGS84)             (Overlap & Maps)
```

### 2.1 Dende Projection Engine
*   **Local to Global Coordinate Translation:** Conversions between local ellipsoids (Minna Datum, Clarke 1880) and global coordinates (WGS84, EPSG:4326).
*   **Projections Handled:** 
    *   **Nigeria West Belt:** Minna / Nigeria West (EPSG:26391)
    *   **Nigeria Mid Belt:** Minna / Nigeria Mid (EPSG:26392)
    *   **Nigeria East Belt:** Minna / Nigeria East (EPSG:26393)
    *   **UTM Zones:** Minna / UTM Zone 31N (EPSG:26331) and Zone 32N (EPSG:26332)
*   **Output:** Generates standard GeoJSON geometry representing the bounding polygon of the plot.

### 2.2 Dende Parser (OCR & Vision)
*   **Auto-extraction:** A pipeline where users upload photos/scans of survey plans.
*   **Tabular Data Parsing:** Automatically identifies the beacon coordinate table (Beacon ID, Easting, Northing, Distance, Bearing) and extracts it into structured JSON.
*   **Correction Layer:** Flags OCR confidence levels on faded stamp lines to prevent coordinate translation errors.

### 2.3 Dende Spatial Registry
*   **Overlap Intersection Checks:** Uses spatial database checks (e.g., PostgreSQL/PostGIS `ST_Intersects`) to verify if a newly uploaded plot overlaps with an already registered layout.
*   **Zoning Hazard Alerts:** Overlays plots on open-source vector maps of local master plans (e.g., road corridors, agricultural reserves) to flag potential encroachment issues.

---

## 3. Technology Stack & Directory Structure

To ensure portability and ease of local deployment, the system is split into three layers:

```
dende/
├── core/             # Coordinate conversion logic (TypeScript/Python)
├── web/              # React/Vite mapping client (Leaflet/Mapbox)
└── server/           # Spatial registry database & API
```

*   **Projection Engine:** TypeScript / JavaScript wrapping `proj4js` formulas for real-time in-browser conversions.
*   **Mapping Client:** React + Leaflet / Mapbox GL JS to display plot overlays on satellite layers.
*   **Data Format:** GeoJSON (RFC 7946) as the standard exchange format for boundaries.

---

## 4. Technical Roadmap

*   [ ] **Phase 1: Conversion Engine:** Build the mathematical projection library to translate local Minna Eastings/Northings to WGS84 GPS coordinates.
*   [ ] **Phase 2: Document Parser:** Integrate lightweight OCR/Vision parser to allow scanning of survey plans directly from phone cameras.
*   [ ] **Phase 3: Interactive Maps & Registry:** Build the frontend visualization canvas and the backend API to query plot overlaps and zoning violations.
