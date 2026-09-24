/**
 * Minimal RFC 5545 iCalendar builder for a single event.
 */

/** Format a date as UTC basic format: 20260925T180000Z */
export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape text values (backslash, semicolon, comma, newlines). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (continuation lines start with a space). */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcsEvent(event: {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt?: Date | null;
  updatedAt?: Date;
}): string {
  // Default to a 1-hour event when no end time is set
  const end = event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000);
  const description = [event.description, event.url].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coledia//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(event.updatedAt ?? new Date())}`,
    `DTSTART:${formatIcsDate(event.startAt)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
