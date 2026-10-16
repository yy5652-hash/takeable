import { CITIES, allZones, browserZone, cityForZone } from "./core/cities.js";
import { DAY_NAMES, NY_TZ, describeSchedule, formatClock, formatRange, localSchedule } from "./core/time.js";
import { VERDICTS, judge } from "./core/verdict.js";
import { schoolOf } from "./core/schools.js";

const $ = (id) => document.getElementById(id);
const GROUP_ORDER = ["takeable", "check", "no"];

const state = {
  situation: defaultSituation(),
  terms: [],
  data: null, // sections payload for the current term
  loading: null, // { done, total } while fetching
  error: "",
  search: "",
  open: null, // class number of the section shown in the detail panel
};

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

// ---------- Situation bar ----------

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
  render();
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
  renderSummary();
  renderList();
  renderSide();
  renderFooter();
}

function renderSummary() {
  const el = $("summary");
  if (state.loading) {
    const { done, total } = state.loading;
    el.innerHTML = `<span class="progress">${total ? `Checking ${done} of ${total} sections with NYU…` : "Asking NYU for this term's sections…"}</span>`;
    return;
  }
  if (!state.data) {
    el.innerHTML = "";
    return;
  }
  const items = judged();
  const counts = Object.fromEntries(GROUP_ORDER.map((v) => [v, items.filter((i) => i.verdict === v).length]));
  const hidden = state.data.inPersonHidden;
  el.innerHTML =
    GROUP_ORDER.map((v) => `<span class="count ${v}"><b>${counts[v]}</b> ${VERDICTS[v].label.toLowerCase()}</span>`).join("") +
    (hidden ? `<span class="count hidden-count">+ ${hidden} in-person sections hidden while you're away</span>` : "");
}

function renderList() {
  const el = $("list");
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
  el.innerHTML = GROUP_ORDER.map((v) => {
    const group = items.filter((i) => i.verdict === v).sort((a, b) => a.section.code.localeCompare(b.section.code, "en", { numeric: true }));
    if (!group.length) return "";
    return `<section class="group"><h2>${VERDICTS[v].label} · ${group.length}</h2><ul class="rows">${group.map(rowHtml).join("")}</ul></section>`;
  }).join("");
}

function rowHtml({ section: s, verdict, reasons }) {
  // The time column already shows a passing time, so the row leads with the next reason.
  const top = reasons.find((r) => !(r.kind === "time" && r.level === "pass")) || reasons[0];
  const levelClass = top.level === "pass" ? "" : top.level;
  return `<li class="row${s.crn === state.open ? " open" : ""}" tabindex="0" data-crn="${s.crn}">
    <div class="row-title"><span class="code">${escapeHtml(s.code)}</span><span class="title">${escapeHtml(s.title)}</span></div>
    <div class="reason ${levelClass}">${escapeHtml(top.text)}</div>
    <div class="when">${whenHtml(s)}</div>
    <div class="verdict">${chipHtml(verdict)}</div>
  </li>`;
}

function whenHtml(s) {
  if (!s.meetings.length) return `<div class="local">Any time</div><div class="ny">${/does not meet/i.test(s.meetsText) ? "Asynchronous" : "Time not listed"}</div>`;
  const schedule = localSchedule(s, state.situation.tz);
  const local = describeSchedule(schedule.first);
  const away = state.situation.tz !== NY_TZ;
  return `<div class="local">${escapeHtml(local)}</div>${away ? `<div class="ny">${escapeHtml(describeSchedule(schedule.first, "ny"))} New York</div>` : ""}`;
}

// ---------- Side: detail panel ----------

const LEVEL_SYMBOL = { fail: "✕", check: "?", pass: "✓" };

function renderSide() {
  const el = $("side");
  const section = state.open && state.data?.sections.find((s) => s.crn === state.open);
  document.body.classList.toggle("detail-open", Boolean(section));
  if (!section) {
    el.innerHTML = `<div class="panel hint"><p>Click any section to see the evidence behind its verdict.</p></div>`;
    return;
  }
  el.innerHTML = detailHtml(section);
}

function detailHtml(s) {
  const { verdict, reasons } = judge(s, state.situation);
  const school = schoolOf(s);
  const city = state.situation.cityLabel;
  return `<article class="panel detail" aria-label="${escapeHtml(s.code)} details">
    <header class="panel-head">
      <div>
        <div class="code">${escapeHtml(s.code)} · Section ${escapeHtml(s.section)}</div>
        <h3>${escapeHtml(s.title)}</h3>
      </div>
      <button type="button" class="icon-btn" data-action="close" aria-label="Close details">×</button>
    </header>
    <div class="panel-verdict">${chipHtml(verdict)}</div>
    <ul class="reasons">${reasons
      .map(
        (r) => `<li class="reason-item ${r.level}"><span class="mark" aria-hidden="true">${LEVEL_SYMBOL[r.level]}</span><span>${escapeHtml(r.text)}${
          r.source ? ` <a href="${r.source.url}" target="_blank" rel="noopener">Stern policy</a> <span class="checked">(checked ${escapeHtml(formatDate(r.source.checked, true))})</span>` : ""
        }</span></li>`,
      )
      .join("")}</ul>

    <h4>When it meets</h4>
    ${meetingTableHtml(s, city)}

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
    return `<p class="muted">${/does not meet/i.test(s.meetsText) ? "No set meeting times — asynchronous." : "NYU hasn't listed meeting times."}</p>`;
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
  if (!c) return "Not listed";
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

function markOpenRow() {
  document.querySelectorAll(".row.open").forEach((r) => r.classList.remove("open"));
  if (state.open) document.querySelector(`.row[data-crn="${state.open}"]`)?.classList.add("open");
}

function openSection(crn) {
  state.open = crn;
  renderSide();
  markOpenRow();
  $("side").querySelector(".icon-btn")?.focus({ preventScroll: true });
}

function closeSection() {
  if (!state.open) return;
  const crn = state.open;
  state.open = null;
  renderSide();
  markOpenRow();
  document.querySelector(`.row[data-crn="${crn}"]`)?.focus({ preventScroll: true });
}

export function chipHtml(verdict) {
  const v = VERDICTS[verdict];
  return `<span class="chip ${verdict}"><span aria-hidden="true">${v.symbol}</span>${v.label}</span>`;
}

function renderFooter() {
  const d = state.data;
  const when = d?.fetchedAt ? new Date(d.fetchedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
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
$("list").addEventListener("click", (e) => {
  const row = e.target.closest(".row");
  if (row) openSection(row.dataset.crn);
});
$("list").addEventListener("keydown", (e) => {
  const row = e.target.closest(".row");
  if (row && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openSection(row.dataset.crn);
  }
});
$("side").addEventListener("click", (e) => {
  if (e.target.closest('[data-action="close"]')) closeSection();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSection();
});

fillSituationControls();
await loadTerms();
render();
loadSections();
