// ---- Edit these ----
// Services live in index.html (the cards with data-id / data-price / data-time)
const SERVICES = [...document.querySelectorAll("#services-view .svc")].map((el) => ({
  id: el.dataset.id, name: el.dataset.name,
  price: el.dataset.price === "" ? null : +el.dataset.price, time: el.dataset.time || "",
}));
const TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00"];
const CLOSED_DAYS = [0]; // 0 = Sunday
// --------------------

// Storage: browser localStorage (swap load/save for your backend later)
const KEY = "detailing.bookings";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => "$" + Number(n).toLocaleString();
const names = (ids) => ids.map((i) => (SERVICES.find((s) => s.id === i) || { name: i }).name).join(", ");

let tab = "services", sel = new Set(), done = null, openId = null, openClient = null;

function render() {
  $("#nav").innerHTML = [["services", "Services"], ["book", "Book"], ["jobs", "Bookings"], ["clients", "Clients"]]
    .map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-t="${k}">${l}</button>`).join("");
  document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; done = null; render(); }));
  const isS = tab === "services";
  $("#services-view").hidden = !isS; $("#app").hidden = isS;
  ({ services: viewServices, book: viewBook, jobs: viewJobs, clients: viewClients })[tab]();
}

// ---------- Services tab (static cards in index.html) ----------
function viewServices() {
  document.querySelectorAll("#services-view .svc").forEach((el, i) => {
    const sv = SERVICES[i], on = sel.has(sv.id);
    el.classList.toggle("sel", on);
    el.querySelector(".pick").textContent = on ? "✓ Added" : "+ Add to booking";
    el.querySelector("[data-out=price]").innerHTML = sv.price != null ? money(sv.price) : "&nbsp;";
    el.querySelector("[data-out=time]").innerHTML = sv.time || "&nbsp;";
  });
  $("#svc-total").textContent = total() ? money(total()) : "—";
}
document.querySelectorAll("#services-view .svc").forEach((el) => (el.onclick = () => {
  const id = el.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); viewServices();
}));
$("#next").onclick = () => { tab = "book"; render(); };

// ---------- Book tab: calendar request slot ----------
const form = {};
let calMonth = new Date(); calMonth.setDate(1);
let selDate = "", selTime = "";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const taken = (date, time) => load().some((j) => j.date === date && j.time === time && j.status !== "cancelled");

function calendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const today = iso(new Date());
  let cells = "";
  for (let i = 0; i < first; i++) cells += `<span></span>`;
  for (let d = 1; d <= days; d++) {
    const dt = iso(new Date(y, m, d)), off = dt <= today || CLOSED_DAYS.includes(new Date(y, m, d).getDay());
    cells += `<button class="day ${dt === selDate ? "on" : ""}" data-d="${dt}" ${off ? "disabled" : ""}>${d}</button>`;
  }
  return `<div class="cal"><div class="calh"><button class="btn s" id="prev">‹</button><b>${calMonth.toLocaleString("default", { month: "long", year: "numeric" })}</b><button class="btn s" id="nxt">›</button></div>
    <div class="dow">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<span>${x}</span>`).join("")}</div><div class="days">${cells}</div></div>`;
}

