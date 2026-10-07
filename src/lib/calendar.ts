// Calendar export for a single task: a Google Calendar link and an .ics file (Apple
// Calendar, Outlook, and most others). Times are "floating" local times, so the event
// lands at the chosen clock time in whatever calendar the person opens it in.

export interface CalendarEvent {
  id: string;
  title: string;
  details: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  minutes: number;
}

function stamp(date: string, time: string, addMinutes = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi + addMinutes));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}00`;
}

const duration = (e: CalendarEvent) => Math.max(15, e.minutes || 30);

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.date, e.time)}/${stamp(e.date, e.time, duration(e))}`,
    details: e.details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function icsFile(e: CalendarEvent): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Better Together//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}-${stamp(e.date, e.time)}@better-together`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(e.date, e.time)}`,
    `DTEND:${stamp(e.date, e.time, duration(e))}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(e.details)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(e: CalendarEvent) {
  const blob = new Blob([icsFile(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "task"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Next half hour from now (if the date is today), otherwise 9:00 AM. */
export function suggestedTime(date: string, today: string): string {
  if (date !== today) return "09:00";
  const now = new Date();
  let mins = now.getHours() * 60 + now.getMinutes();
  mins = Math.ceil((mins + 5) / 30) * 30;
  if (mins > 21 * 60) mins = 21 * 60;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
