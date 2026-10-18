// Where the sun is overhead at a given moment, and which places are in daylight.
// Low-precision solar coordinates (the U.S. Naval Observatory's almanac approximation, good to ~0.01°),
// which is far finer than a dot every 2° needs.
const RAD = Math.PI / 180;

export function subsolarPoint(ms) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;           // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;                 // mean anomaly
  const q = 280.459 + 0.98564736 * d;                         // mean longitude (degrees)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;                   // obliquity of the ecliptic
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD / 15;   // hours
  const decl = Math.asin(Math.sin(e) * Math.sin(L)) / RAD;
  let eqt = (((q / 15 - ra) % 24) + 24) % 24;                 // equation of time, hours
  if (eqt > 12) eqt -= 24;
  const utcHours = (((ms / 3600000) % 24) + 24) % 24;
  let lon = -15 * (utcHours - 12 + eqt);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: decl, lon };
}

// Sun's elevation in degrees seen from (lat, lon); below 0 is night.
export function sunElevation(lat, lon, sun) {
  const s = Math.sin(lat * RAD) * Math.sin(sun.lat * RAD) + Math.cos(lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos((lon - sun.lon) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD;
}

// Latitude of the day/night line at a longitude (the terminator).
export function terminatorLat(lon, sun) {
  const t = Math.tan(sun.lat * RAD);
  if (Math.abs(t) < 1e-6) return 0;
  return Math.atan(-Math.cos((lon - sun.lon) * RAD) / t) / RAD;
}
