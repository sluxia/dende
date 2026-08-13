import { convertCoordinate, convertPolygon } from "./index";
import type { GeoJSONPolygon, SupportedCRS } from "./index";

export interface MapVertex {
  beaconId: string;
  easting: number;
  northing: number;
}

export interface SurveyMapOptions {
  title?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ConvertedVertex extends MapVertex {
  longitude: number;
  latitude: number;
}

/**
 * Builds an offline-safe SVG diagram of the plot with the beacons pinned and
 * numbered. Renders with zero external dependencies, so the coordinates are
 * always visible even when tile/CDN requests are blocked.
 */
function buildPlotSvg(converted: ConvertedVertex[]): string {
  const lngs = converted.map((v) => v.longitude);
  const lats = converted.map((v) => v.latitude);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const padX = Math.max((maxLng - minLng) * 0.15, 0.00002);
  const padY = Math.max((maxLat - minLat) * 0.15, 0.00002);
  const width = 720;
  const height = 520;

  const x = (lng: number) =>
    ((lng - (minLng - padX)) / (maxLng - minLng + padX * 2)) * width;
  const y = (lat: number) =>
    height - ((lat - (minLat - padY)) / (maxLat - minLat + padY * 2)) * height;

  const path = converted
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(v.longitude).toFixed(1)},${y(v.latitude).toFixed(1)}`)
    .join(" ")
    .concat(" Z");

  const pins = converted
    .map(
      (v, i) => `
      <g>
        <circle cx="${x(v.longitude).toFixed(1)}" cy="${y(v.latitude).toFixed(1)}" r="11" fill="#d97706" stroke="#fff" stroke-width="2.5"/>
        <text x="${x(v.longitude).toFixed(1)}" y="${(y(v.latitude) + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${i + 1}</text>
        <text x="${(x(v.longitude) + 14).toFixed(1)}" y="${(y(v.latitude) - 6).toFixed(1)}" font-size="13" font-weight="700" fill="#1f2937">${escapeHtml(v.beaconId)}</text>
      </g>`
    )
    .join("");

  return `
  <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Survey plot boundary">
    <rect width="${width}" height="${height}" fill="#f3f4f6"/>
    <polygon points="${converted
      .map((v) => `${x(v.longitude).toFixed(1)},${y(v.latitude).toFixed(1)}`)
      .join(" ")}" fill="#fbbf24" fill-opacity="0.35" stroke="#d97706" stroke-width="3"/>
    <path d="${path}" fill="none" stroke="#d97706" stroke-width="1" stroke-dasharray="4,4"/>
    ${pins}
  </svg>`;
}

/**
 * Renders a self-contained HTML page showing the survey plot with every
 * beacon coordinate pinned. Includes:
 *  1. An offline-safe SVG diagram (no network required) with numbered pins.
 *  2. A Leaflet map over OpenStreetMap tiles (loads when online).
 *  3. A "Open in Google Maps" button jumping to the plot.
 *  4. A side panel listing every beacon's grid + WGS84 coordinates.
 *
 * @param vertices Ordered boundary vertices (easting/northing)
 * @param sourceCRS CRS the vertices are expressed in
 * @param options Rendering options
 * @returns Complete HTML document string
 */
export function renderSurveyMapHtml(
  vertices: MapVertex[],
  sourceCRS: SupportedCRS,
  options: SurveyMapOptions = {}
): string {
  if (vertices.length < 3) {
    throw new Error("A polygon requires at least 3 vertices.");
  }

  const converted: ConvertedVertex[] = vertices.map((v) => {
    const { longitude, latitude } = convertCoordinate(v.easting, v.northing, sourceCRS);
    return { ...v, longitude, latitude };
  });

  const polygon: GeoJSONPolygon = convertPolygon(
    converted.map((v) => [v.longitude, v.latitude] as [number, number]),
    "EPSG:4326"
  );

  const centroid = converted.reduce(
    (acc, v) => ({ latitude: acc.latitude + v.latitude, longitude: acc.longitude + v.longitude }),
    { latitude: 0, longitude: 0 }
  );
  centroid.latitude /= converted.length;
  centroid.longitude /= converted.length;

  const data = JSON.stringify({
    polygon,
    converted,
    centroid,
    crs: sourceCRS,
    crsName: sourceCRS
  }).replace(/</g, "\\u003c");

  const title = escapeHtml(options.title ?? "Dende — Survey Plan Plot Boundary");
  const svg = buildPlotSvg(converted);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #e5e7eb; }
  #map { height: 100%; width: 100%; }
  .marker-label {
    background: #fff;
    border: 1px solid #d97706;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 11px;
    font-weight: 600;
    color: #222;
    box-shadow: 0 1px 3px rgba(0,0,0,.3);
    white-space: nowrap;
  }
  .wrapper { display: grid; grid-template-columns: 1fr 400px; height: 100vh; }
  @media (max-width: 900px) { .wrapper { grid-template-columns: 1fr; } }
  #panel { background: #fff; overflow-y: auto; padding: 16px; box-sizing: border-box; }
  #panel h1 { font-size: 15px; margin: 0 0 4px; }
  #panel .crs { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
  #panel table { border-collapse: collapse; width: 100%; font-size: 12px; }
  #panel th, #panel td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; }
  #panel td.num { font-variant-numeric: tabular-nums; }
  .pin-row { display: flex; align-items: center; gap: 8px; }
  .pin-num { width: 20px; height: 20px; border-radius: 50%; background: #d97706; color: #fff; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .btn { display: inline-block; margin-top: 12px; padding: 8px 12px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600; }
  .btn:hover { background: #1e40af; }
  .plot-title { font-size: 13px; font-weight: 700; color: #374151; margin: 16px 0 8px; }
  #plot { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
</style>
</head>
<body>
<div class="wrapper">
  <div id="map"></div>
  <div id="panel">
    <h1>${title}</h1>
    <div class="crs">Source CRS: ${escapeHtml(sourceCRS)} · ${converted.length} beacons · ${escapeHtml(sourceCRS === "EPSG:32632" ? "WGS 84 / UTM Zone 32N" : "WGS 84")}</div>
    <table>
      <tr><th></th><th>Beacon</th><th>Latitude</th><th>Longitude</th></tr>
      ${converted
        .map(
          (v, i) =>
            `<tr>
              <td><span class="pin-num">${i + 1}</span></td>
              <td>${escapeHtml(v.beaconId)}</td>
              <td class="num">${v.latitude.toFixed(6)}</td>
              <td class="num">${v.longitude.toFixed(6)}</td>
            </tr>`
        )
        .join("")}
    </table>
    <div class="plot-title">Pinned coordinates (offline view)</div>
    <div id="plot">${svg}</div>
    <a class="btn" href="https://www.google.com/maps?q=${centroid.latitude.toFixed(6)},${centroid.longitude.toFixed(6)}&z=17" target="_blank" rel="noopener">Open in Google Maps</a>
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const data = ${data};
  const map = L.map("map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const polygonLayer = L.geoJSON(data.polygon, {
    style: { color: "#d97706", weight: 3, fillColor: "#fbbf24", fillOpacity: 0.3 }
  }).addTo(map);

  data.converted.forEach((v, i) => {
    const icon = L.divIcon({
      className: "",
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#d97706;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">' + (i + 1) + '</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([v.latitude, v.longitude], { icon }).addTo(map)
      .bindTooltip(
        '<strong>' + (i + 1) + '. ' + v.beaconId + '</strong><br/>' +
        v.latitude.toFixed(6) + ', ' + v.longitude.toFixed(6) + '<br/>E ' +
        v.easting.toFixed(3) + ' N ' + v.northing.toFixed(3),
        { permanent: true, direction: "top", offset: [0, -10], className: "marker-label" }
      );
  });

  map.fitBounds(polygonLayer.getBounds(), { padding: [50, 50] });
</script>
</body>
</html>`;
}