function viewBook() {
  if (done) {
    $("#app").innerHTML = `<div class="ok"><h2 class="s">Request sent, ${esc(done.name)}.</h2><p>Requested slot: ${esc(done.date)} at ${esc(done.time)}${done.total ? " — " + money(done.total) : ""}. We'll confirm shortly.</p><button class="btn" id="ics">Add to my calendar</button> <button class="btn" id="again">Book another</button></div>`;
    $("#ics").onclick = () => downloadIcs(done);
    $("#again").onclick = () => { done = null; sel.clear(); selDate = selTime = ""; Object.keys(form).forEach((k) => delete form[k]); render(); };
    return;
  }
  $("#app").innerHTML = `
  <section class="hero"><div><div class="eyebrow">Book</div><h1>Request a slot.</h1></div></section>
  <div class="panel" style="margin-top:0"><div class="mono">1 / Services</div>
    <div style="margin-top:10px">${SERVICES.map((s) => `<label class="chk"><input type="checkbox" data-s="${s.id}" ${sel.has(s.id) ? "checked" : ""}> ${s.name} <span class="mu">${s.price != null ? "— " + money(s.price) : ""}${s.time ? " · " + s.time : ""}</span></label>`).join("")}</div></div>
  <div class="panel"><div class="mono">2 / Date & time</div><div class="f" style="margin-top:12px"><div>${calendar()}</div>
    <div><div class="mono" style="margin-top:6px">${selDate ? "Slots on " + selDate : "Select a date"}</div><div class="slots">${selDate ? TIMES.map((t) => `<button class="slot ${t === selTime ? "on" : ""}" data-t="${t}" ${taken(selDate, t) ? "disabled" : ""}>${t}${taken(selDate, t) ? " · taken" : ""}</button>`).join("") : ""}</div></div></div></div>
  <div class="panel"><div class="mono">3 / Your details</div><div class="f">
    ${[["name", "Name"], ["phone", "Phone"], ["email", "Email"], ["veh", "Vehicle (year, make, model)"]].map(([k, l]) => `<div><label>${l}</label><input data-f="${k}" value="${esc(form[k] || "")}"></div>`).join("")}
  </div><label>Notes</label><textarea rows="2" data-f="notes">${esc(form.notes || "")}</textarea>
  <div class="bar"><div><div class="mono">Total</div><div class="price">${total() ? money(total()) : "—"}</div></div><button class="btn" id="go">Request slot</button></div><div class="err" id="err"></div></div>`;
  document.querySelectorAll("[data-s]").forEach((e) => (e.onchange = () => { e.checked ? sel.add(e.dataset.s) : sel.delete(e.dataset.s); viewBook(); }));
  document.querySelectorAll("[data-f]").forEach((e) => (e.oninput = () => (form[e.dataset.f] = e.value)));
  document.querySelectorAll(".day").forEach((b) => (b.onclick = () => { selDate = b.dataset.d; selTime = ""; viewBook(); }));
  document.querySelectorAll(".slot").forEach((b) => (b.onclick = () => { selTime = b.dataset.t; viewBook(); }));
  $("#prev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); viewBook(); };
  $("#nxt").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); viewBook(); };
  $("#go").onclick = submit;
}
const total = () => SERVICES.filter((s) => sel.has(s.id)).reduce((a, s) => a + (s.price || 0), 0);

function submit() {
  const f = (k) => (form[k] || "").trim();
  const b = { id: "b" + Date.now(), name: f("name"), phone: f("phone"), email: f("email").toLowerCase(), vehicle: f("veh"), notes: f("notes"),
    date: selDate, time: selTime, services: [...sel], total: total(), status: "pending", jobNotes: "", before: [], after: [] };
  if (!sel.size) return ($("#err").textContent = "Choose at least one service.");
  if (!selDate || !selTime) return ($("#err").textContent = "Pick a date and time on the calendar.");
  if (!b.name || !b.vehicle || (!b.email && !b.phone)) return ($("#err").textContent = "Add name, vehicle, and a phone or email.");
  if (taken(b.date, b.time)) return ($("#err").textContent = "That slot was just taken. Pick another.");
  const all = load(); all.push(b); save(all); done = b; render();
}

// .ics file so the customer can add the request to Apple/Google/Outlook calendar
function downloadIcs(b) {
  const start = new Date(`${b.date}T${b.time}:00`), end = new Date(start.getTime() + 2 * 36e5);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `UID:${b.id}@detailbookings`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:Detail Bookings – ${names(b.services)}`, `DESCRIPTION:Requested slot (pending confirmation)`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "detail-booking.ics"; a.click();
}

// ---------- Admin: bookings + photos ----------
const photos = (a) => a.length ? `<div class="ph">${a.map((p) => `<a href="${p}" target="_blank"><img src="${p}" alt=""></a>`).join("")}</div>` : `<div class="mu">No photos yet</div>`;

function viewJobs() {
  const jobs = load().sort((a, b) => b.date.localeCompare(a.date));
  $("#app").innerHTML = `<section class="book" style="padding-top:50px"><div class="eyebrow">Admin / Bookings</div><h2 class="s" style="margin:12px 0 24px">${jobs.length} booking${jobs.length === 1 ? "" : "s"}</h2>` +
    (jobs.map((j) => {
      const o = openId === j.id;
      return `<div class="card"><div class="row"><div><b>${esc(j.name)}</b> · ${esc(j.vehicle)}<div class="mu">${esc(j.date)} ${esc(j.time)} · ${esc(names(j.services))}</div></div><div><span class="tag ${j.status}">${j.status}</span> <b>${money(j.total)}</b></div></div>
      <div style="margin-top:10px"><button class="btn s" data-open="${j.id}">${o ? "Close" : "Open job"}</button></div>
      ${o ? `<div style="margin-top:12px"><div class="mu">${esc(j.phone)} ${esc(j.email)}${j.notes ? " · " + esc(j.notes) : ""}</div>
        <div class="f"><div><label>Status</label><select data-st="${j.id}">${["pending", "confirmed", "completed", "cancelled"].map((s) => `<option ${s === j.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div><label>Final price</label><input type="number" data-pr="${j.id}" value="${j.total}"></div></div>
        <label>Job notes</label><textarea rows="2" data-jn="${j.id}">${esc(j.jobNotes)}</textarea>
        <div class="ba"><div><div class="mono">Before</div>${photos(j.before)}<input type="file" accept="image/*" multiple data-up="before" data-id="${j.id}"></div>
        <div><div class="mono">After</div>${photos(j.after)}<input type="file" accept="image/*" multiple data-up="after" data-id="${j.id}"></div></div>
        <div class="mu" id="msg"></div></div>` : ""}</div>`;
    }).join("") || `<div class="card mu">No bookings yet.</div>`) + `</section>`;
  wire();
}

