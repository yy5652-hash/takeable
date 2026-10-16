import { CITIES, allZones, browserZone, cityForZone } from "./core/cities.js";
import { DAY_NAMES, NY_TZ, describeSchedule, formatClock, formatRange, localSchedule } from "./core/time.js";
import { VERDICTS, judge } from "./core/verdict.js";
import { schoolOf } from "./core/schools.js";

const $ = (id) => document.getElementById(id);
const GROUP_ORDER = ["takeable", "check", "no"];

const STORE = { situation: "takeable.situation", starred: "takeable.starred" };

const state = {
  situation: loadStored(STORE.situation, defaultSituation, validSituation),
  terms: [],
  data: null, // sections payload for the current term
  loading: null, // { done, total } while fetching
  error: "",
  search: "",
  open: null, // class number of the section shown in the detail panel
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
  save(STORE.situation, s);
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
    ${starButtonHtml(s)}
  </li>`;
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
  if (!sections.length) {
    return `<section class="panel shortlist" aria-label="Shortlist">
      <h3>Your shortlist${termName ? ` · ${escapeHtml(termName)}` : ""}</h3>
      <p class="muted">Star sections (☆) to keep them here. Click any section to see the evidence behind its verdict.</p>
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
  return `<section class="panel shortlist" aria-label="Shortlist">
    <h3>Your shortlist${termName ? ` · ${escapeHtml(termName)}` : ""}</h3>
    <ul class="short-items">${items}</ul>
    <div class="short-total"><span>Total</span><b>${total} credits</b></div>
    <button type="button" class="primary" data-action="copy">Copy class numbers</button>
    <p class="muted small">Paste them into Albert's class search when your registration opens.</p>
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
  el.innerHTML = section ? detailHtml(section) : shortlistHtml();
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
    <div class="panel-verdict">${chipHtml(verdict)}${starButtonHtml(s, true)}</div>
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
  const star = e.target.closest('[data-action="star"]');
  if (star) {
    toggleStar(star.dataset.crn);
    $("list").querySelector(`[data-action="star"][data-crn="${star.dataset.crn}"]`)?.focus({ preventScroll: true });
    return;
  }
  const row = e.target.closest(".row");
  if (row) openSection(row.dataset.crn);
});
$("list").addEventListener("keydown", (e) => {
  if (e.target.closest("button")) return;
  const row = e.target.closest(".row");
  if (row && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openSection(row.dataset.crn);
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
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSection();
});

fillSituationControls();
await loadTerms();
render();
loadSections();
