// NYU lists meeting times as New York wall-clock times. These helpers turn them into
// real instants on the actual session dates (so daylight saving is handled) and then
// into the student's own clock.

export const NY_TZ = "America/New_York";
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // NYU meet_day 0 = Monday

const formatters = new Map();
function partsFormatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      }),
    );
  }
  return formatters.get(tz);
}

// Wall-clock reading of an instant in a time zone.
export function wallTime(utcMs, tz) {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: DAY_NAMES.indexOf(p.weekday),
    minutes: hour * 60 + Number(p.minute),
  };
}

function offsetMinutes(tz, utcMs) {
  const w = wallTime(utcMs, tz);
  const [y, m, d] = w.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, Math.floor(w.minutes / 60), w.minutes % 60);
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}

// "2027-01-04" + "0900" in tz -> UTC milliseconds
export function zonedToUtc(date, hhmm, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(2)));
  const first = offsetMinutes(tz, guess);
  let utc = guess - first * 60000;
  const second = offsetMinutes(tz, utc);
  if (second !== first) utc = guess - second * 60000;
  return utc;
}

function addDays(date, n) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function weekdayOf(date) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
}

// First date on or after `from` (or last on or before, when backwards) that falls on `day`.
export function dateForWeekday(from, day, backwards = false) {
  const delta = backwards ? -((weekdayOf(from) - day + 7) % 7) : (day - weekdayOf(from) + 7) % 7;
  return addDays(from, delta);
}

// One NYU meeting on a given date, read on the student's clock.
export function toLocal(meeting, date, tz) {
  const startUtc = zonedToUtc(date, meeting.start, NY_TZ);
  const endUtc = zonedToUtc(date, meeting.end, NY_TZ);
  const start = wallTime(startUtc, tz);
  const end = wallTime(endUtc, tz);
  return { start, end, crossesMidnight: end.date !== start.date };
}

export function parseClock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// window: { earliest: "08:00", latest: "23:00" }  ("24:00" = midnight)
export function fitsWindow(local, window) {
  const earliest = parseClock(window.earliest);
  const latest = parseClock(window.latest);
  const endMinutes = local.crossesMidnight && local.end.minutes === 0 ? 1440 : local.end.minutes;
  if (local.crossesMidnight && endMinutes !== 1440) return false;
  return local.start.minutes >= earliest && endMinutes <= latest;
}

// All meetings of a section on the student's clock, in the session's first and last week.
// dstShift is true when daylight saving moves the local time during the session.
export function localSchedule(section, tz) {
  const first = [];
  const last = [];
  for (const m of section.meetings) {
    const firstDate = dateForWeekday(section.startDate, m.day);
    let lastDate = dateForWeekday(section.endDate, m.day, true);
    if (lastDate < firstDate) lastDate = firstDate;
    first.push({ meeting: m, date: firstDate, local: toLocal(m, firstDate, tz), ny: toLocal(m, firstDate, NY_TZ) });
    last.push({ meeting: m, date: lastDate, local: toLocal(m, lastDate, tz), ny: toLocal(m, lastDate, NY_TZ) });
  }
  const dstShift = last.some(
    (l, i) => l.local.start.minutes !== first[i].local.start.minutes || l.local.start.weekday !== first[i].local.start.weekday,
  );
  return { first, last, dstShift };
}

export function formatClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

export function formatRange(local) {
  return `${formatClock(local.start.minutes)} – ${formatClock(local.end.minutes)}`;
}

function formatDays(days) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const runs = [];
  for (const d of sorted) {
    const run = runs[runs.length - 1];
    if (run && d === run[1] + 1) run[1] = d;
    else runs.push([d, d]);
  }
  return runs
    .map(([a, b]) => (a === b ? DAY_NAMES[a] : b === a + 1 ? `${DAY_NAMES[a]}, ${DAY_NAMES[b]}` : `${DAY_NAMES[a]}–${DAY_NAMES[b]}`))
    .join(", ");
}

// "Mon–Fri 10:00 pm – 2:00 am" (several patterns joined with "; ")
export function describeSchedule(entries, key = "local") {
  const byRange = new Map();
  for (const e of entries) {
    const r = formatRange(e[key]);
    if (!byRange.has(r)) byRange.set(r, []);
    byRange.get(r).push(e[key].start.weekday);
  }
  return [...byRange].map(([range, days]) => `${formatDays(days)} ${range}`).join("; ");
}
