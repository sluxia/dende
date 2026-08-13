export interface TraverseLeg {
  bearingDeg: number;
  distanceM: number;
}

export interface TraverseAnchor {
  easting: number;
  northing: number;
}

export interface TraverseVertex {
  easting: number;
  northing: number;
}

/**
 * Computes beacon coordinates from an origin/anchor coordinate and an ordered
 * set of closed traverse legs.
 *
 * Survey plans that have no Beacon Statement table commonly give an origin
 * coordinate plus bearing/distance legs measured clockwise from grid north
 * along each boundary line. Each leg advances from the previous point using
 * standard traverse math:
 *
 *   dE = distance * sin(bearing)
 *   dN = distance * cos(bearing)
 *
 * If the final leg closes back to the starting point within
 * `closingToleranceM`, the redundant closing vertex is dropped.
 *
 * @param anchor Coordinates of the first (anchor) beacon
 * @param legs Ordered legs connecting adjacent beacons around the boundary
 * @param closingToleranceM Maximum distance (m) before a closing vertex is considered a duplicate
 */
export function computeTraverseVertices(
  anchor: TraverseAnchor,
  legs: TraverseLeg[],
  closingToleranceM = 0.5
): TraverseVertex[] {
  const vertices: TraverseVertex[] = [
    { easting: anchor.easting, northing: anchor.northing }
  ];

  let prev = anchor;
  for (const leg of legs) {
    const rad = (leg.bearingDeg * Math.PI) / 180;
    const next = {
      easting: prev.easting + leg.distanceM * Math.sin(rad),
      northing: prev.northing + leg.distanceM * Math.cos(rad)
    };
    vertices.push(next);
    prev = next;
  }

  if (vertices.length > 1) {
    const last = vertices[vertices.length - 1];
    const start = vertices[0];
    const closingDistance = Math.hypot(
      last.easting - start.easting,
      last.northing - start.northing
    );
    if (closingDistance <= closingToleranceM) {
      vertices.pop();
    }
  }

  return vertices;
}