function update(id, fn) { const all = load(); const j = all.find((x) => x.id === id); fn(j); save(all); }

// Shrink photos so they fit in browser storage
function resize(file, max = 900) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = img.width * r; c.height = img.height * r;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.75));
    };
    img.src = URL.createObjectURL(file);
  });
}

function wire() {
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { openId = openId === b.dataset.open ? null : b.dataset.open; render(); }));
  document.querySelectorAll("[data-st]").forEach((e) => (e.onchange = () => update(e.dataset.st, (j) => (j.status = e.value))));
  document.querySelectorAll("[data-pr]").forEach((e) => (e.onchange = () => update(e.dataset.pr, (j) => (j.total = +e.value || 0))));
  document.querySelectorAll("[data-jn]").forEach((e) => (e.onchange = () => update(e.dataset.jn, (j) => (j.jobNotes = e.value))));
  document.querySelectorAll("[data-up]").forEach((e) => (e.onchange = async () => {
    const imgs = []; for (const f of e.files) imgs.push(await resize(f));
    try { update(e.dataset.id, (j) => j[e.dataset.up].push(...imgs)); render(); }
    catch { $("#msg").textContent = "Storage is full. Use a real backend for more photos."; }
  }));
}

// ---------- Admin: client history ----------
function viewClients() {
  const m = {}; load().forEach((j) => { const k = j.email || j.phone || j.name; (m[k] = m[k] || []).push(j); });
  const cl = Object.entries(m).sort((a, b) => a[1][0].name.localeCompare(b[1][0].name));
  $("#app").innerHTML = `<section class="book" style="padding-top:50px"><div class="eyebrow">Admin / Clients</div><h2 class="s" style="margin:12px 0 24px">${cl.length} client${cl.length === 1 ? "" : "s"}</h2>` +
    (cl.map(([k, js]) => {
      const spent = js.filter((j) => j.status === "completed").reduce((a, j) => a + j.total, 0), o = openClient === k;
      return `<div class="card"><div class="row cli" data-c="${esc(k)}"><div><b>${esc(js[0].name)}</b><div class="mu">${esc(js[0].phone)} ${esc(js[0].email)}</div><div class="mu">${[...new Set(js.map((j) => j.vehicle))].map(esc).join(" · ")}</div></div>
        <div style="text-align:right"><b>${js.length}</b> visit${js.length > 1 ? "s" : ""}<div class="mu">${money(spent)} paid</div></div></div>
        ${o ? js.map((j) => `<hr style="border:0;border-top:1px solid var(--ln);margin:16px 0"><div class="row"><div><b>${esc(j.date)}</b> · ${esc(names(j.services))}<div class="mu">${esc(j.jobNotes)}</div></div><span class="tag ${j.status}">${j.status}</span></div>
          ${j.before.length || j.after.length ? `<div class="ba"><div><div class="mono">Before</div>${photos(j.before)}</div><div><div class="mono">After</div>${photos(j.after)}</div></div>` : ""}`).join("") : ""}</div>`;
    }).join("") || `<div class="card mu">No clients yet.</div>`) + `</section>`;
  document.querySelectorAll("[data-c]").forEach((e) => (e.onclick = () => { openClient = openClient === e.dataset.c ? null : e.dataset.c; render(); }));
}

render();
