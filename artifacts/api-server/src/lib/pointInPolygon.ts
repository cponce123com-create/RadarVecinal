/**
 * pointInPolygon — Ray-casting algorithm for point-in-polygon detection.
 *
 * Implements the ray-casting (even-odd rule) algorithm:
 *   - Cast a horizontal ray from the point to the right (+infinity)
 *   - Count how many times it crosses the polygon boundary
 *   - Odd count = inside, Even count = outside
 *
 * @param lat  Latitude of the point (WGS84)
 * @param lng  Longitude of the point (WGS84)
 * @param polygon  GeoJSON Polygon ring: array of [lng, lat] pairs.
 *                 The first and last coordinates should be identical (closed ring).
 * @returns true if the point is inside the polygon, false otherwise.
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][][],
): boolean {
  // polygon is a GeoJSON Polygon — it may have multiple rings.
  // The first ring is the exterior boundary; subsequent rings are holes.
  // For our district detection, we check if point is inside exterior
  // AND outside all holes.
  const exteriorRing = polygon[0];
  if (!exteriorRing || exteriorRing.length < 4) return false;

  const insideExterior = rayCastHit(lng, lat, exteriorRing);
  if (!insideExterior) return false;

  // Check holes — if point is inside a hole, it's outside the polygon
  for (let r = 1; r < polygon.length; r++) {
    const hole = polygon[r];
    if (hole.length >= 4 && rayCastHit(lng, lat, hole)) {
      return false;
    }
  }

  return true;
}

/**
 * Core ray-casting check against a single ring.
 * The ring is an array of [x, y] pairs where x = longitude, y = latitude.
 */
function rayCastHit(
  px: number,
  py: number,
  ring: number[][],
): boolean {
  let inside = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    // Check if the horizontal ray at py crosses the edge (xi, yi) -> (xj, yj)
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Convenience: check point against a GeoJSON geometry object.
 * Supports Polygon and MultiPolygon geometry types.
 */
export function pointInGeoJSONGeometry(
  lat: number,
  lng: number,
  geometry: { type: string; coordinates: any },
): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygon(lat, lng, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (pointInPolygon(lat, lng, polygon)) return true;
    }
    return false;
  }
  return false;
}
