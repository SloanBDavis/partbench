// Observer-only independent checks for planar extruded gear outlines.
export function polygonArea(points) {
  return (
    Math.abs(
      points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length];
        return sum + a[0] * b[1] - a[1] * b[0];
      }, 0)
    ) / 2
  );
}
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function strictInside(p, polygon, tolerance) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    if (
      Math.abs(cross(a, b, p)) <= tolerance &&
      p[0] >= Math.min(a[0], b[0]) - tolerance &&
      p[0] <= Math.max(a[0], b[0]) + tolerance &&
      p[1] >= Math.min(a[1], b[1]) - tolerance &&
      p[1] <= Math.max(a[1], b[1]) + tolerance
    )
      return false;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function polygonsOverlap(a, b, tolerance = 1e-9) {
  for (let i = 0; i < a.length; i++) {
    const p = a[i],
      q = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const r = b[j],
        s = b[(j + 1) % b.length];
      if (
        Math.max(p[0], q[0]) < Math.min(r[0], s[0]) ||
        Math.max(r[0], s[0]) < Math.min(p[0], q[0]) ||
        Math.max(p[1], q[1]) < Math.min(r[1], s[1]) ||
        Math.max(r[1], s[1]) < Math.min(p[1], q[1])
      )
        continue;
      const x = cross(p, q, r),
        y = cross(p, q, s),
        z = cross(r, s, p),
        w = cross(r, s, q);
      if (
        ((x > tolerance && y < -tolerance) ||
          (x < -tolerance && y > tolerance)) &&
        ((z > tolerance && w < -tolerance) || (z < -tolerance && w > tolerance))
      )
        return true;
    }
  }
  return (
    a.some((p) => strictInside(p, b, tolerance)) ||
    b.some((p) => strictInside(p, a, tolerance))
  );
}
export function rotateTranslate(points, angle, x, y) {
  return points.map(([u, v]) => [
    u * Math.cos(angle) - v * Math.sin(angle) + x,
    u * Math.sin(angle) + v * Math.cos(angle) + y
  ]);
}
