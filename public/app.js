import { CITIES, allZones, browserZone, cityForZone } from "./core/cities.js";
import { DAY_NAMES, NY_TZ, describeSchedule, fitsWindow, formatClock, formatRange, localSchedule, parseClock, wallTime } from "./core/time.js";
import { VERDICTS, judge } from "./core/verdict.js";
import { schoolOf } from "./core/schools.js";
import { readNote } from "./core/notes.js";

const $ = (id) => document.getElementById(id);
const GROUP_ORDER = ["takeable", "check", "no"];
const TILE_COPY = {
  takeable: "Fits your clock and counts for credit",
  check: "Looks possible — confirm one thing first",
  no: "Wrong hour, in person, or no credit",
};

const STORE = { situation: "takeable.situation", starred: "takeable.starred" };

const state = {
  situation: loadStored(STORE.situation, defaultSituation, validSituation),
  terms: [],
  data: null, // sections payload for the current term
  loading: null, // { done, total } while fetching
  error: "",
  search: "",
  filter: null, // one verdict group, or null for all
  open: null, // class number of the section shown in the detail panel
  sheetOpen: false, // shortlist expanded on narrow screens
  starred: loadStored(STORE.starred, () => ({}), (v) => v && typeof v === "object" && !Array.isArray(v)), // { term: [crn] }
};

// Local storage can be missing or blocked (private windows); the page works without it.
function loadStored(key, fallback, isValid) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value && isValid(value)) return value;
  } catch {}
  return fallback();
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function validSituation(s) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s.tz });
  } catch {
    return false;
  }
  return ["stern", "other"].includes(s.homeSchool) && s.window?.earliest && s.window?.latest && typeof s.cityLabel === "string";
}

function defaultSituation() {
  const tz = browserZone();
  return {
    homeSchool: "stern",
    tz,
    cityLabel: cityForZone(tz),
    guessed: true,
    term: "",
    window: { earliest: "08:00", latest: "23:00" },
  };
}

// ---------- Situation sentence ----------

function fillSituationControls() {
  const s = state.situation;
  $("homeSchool").innerHTML = [
    ["stern", "a Stern undergrad"],
    ["other", "at another NYU school"],
  ]
    .map(([v, t]) => `<option value="${v}">${t}</option>`)
    .join("");
  $("homeSchool").value = s.homeSchool;

  const cityOptions = CITIES.map((c) => `<option value="city:${c.label}">${c.label}</option>`);
  const known = CITIES.some((c) => c.label === s.cityLabel && c.tz === s.tz);
  const zoneOptions = allZones()
    .filter((z) => z.includes("/"))
    .map((z) => `<option value="tz:${z}">${z.replace(/_/g, " ")}</option>`);
  $("city").innerHTML = `${cityOptions.join("")}<optgroup label="Other time zone…">${zoneOptions.join("")}</optgroup>`;
  $("city").value = known ? `city:${s.cityLabel}` : `tz:${s.tz}`;
  $("guess").hidden = !s.guessed;

  const halfHours = (from, to) => {
    const out = [];
    for (let m = from; m <= to; m += 30) out.push(m);
    return out;
  };
  const clockValue = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  $("earliest").innerHTML = halfHours(0, 14 * 60)
    .map((m) => `<option value="${clockValue(m)}">${formatClock(m)}</option>`)
    .join("");
  $("latest").innerHTML = halfHours(12 * 60, 24 * 60)
    .map((m) => `<option value="${clockValue(m)}">${m === 1440 ? "midnight" : formatClock(m)}</option>`)
    .join("");
  $("earliest").value = s.window.earliest;
  $("latest").value = s.window.latest;
}

function fillTerms() {
  $("term").innerHTML = state.terms.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  if (!state.terms.some((t) => t.id === state.situation.term)) state.situation.term = state.terms[0]?.id || "";
  $("term").value = state.situation.term;
}

function onSituationChange(event) {
  const s = state.situation;
  const id = event.target.id;
  if (id === "homeSchool") s.homeSchool = event.target.value;
  if (id === "city") {
    const [kind, value] = event.target.value.split(/:(.*)/s);
    if (kind === "city") {
      const city = CITIES.find((c) => c.label === value);
      s.tz = city.tz;
      s.cityLabel = city.label;
    } else {
      s.tz = value;
      s.cityLabel = cityForZone(value);
    }
    s.guessed = false;
    $("guess").hidden = true;
  }
  if (id === "earliest") s.window.earliest = event.target.value;
  if (id === "latest") s.window.latest = event.target.value;
  if (id === "term") {
    s.term = event.target.value;
    loadSections();
  }
  save(STORE.situation, s);
  render();
}

