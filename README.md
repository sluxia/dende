# Dende

The future discovery and AI-extraction service connects through the secured
[Intelligence Worker API](./docs/INTELLIGENCE_WORKER_API.md).

An open-source land mapping, coordinate conversion, and boundary verification protocol. Dende solves the opacity in buying real estate across emerging markets (starting with Nigeria) by converting physical, paper-based survey plans into interactive geographic maps and verifying boundary integrity.

---

## 1. The Problem

For diaspora buyers looking to purchase land in countries like Nigeria, verifying the location and legitimacy of a plot is incredibly difficult:
*   **Opaque Survey Plans:** Physical survey plans contain coordinates written in local projection formats (e.g. **Eastings** and **Northings** using the local **Minna Datum** or UTM Zone 31N/32N) rather than standard GPS coordinates (Latitude/Longitude). They cannot be plugged into standard mapping software like Google Maps.
*   **Government Registry Access:** Accessing official Geographic Information Systems (GIS) at local land ministries is slow, expensive, and non-digitized.
*   **Double Allocation & Overlaps:** Fraudulent sellers often sell overlapping plots or land inside government-reserved areas (forest reserves, road expansions) because buyers have no easy way to cross-reference coordinates.

---

## 2. Core Architecture

Dende currently operates as a TypeScript core library plus a Fastify/PostGIS
registry and server-rendered Leaflet interface:

```
[Survey scan or coordinates] -> [OCR/AI Parser] -> [Projection Engine] -> [PostGIS Registry]
                                                        |                       |
                                                        +-> WGS84 GeoJSON       +-> overlaps
                                                                                +-> roads/reserves
                                                                                +-> violation cases
```

### 2.1 Dende Projection Engine
*   **Local to Global Coordinate Translation:** Conversions between local ellipsoids (Minna Datum, Clarke 1880) and global coordinates (WGS84, EPSG:4326).
*   **Projections Handled:** 
    *   **Nigeria West Belt:** Minna / Nigeria West (EPSG:26391)
    *   **Nigeria Mid Belt:** Minna / Nigeria Mid (EPSG:26392)
    *   **Nigeria East Belt:** Minna / Nigeria East (EPSG:26393)
    *   **UTM Zones:** Minna / UTM Zone 31N (EPSG:26331) and Zone 32N (EPSG:26332), plus WGS 84 / UTM Zones 31N and 32N (EPSG:32631 and EPSG:32632)
*   **Output:** Generates standard GeoJSON geometry representing the bounding polygon of the plot.

### 2.2 Dende Parser (OCR & Vision)
*   **Auto-extraction:** A pipeline where users upload photos/scans of survey plans.
*   **Tabular Data Parsing:** Automatically identifies the beacon coordinate table (Beacon ID, Easting, Northing, Distance, Bearing) and extracts it into structured JSON.
*   **Multiple Providers:** Supports Gemini, Groq, and Mistral vision extraction, with local Tesseract OCR as a fallback.
*   **Geometry Checks:** Compares computed and printed areas, traverse closure, minimum vertices, and self-intersection before accepting a reading.
*   **Image Preparation:** Uses Sharp to improve difficult scans before extraction.

### 2.3 Dende Spatial Registry
*   **Overlap Intersection Checks:** Uses PostgreSQL/PostGIS to verify whether a submission intersects an existing plot and reports shared area and percentage.
*   **Zoning Hazard Alerts:** Overlays plots on open-source vector maps of local master plans (e.g., road corridors, agricultural reserves) to flag potential encroachment issues.
*   **Violation Cases:** Stores findings as persistent cases with severity, status, notes, rechecks, resolution, and an immutable event history.
*   **Manual Checks:** Accepts WGS84, UTM, and Nigerian projected boundary coordinates, with check-only or check-and-register modes.
*   **Interactive Maps:** Provides a combined registry map, plot detail maps, source-zone overlays, beacon references, and full-card links to violation histories.

### 2.4 Current User Interface

The current UI is intentionally lightweight and server-rendered rather than a
separate React application. It includes:

*   A registry map showing every recorded plot and its findings.
*   Survey-plan upload and parsing.
*   Manual coordinate entry, bulk paste, CRS selection, and live map preview.
*   Streets and satellite base layers.
*   Plot-specific overlap and zoning visualizations.
*   Violation timelines and status/note management.
*   Shared navigation across registry, checker, plot, and violation pages.

---

## 3. Technology Stack & Directory Structure

```
dende/
├── src/                  # Projection, parsing, OCR, image, traverse, and map library
├── server/
│   ├── src/              # Fastify API and server-rendered interfaces
│   ├── migrations/       # PostGIS registry, zones, and violations schema
│   ├── scripts/          # Migrations and zone import tools
│   └── test/             # Spatial, registration, and violation tests
├── docker-compose.yml    # Local PostGIS service
└── README.md
```

*   **Projection Engine:** TypeScript and Proj4.
*   **Document Extraction:** Gemini, Groq, Mistral, Tesseract.js, and Sharp.
*   **API:** Fastify.
*   **Spatial Database:** PostgreSQL 16 and PostGIS 3.4.
*   **Mapping Interface:** Server-rendered HTML with Leaflet and Proj4.js.
*   **Data Format:** GeoJSON (RFC 7946) as the standard exchange format for boundaries.

---

## 4. Roadmap

The canonical product and infrastructure roadmap is maintained in
[ROADMAP.md](./ROADMAP.md). The immediate priority is transparent check
evidence: every result should identify the exact datasets and imports consulted,
their authority and freshness, and whether coverage is complete, partial,
stale, unavailable, or test-only.

## 5. Current Development Constraint

Dende does **not currently provide user accounts or authentication**. Until
authentication and authorization are added, it should be treated as a
controlled development environment rather than a public production registry.
