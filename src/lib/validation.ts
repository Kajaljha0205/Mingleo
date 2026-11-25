export const FIRST_NAME_MAX = 40;
export const BIO_MAX = 150;
export const MIN_AGE = 18;

export function validateFirstName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 1) return "Enter your first name.";
  if (name.length > FIRST_NAME_MAX) return `Use ${FIRST_NAME_MAX} characters or fewer.`;
  return null;
}

export function validateBio(raw: string): string | null {
  return raw.trim().length > BIO_MAX ? `Use ${BIO_MAX} characters or fewer.` : null;
}

/** Formats typed digits as "DD / MM / YYYY". */
export function formatBirthdayInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(" / ");
}

/** Parses "DD / MM / YYYY" to ISO "YYYY-MM-DD", or null if not a real date. */
export function parseBirthday(raw: string): string | null {
  const m = raw.replace(/\s/g, "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Same rule as the database: birth date ≤ today minus 18 years (29 Feb → 28 Feb). */
export function isAdult(isoBirthDate: string, today: Date = new Date()): boolean {
  const y = today.getFullYear() - MIN_AGE;
  const m = today.getMonth() + 1;
  const d = Math.min(today.getDate(), daysInMonth(y, m));
  const cutoff = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isoBirthDate <= cutoff;
}

export function ageFrom(isoBirthDate: string, today: Date = new Date()): number {
  const [y, m, d] = isoBirthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export function validateBirthday(raw: string, today: Date = new Date()): string | null {
  const iso = parseBirthday(raw);
  if (!iso) return "Enter a real date as DD / MM / YYYY.";
  if (iso > today.toISOString().slice(0, 10)) return "Enter a real date as DD / MM / YYYY.";
  if (!isAdult(iso, today)) return UNDERAGE_MESSAGE;
  return null;
}

export const UNDERAGE_MESSAGE = "You need to be 18 or older to use Mingleo.";

/** ISO birth date when the input is a real past date under 18, else null. */
export function underageBirthDate(raw: string, today: Date = new Date()): string | null {
  const iso = parseBirthday(raw);
  if (!iso || iso > today.toISOString().slice(0, 10)) return null;
  return isAdult(iso, today) ? null : iso;
}

export function isoToBirthdayInput(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} / ${m} / ${y}`;
}
