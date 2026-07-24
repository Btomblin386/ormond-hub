"use client";

// Universal 12-hour date/time picker. The native <input type="datetime-local">
// renders in the OS clock format — machines set to 24-hour show military time
// with no AM/PM, and there's no attribute to override it. This control owns the
// hour/minute/AM-PM rendering so every viewer sees 12-hour, on every machine.
// It speaks the same "YYYY-MM-DDTHH:mm" value the native input did, so callers
// (new Date(value), draft persistence, comparisons) are unchanged.

const pad = (n) => String(n).padStart(2, "0");

function parts(v) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(v || "");
  if (!m) return { date: "", h12: 12, min: 0, ap: "PM" }; // default shown: 12:00 PM
  const h = +m[2];
  return { date: m[1], h12: h % 12 === 0 ? 12 : h % 12, min: +m[3], ap: h >= 12 ? "PM" : "AM" };
}
function compose(date, h12, min, ap) {
  if (!date) return "";
  let h = h12 % 12;
  if (ap === "PM") h += 12;
  return `${date}T${pad(h)}:${pad(min)}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Time-only variant — replaces <input type="time"> (same OS-locale problem).
// Speaks "HH:mm" (24h) like the native input; renders 12-hour for everyone.
export function TimePicker({ value, onChange }) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || "");
  const h = m ? +m[1] : 9;
  const min = m ? +m[2] : 0;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ap = h >= 12 ? "PM" : "AM";
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  if (!minutes.includes(min)) { minutes.push(min); minutes.sort((a, b) => a - b); }
  const set = (hh12, mm, a) => { let hh = hh12 % 12; if (a === "PM") hh += 12; onChange(`${pad(hh)}:${pad(mm)}`); };
  return (
    <span className="when-picker">
      <select value={h12} onChange={(e) => set(+e.target.value, min, ap)} aria-label="Hour">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="when-colon">:</span>
      <select value={min} onChange={(e) => set(h12, +e.target.value, ap)} aria-label="Minute">
        {minutes.map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <select value={ap} onChange={(e) => set(h12, min, e.target.value)} aria-label="AM or PM">
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </span>
  );
}

export default function WhenPicker({ value, onChange, clearable = true }) {
  const { date, h12, min, ap } = parts(value);
  // 5-minute steps, plus the exact minute of an existing post so editing never snaps the time.
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  if (!minutes.includes(min)) { minutes.push(min); minutes.sort((a, b) => a - b); }
  // Changing the time before picking a date implies today — the date fills in so the value is complete.
  const set = (d, h, m, a) => onChange(compose(d, h, m, a));
  return (
    <div className="when-picker">
      <input type="date" value={date} onChange={(e) => set(e.target.value, h12, min, ap)} aria-label="Date" />
      <select value={h12} onChange={(e) => set(date || todayStr(), +e.target.value, min, ap)} aria-label="Hour">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="when-colon">:</span>
      <select value={min} onChange={(e) => set(date || todayStr(), h12, +e.target.value, ap)} aria-label="Minute">
        {minutes.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
      </select>
      <select value={ap} onChange={(e) => set(date || todayStr(), h12, min, e.target.value)} aria-label="AM or PM">
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {clearable && value && (
        <button type="button" className="when-clear" title="Clear the date & time" onClick={() => onChange("")}>×</button>
      )}
    </div>
  );
}
