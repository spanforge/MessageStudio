/** Resolve a wall-clock datetime without choosing either side of a DST overlap. */
export function localDateTimeInstants(date: string, time: string, timeZone: string): string[] {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) return [];
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  const localStamp = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type,p.value]));
    return Date.parse(`${parts.year.padStart(4,'0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  };
  const offsets = new Set<number>();
  // Sample both sides of date-line/DST transitions, including half-hour changes.
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours*3600000;
    offsets.add(localStamp(sample)-sample);
  }
  return [...offsets].map(offset => wall-offset).filter(instant => localStamp(instant) === wall).sort((a,b) => a-b).map(instant => new Date(instant).toISOString());
}
