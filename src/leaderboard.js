export const MAX_ENTRIES = 10;
const NAME_RE = /^[\p{Script=Latin}0-9_]{3,12}$/u;

export function validateName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').trim();
  if ([...name].length < 3 || [...name].length > 12) return null;
  return NAME_RE.test(name) ? name : null;
}

export function isoWithOffset(date = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map((x) => x.e)
    .slice(0, MAX_ENTRIES);
}

export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  const n = validateName(name);
  if (!n) throw new Error('name must be 3-12 characters: letters (Vietnamese allowed), digits, _');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be a non-negative integer');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0-3');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  return { name: n, score, nights_won, achieved_at: isoWithOffset(now), seed };
}

export function addEntry(entries, entry) {
  return sortEntries([...entries, entry]);
}