// ---------- Clocks ----------

function renderClocks() {
  const now = Date.now();
  const clock = (label, tz, you) => {
    const w = wallTime(now, tz);
    const night = w.minutes < 6 * 60 || w.minutes >= 22 * 60;
    return `<div class="clock${you ? " you" : ""}"><span class="where">${escapeHtml(label)}${you ? " · you" : ""}</span><span class="time">${formatClock(
      w.minutes,
    ).toUpperCase()}${night ? `<span class="night" title="Night there">☾</span>` : ""}</span></div>`;
  };
  const { tz, cityLabel } = state.situation;
  $("clocks").innerHTML = tz === NY_TZ ? clock("New York", NY_TZ, true) : clock("New York", NY_TZ, false) + clock(cityLabel, tz, true);
}

// ---------- Data ----------

async function loadTerms() {
  try {
    const res = await fetch("/api/terms");
    state.terms = await res.json();
  } catch {
    state.terms = [];
  }
  fillTerms();
}

async function loadSections() {
  const term = state.situation.term;
  if (!term) return;
  state.data = null;
  state.error = "";
  state.open = null;
  state.loading = { done: 0, total: 0 };
  render();
  const name = state.terms.find((t) => t.id === term)?.name || term;
  try {
    const res = await fetch(`/api/sections?term=${term}&name=${encodeURIComponent(name)}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handleLine(JSON.parse(line), term);
      }
    }
  } catch (err) {
    if (state.situation.term === term) state.error = "Couldn't load sections. Is the Takeable server running?";
  }
  if (state.situation.term === term) {
    state.loading = null;
    render();
  }
}

function handleLine(msg, term) {
  if (state.situation.term !== term) return; // the student switched terms meanwhile
  if (msg.type === "progress") {
    state.loading = { done: msg.done, total: msg.total };
    renderSummary();
  } else if (msg.type === "result") {
    state.data = msg;
  } else if (msg.type === "error") {
    state.error = msg.message;
  }
}

// ---------- Rendering ----------

function judged() {
  if (!state.data) return [];
  const q = state.search.trim().toLowerCase();
  return state.data.sections
    .filter((s) => !q || `${s.code} ${s.title} ${s.subject}`.toLowerCase().includes(q))
    .map((s) => ({ section: s, ...judge(s, state.situation) }));
}

function render() {
  renderClocks();
  renderBanner();
  renderSummary();
  renderList();
  renderSide();
  renderFooter();
}

function renderBanner() {
  const d = state.data;
  const banner = $("banner");
  if (d?.source === "snapshot") {
    const saved = new Date(d.fetchedAt).toLocaleDateString("en-US", { dateStyle: "medium" });
    banner.textContent = `Couldn't reach NYU — showing saved data from ${saved}.`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

function renderSummary() {
  const el = $("summary");
  if (state.loading) {
    const { done, total } = state.loading;
    el.innerHTML = `<div class="loading"><span>${total ? `Checking ${done} of ${total} sections with NYU…` : "Asking NYU for this term's sections…"}</span>${
      total ? `<progress max="${total}" value="${done}" aria-label="Sections checked"></progress>` : ""
    }</div>`;
    return;
  }
  if (!state.data) {
    el.innerHTML = "";
    return;
  }
  const items = judged();
  const counts = Object.fromEntries(GROUP_ORDER.map((v) => [v, items.filter((i) => i.verdict === v).length]));
  const hidden = state.data.inPersonHidden;
  const away = state.situation.tz !== NY_TZ;
  el.innerHTML =
    GROUP_ORDER.map(
      (v) => `<button type="button" class="tile ${v}" data-filter="${v}" aria-pressed="${state.filter === v}">
        <span class="num">${counts[v]}</span>
        <span class="label">${VERDICTS[v].symbol} ${VERDICTS[v].label}</span>
        <span class="sub">${TILE_COPY[v]}</span>
      </button>`,
    ).join("") +
    (hidden
      ? `<p class="board-note">+ ${hidden} in-person sections ${away ? `hidden — you'll be in ${escapeHtml(state.situation.cityLabel)}` : "not listed — Takeable covers remote study"}.</p>`
      : "");
}

// When nothing is fully takeable, say what's blocking most sections and offer the obvious fix.
function blockerHtml(items) {
  if (state.search.trim() || state.filter || items.some((i) => i.verdict === "takeable")) return "";
  const blocked = items.filter((i) => i.verdict === "no");
  if (!blocked.length) return "";
  const byTime = blocked.filter((i) => i.reasons.some((r) => r.kind === "time" && r.level === "fail" && r.schedule));
  const byCredit = blocked.filter((i) => i.reasons.some((r) => r.kind === "credit" && r.level === "fail"));
  const city = escapeHtml(state.situation.cityLabel);
  let text;
  let action = "";
  if (byTime.length >= byCredit.length) {
    // Times wrap around midnight, so measure them from the middle of the student's class hours:
    // the blocked starts then sit together in one run (late evening → early morning).
    const { earliest, latest } = state.situation.window;
    const pivot = (parseClock(earliest) + parseClock(latest)) / 2;
    const shifted = byTime
      .map((i) => i.reasons.find((r) => r.kind === "time").schedule.first[0].local.start.minutes)
      .map((m) => (m - pivot + 1440) % 1440)
      .sort((a, b) => a - b);
    const q = (p) => (shifted[Math.min(shifted.length - 1, Math.floor(p * shifted.length))] + pivot) % 1440;
    text = `${byTime.length} of ${blocked.length} blocked sections meet outside your class hours — most start between ${formatClock(q(0.25))} and ${formatClock(q(0.75))} in ${city}.`;
    const wide = earliest === "06:00" && latest === "24:00";
    if (!wide) action = `<button type="button" class="ghost" data-action="widen">Try 6:00 am – midnight</button>`;
  } else {
    text = `${byCredit.length} of ${blocked.length} blocked sections are School of Professional Studies courses, which Stern doesn't credit.`;
  }
  return `<div class="blocker"><span class="icon" aria-hidden="true">☾</span><p><b>Nothing is fully takeable from ${city} this term.</b> ${text}</p>${action}</div>`;
}

function renderList() {
  const el = $("list");
  $("filterNote").innerHTML = state.filter
    ? `Showing only <b>${VERDICTS[state.filter].label}</b> <button type="button" data-action="clear-filter">Show all</button>`
    : "";
  if (state.error) {
    el.innerHTML = `<div class="empty">${escapeHtml(state.error)}</div>`;
    return;
  }
  if (!state.data) {
    el.innerHTML = "";
    return;
  }
  const items = judged();
  if (!items.length) {
    el.innerHTML = `<div class="empty">No sections match “${escapeHtml(state.search)}” this term.</div>`;
    return;
  }
  const groups = state.filter ? [state.filter] : GROUP_ORDER;
  const html = groups
    .map((v) => {
      const group = items.filter((i) => i.verdict === v).sort((a, b) => a.section.code.localeCompare(b.section.code, "en", { numeric: true }));
      if (!group.length) return "";
      return `<section class="group">
        <div class="group-head ${v}"><span class="dot"></span><h2>${VERDICTS[v].label}</h2><span class="n">${group.length}</span></div>
        <ul class="cards">${group.map(cardHtml).join("")}</ul>
      </section>`;
    })
    .join("");
  el.innerHTML = blockerHtml(items) + (html || `<div class="empty">No ${VERDICTS[state.filter].label.toLowerCase()} sections this term.</div>`);
}

function widenHours() {
  state.situation.window = { earliest: "06:00", latest: "24:00" };
  $("earliest").value = "06:00";
  $("latest").value = "24:00";
  save(STORE.situation, state.situation);
  render();
}

const LEVEL_SYMBOL = { fail: "✕", check: "?", pass: "✓" };

function cardHtml({ section: s, verdict, reasons }) {
  // The 24-hour bar already shows the time, so the card leads with the most useful other reason.
  const top = reasons.find((r) => !(r.kind === "time" && r.level === "pass")) || reasons[0];
  const text = top.kind === "time" && top.level === "fail" && top.schedule ? `Outside your class hours (${windowText()})` : top.text;
  const school = schoolOf(s);
  return `<li class="card ${verdict}${s.crn === state.open ? " open" : ""}" tabindex="0" data-crn="${s.crn}">
    <div class="info">
      <div class="meta"><span class="code">${escapeHtml(s.code)}</span><span>${escapeHtml(school.short || school.name)} · ${escapeHtml(
        creditsText(s.credits),
      )} cr · ${s.mode === "blended" ? "Blended" : "Online"}</span></div>
      <div class="title">${escapeHtml(s.title)}</div>
      <div class="why ${top.level}"><span class="mark" aria-hidden="true">${LEVEL_SYMBOL[top.level]}</span><span>${escapeHtml(text)}</span></div>
    </div>
    ${whenHtml(s)}
    <div class="right">${chipHtml(verdict)}${starButtonHtml(s)}</div>
  </li>`;
}

function windowText() {
  const { earliest, latest } = state.situation.window;
  const end = parseClock(latest);
  return `${formatClock(parseClock(earliest))} – ${end === 1440 ? "midnight" : formatClock(end)}`;
}

function whenHtml(s) {
  const tz = state.situation.tz;
  if (!s.meetings.length) {
    const async = /does not meet/i.test(s.meetsText) || readNote(s.note).async === true;
    return `<div class="when">
      <div class="when-text"><span class="local">${async ? "Anytime" : "Time not listed"}</span></div>
      ${dialHtml(async ? [{ anytime: true }] : [{ unknown: true }])}
      ${ticksHtml()}
      <div class="ny-line">${async ? "Asynchronous — on your own schedule" : "Check the official listing"}</div>
    </div>`;
  }
  const schedule = localSchedule(s, tz);
  const away = tz !== NY_TZ;
  const ranges = uniqueRanges(schedule.first);
  const local = ranges.length > 1 ? `${describeSchedule([ranges[0].entry])} +${ranges.length - 1} more` : describeSchedule(schedule.first);
  return `<div class="when">
    <div class="when-text"><span class="local">${escapeHtml(local)}</span></div>
    ${dialHtml(ranges.map((r) => ({ local: r.entry.local })))}
    ${ticksHtml()}
    ${away ? `<div class="ny-line">${escapeHtml(describeSchedule([ranges[0].entry], "ny"))} in New York</div>` : ""}
  </div>`;
}

function uniqueRanges(entries) {
  const seen = new Map();
  for (const e of entries) {
    const key = `${e.local.start.minutes}-${e.local.end.minutes}`;
    if (!seen.has(key)) seen.set(key, { entry: e });
  }
  return [...seen.values()];
}

// A 24-hour bar on the student's clock: night shading, their class hours, and the class itself.
function dialHtml(blocks) {
  const pct = (m) => `${((m / 1440) * 100).toFixed(3)}%`;
  const { window } = state.situation;
  const e = parseClock(window.earliest);
  const l = parseClock(window.latest);
  let html = `<span class="night" style="left:0;width:${pct(360)}"></span><span class="night" style="left:${pct(1320)};width:${pct(120)}"></span>`;
  html += `<span class="window" style="left:${pct(e)};width:${pct(Math.max(0, l - e))}"></span>`;
  for (const b of blocks) {
    if (b.anytime) html += `<span class="block anytime" title="Asynchronous"></span>`;
    else if (b.unknown) html += `<span class="block unknown" title="Time not listed"></span>`;
    else {
      const fit = fitsWindow(b.local, window) ? "fit" : "miss";
      const start = b.local.start.minutes;
      const end = b.local.crossesMidnight ? 1440 : b.local.end.minutes;
      const title = formatRange(b.local);
      html += `<span class="block ${fit}" style="left:${pct(start)};width:${pct(end - start)}" title="${title}"></span>`;
      if (b.local.crossesMidnight) {
        html += `<span class="block ${fit}" style="left:0;width:${pct(b.local.end.minutes)}" title="${title}"></span>`;
      }
    }
  }
  return `<div class="dial" aria-hidden="true">${html}</div>`;
}

function ticksHtml() {
  return `<div class="ticks" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>`;
}

// One bar per local weekday for the detail panel.
function weekHtml(s) {
  if (!s.meetings.length) return "";
  const schedule = localSchedule(s, state.situation.tz);
  const { window } = state.situation;
  const pct = (m) => `${((m / 1440) * 100).toFixed(3)}%`;
  const e = parseClock(window.earliest);
  const l = parseClock(window.latest);
  const rows = DAY_NAMES.map((name, day) => {
    let blocks = "";
    for (const entry of schedule.first) {
      const { local } = entry;
      const fit = fitsWindow(local, window) ? "fit" : "miss";
      if (local.start.weekday === day) {
        const end = local.crossesMidnight ? 1440 : local.end.minutes;
        blocks += `<span class="block ${fit}" style="left:${pct(local.start.minutes)};width:${pct(end - local.start.minutes)}"></span>`;
      }
      if (local.crossesMidnight && local.end.weekday === day && local.end.minutes > 0) {
        blocks += `<span class="block ${fit}" style="left:0;width:${pct(local.end.minutes)}"></span>`;
      }
    }
    const on = blocks !== "";
    return `<span class="day${on ? " on" : ""}">${name}</span><div class="dial" aria-hidden="true"><span class="night" style="left:0;width:${pct(
      360,
    )}"></span><span class="night" style="left:${pct(1320)};width:${pct(120)}"></span><span class="window" style="left:${pct(e)};width:${pct(
      Math.max(0, l - e),
    )}"></span>${blocks}</div>`;
  }).join("");
  return `<div class="week">${rows}<span></span>${ticksHtml()}</div>
    <div class="week-legend"><span><i style="background:var(--window);border:1px dashed var(--window-edge)"></i>Your class hours</span><span><i style="background:var(--ok-solid)"></i>Fits</span><span><i style="background:var(--no-solid)"></i>Outside your hours</span></div>`;
}

function starButtonHtml(s, withLabel = false) {
  const on = isStarred(s.crn);
  const label = on ? `Remove ${s.code} from shortlist` : `Add ${s.code} to shortlist`;
  return `<button type="button" class="star${on ? " on" : ""}${withLabel ? " labelled" : ""}" data-action="star" data-crn="${s.crn}" aria-pressed="${on}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span aria-hidden="true">${on ? "★" : "☆"}</span>${
    withLabel ? (on ? " On your shortlist" : " Add to shortlist") : ""
  }</button>`;
}

// ---------- Shortlist ----------

function starredList() {
  return state.starred[state.situation.term] || [];
}

function isStarred(crn) {
  return starredList().includes(crn);
}

function toggleStar(crn) {
  const term = state.situation.term;
  const list = starredList();
  state.starred[term] = list.includes(crn) ? list.filter((c) => c !== crn) : [...list, crn];
  save(STORE.starred, state.starred);
  renderList();
  renderSide();
}

function shortlistHtml() {
  const termName = state.terms.find((t) => t.id === state.situation.term)?.name || "";
  const sections = starredList()
    .map((crn) => state.data?.sections.find((s) => s.crn === crn))
    .filter(Boolean);
  const head = `<div class="pass-head"><button type="button" class="sheet-toggle" data-action="sheet" aria-expanded="${state.sheetOpen}">
      <span><span class="kicker">Your shortlist</span><span class="pass-title">${escapeHtml(termName || "This term")}</span></span>
      <span class="badge">${sections.length}</span></button></div>`;
  if (!sections.length) {
    return `<section class="panel shortlist" aria-label="Shortlist">${head}
      <div class="pass-body"><p class="muted">Star sections (☆) to keep them here with their total credits and class numbers. Click any section to see the evidence behind its verdict.</p></div>
    </section>`;
  }
  const min = sections.reduce((a, s) => a + (s.credits?.min || 0), 0);
  const max = sections.reduce((a, s) => a + (s.credits?.max || 0), 0);
  const total = min === max ? `${min}` : `${min}–${max}`;
  const items = sections
    .map((s) => {
      const { verdict } = judge(s, state.situation);
      return `<li class="short-item">
        <button type="button" class="short-open" data-action="open" data-crn="${s.crn}">
          <span class="code">${escapeHtml(s.code)}</span>
          <span class="short-title">${escapeHtml(s.title)}</span>
          <span class="short-meta">${chipHtml(verdict)}<span class="muted">${escapeHtml(creditsText(s.credits))} cr · #${escapeHtml(s.crn)}</span></span>
        </button>
        <button type="button" class="icon-btn small" data-action="star" data-crn="${s.crn}" aria-label="Remove ${escapeHtml(s.code)} from shortlist">×</button>
      </li>`;
    })
    .join("");
  return `<section class="panel shortlist" aria-label="Shortlist">${head}
    <div class="pass-body">
      <ul class="short-items">${items}</ul>
      <div class="perforation" aria-hidden="true"></div>
      <div class="short-total"><span>Total</span><b>${total} cr</b></div>
      <button type="button" class="primary" data-action="copy">Copy class numbers</button>
      <p class="muted small">Paste them into Albert's class search when your registration opens.</p>
    </div>
  </section>`;
}

async function copyClassNumbers(button) {
  const text = starredList()
    .filter((crn) => state.data?.sections.some((s) => s.crn === crn))
    .join(", ");
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = false;
  }
  button.textContent = ok ? "Copied ✓" : `Copy failed — ${text}`;
  button.classList.toggle("done", ok);
  setTimeout(() => {
    button.textContent = "Copy class numbers";
    button.classList.remove("done");
  }, 2000);
}

// ---------- Side: detail panel ----------

function renderSide() {
  const el = $("side");
  const section = state.open && state.data?.sections.find((s) => s.crn === state.open);
  document.body.classList.toggle("detail-open", Boolean(section));
  document.body.classList.toggle("sheet-open", !section && state.sheetOpen);
  el.innerHTML = section ? detailHtml(section) : shortlistHtml();
}

function detailHtml(s) {
  const { verdict, reasons } = judge(s, state.situation);
  const school = schoolOf(s);
  const city = state.situation.cityLabel;
  return `<article class="panel detail" aria-label="${escapeHtml(s.code)} details">
    <header class="panel-head">
      <div>
        <span class="code">${escapeHtml(s.code)} · Section ${escapeHtml(s.section)}</span>
        <h3>${escapeHtml(s.title)}</h3>
      </div>
      <button type="button" class="icon-btn" data-action="close" aria-label="Close details">×</button>
    </header>
    <div class="panel-verdict">${chipHtml(verdict)}${starButtonHtml(s, true)}</div>
    <ul class="reasons">${reasons
      .map(
        (r) => `<li class="reason-item ${r.level}"><span class="mark" aria-hidden="true">${LEVEL_SYMBOL[r.level]}</span><span>${escapeHtml(r.text)}${
          r.source ? ` <a href="${r.source.url}" target="_blank" rel="noopener">Stern policy</a> <span class="checked">(checked ${escapeHtml(formatDate(r.source.checked, true))})</span>` : ""
        }</span></li>`,
      )
      .join("")}</ul>

    <h4>Your week in ${escapeHtml(city)}</h4>
    ${s.meetings.length ? weekHtml(s) : ""}
    ${meetingTableHtml(s, city)}

    <h4>Section</h4>
    <dl class="facts">
      <dt>Dates</dt><dd>${escapeHtml(formatDate(s.startDate))} – ${escapeHtml(formatDate(s.endDate, true))}</dd>
      <dt>Mode</dt><dd>${s.mode === "blended" ? "Blended (online and in person)" : "Online"}</dd>
      <dt>Credits</dt><dd>${escapeHtml(creditsText(s.credits))}</dd>
      <dt>Offered by</dt><dd>${escapeHtml(school.name)}</dd>
      <dt>Class number</dt><dd class="mono">${escapeHtml(s.crn)}</dd>
      <dt>Component</dt><dd>${escapeHtml(s.component || "—")}</dd>
    </dl>

    <h4>NYU's note</h4>
    ${s.note ? `<blockquote>${escapeHtml(s.note)}</blockquote>` : `<p class="muted">No note on this section.</p>`}

    ${s.description ? `<h4>About the course</h4><p class="description">${escapeHtml(s.description)}</p>` : ""}

    <p class="links"><a href="https://bulletins.nyu.edu/search/?P=${encodeURIComponent(s.code)}" target="_blank" rel="noopener">Course in the NYU Bulletin ↗</a></p>
  </article>`;
}

function meetingTableHtml(s, city) {
  if (!s.meetings.length) {
    return `<p class="muted">${/does not meet/i.test(s.meetsText) ? "No set meeting times — asynchronous, so you work on your own schedule." : "NYU hasn't listed meeting times."}</p>`;
  }
  const schedule = localSchedule(s, state.situation.tz);
  const rows = schedule.first
    .map(
      (e) => `<tr><td>${DAY_NAMES[e.local.start.weekday]}</td><td class="mono-num">${escapeHtml(formatRange(e.local))}</td><td class="mono-num muted">${
        DAY_NAMES[e.ny.start.weekday]
      } ${escapeHtml(formatRange(e.ny))}</td></tr>`,
    )
    .join("");
  const dst = schedule.dstShift
    ? `<p class="muted">After the clocks change: ${escapeHtml(describeSchedule(schedule.last))} your time.</p>`
    : "";
  return `<table class="meetings"><thead><tr><th>Day</th><th>${escapeHtml(city)} (you)</th><th>New York</th></tr></thead><tbody>${rows}</tbody></table>${dst}`;
}

function creditsText(c) {
  if (!c) return "?";
  return c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`;
}

function formatDate(iso, withYear = false) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function markOpenCard() {
  document.querySelectorAll(".card.open").forEach((r) => r.classList.remove("open"));
  if (state.open) document.querySelector(`.card[data-crn="${state.open}"]`)?.classList.add("open");
}

function openSection(crn) {
  state.open = crn;
  renderSide();
  markOpenCard();
  $("side").scrollTop = 0;
  $("side").querySelector(".icon-btn")?.focus({ preventScroll: true });
}

function closeSection() {
  if (!state.open) return;
  const crn = state.open;
  state.open = null;
  renderSide();
  markOpenCard();
  document.querySelector(`.card[data-crn="${crn}"]`)?.focus({ preventScroll: true });
}

export function chipHtml(verdict) {
  const v = VERDICTS[verdict];
  return `<span class="chip ${verdict}"><span aria-hidden="true">${v.symbol}</span>${v.label}</span>`;
}

function renderFooter() {
  const d = state.data;
  const when = d?.fetchedAt ? new Date(d.fetchedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  $("footer").innerHTML = `Course data from NYU's public <a href="https://bulletins.nyu.edu/class-search/" target="_blank" rel="noopener">class search</a>${
    when ? ` · ${d.source === "snapshot" ? "saved snapshot from" : "fetched"} ${escapeHtml(when)}` : ""
  }. Takeable is a student project, not an NYU service — confirm with your adviser before you register.`;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- Start ----------

$("situation").addEventListener("change", onSituationChange);
$("situation").addEventListener("submit", (e) => e.preventDefault());
$("search").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderSummary();
  renderList();
});
$("summary").addEventListener("click", (e) => {
  const tile = e.target.closest("[data-filter]");
  if (!tile) return;
  state.filter = state.filter === tile.dataset.filter ? null : tile.dataset.filter;
  renderSummary();
  renderList();
});
$("filterNote").addEventListener("click", (e) => {
  if (!e.target.closest('[data-action="clear-filter"]')) return;
  state.filter = null;
  renderSummary();
  renderList();
});
$("list").addEventListener("click", (e) => {
  if (e.target.closest('[data-action="widen"]')) return widenHours();
  const star = e.target.closest('[data-action="star"]');
  if (star) {
    toggleStar(star.dataset.crn);
    $("list").querySelector(`[data-action="star"][data-crn="${star.dataset.crn}"]`)?.focus({ preventScroll: true });
    return;
  }
  const card = e.target.closest(".card");
  if (card) openSection(card.dataset.crn);
});
$("list").addEventListener("keydown", (e) => {
  if (e.target.closest("button")) return;
  const card = e.target.closest(".card");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openSection(card.dataset.crn);
  }
});
$("side").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]");
  if (!action) return;
  const { crn } = action.dataset;
  if (action.dataset.action === "close") closeSection();
  if (action.dataset.action === "star") toggleStar(crn);
  if (action.dataset.action === "open") openSection(crn);
  if (action.dataset.action === "copy") copyClassNumbers(action);
  if (action.dataset.action === "sheet") {
    state.sheetOpen = !state.sheetOpen;
    renderSide();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSection();
});

fillSituationControls();
renderClocks();
setInterval(renderClocks, 20_000);
await loadTerms();
render();
loadSections();
