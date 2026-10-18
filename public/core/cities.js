// Places students commonly take NYU courses from, mapped to IANA time zones (and coordinates, for the map).
export const CITIES = [
  { label: "New York", tz: "America/New_York", lat: 40.71, lon: -74.01 },
  { label: "Los Angeles", tz: "America/Los_Angeles", lat: 34.05, lon: -118.24 },
  { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires", lat: -34.6, lon: -58.38 },
  { label: "London", tz: "Europe/London", lat: 51.51, lon: -0.13 },
  { label: "Paris", tz: "Europe/Paris", lat: 48.86, lon: 2.35 },
  { label: "Madrid", tz: "Europe/Madrid", lat: 40.42, lon: -3.7 },
  { label: "Florence", tz: "Europe/Rome", lat: 43.77, lon: 11.26 },
  { label: "Berlin", tz: "Europe/Berlin", lat: 52.52, lon: 13.4 },
  { label: "Prague", tz: "Europe/Prague", lat: 50.08, lon: 14.44 },
  { label: "Accra", tz: "Africa/Accra", lat: 5.6, lon: -0.19 },
  { label: "Tel Aviv", tz: "Asia/Jerusalem", lat: 32.09, lon: 34.78 },
  { label: "Abu Dhabi", tz: "Asia/Dubai", lat: 24.45, lon: 54.38 },
  { label: "Mumbai", tz: "Asia/Kolkata", lat: 19.08, lon: 72.88 },
  { label: "Singapore", tz: "Asia/Singapore", lat: 1.35, lon: 103.82 },
  { label: "Beijing", tz: "Asia/Shanghai", lat: 39.9, lon: 116.4 },
  { label: "Shanghai", tz: "Asia/Shanghai", lat: 31.23, lon: 121.47 },
  { label: "Seoul", tz: "Asia/Seoul", lat: 37.57, lon: 126.98 },
  { label: "Tokyo", tz: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
  { label: "Sydney", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 },
];

export function cityForZone(tz) {
  const known = CITIES.find((c) => c.tz === tz);
  if (known) return known.label;
  const last = (tz || "").split("/").pop() || tz;
  return last.replace(/_/g, " ");
}

export function allZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return CITIES.map((c) => c.tz);
  }
}

export function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}
