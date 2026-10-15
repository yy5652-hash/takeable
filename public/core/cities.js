// Places students commonly take NYU courses from, mapped to IANA time zones.
export const CITIES = [
  { label: "New York", tz: "America/New_York" },
  { label: "Los Angeles", tz: "America/Los_Angeles" },
  { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
  { label: "London", tz: "Europe/London" },
  { label: "Paris", tz: "Europe/Paris" },
  { label: "Madrid", tz: "Europe/Madrid" },
  { label: "Florence", tz: "Europe/Rome" },
  { label: "Berlin", tz: "Europe/Berlin" },
  { label: "Prague", tz: "Europe/Prague" },
  { label: "Accra", tz: "Africa/Accra" },
  { label: "Tel Aviv", tz: "Asia/Jerusalem" },
  { label: "Abu Dhabi", tz: "Asia/Dubai" },
  { label: "Mumbai", tz: "Asia/Kolkata" },
  { label: "Singapore", tz: "Asia/Singapore" },
  { label: "Beijing", tz: "Asia/Shanghai" },
  { label: "Shanghai", tz: "Asia/Shanghai" },
  { label: "Seoul", tz: "Asia/Seoul" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Sydney", tz: "Australia/Sydney" },
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
