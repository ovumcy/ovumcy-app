// Russian plural helpers for day counts.
// Standard one/few/many rule repeating every hundred.
// mod10=1, mod100≠11  → "один" form  (день)
// mod10=2-4, mod100∉[12-14] → "несколько" form (дня)
// otherwise → "много" form (дней)

/**
 * Picks the one / few / many form of a Russian count noun phrase.
 * A case whose few and many forms coincide (prepositional, dative) passes the same string twice.
 */
export function ruPlural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

/** Returns one of «день» / «дня» / «дней» for a given count. */
export function ruDayWord(days: number): string {
  return ruPlural(days, "день", "дня", "дней");
}

/** Returns one of «цикл» / «цикла» / «циклов» for a given count. */
export function ruCycleWord(cycles: number): string {
  return ruPlural(cycles, "цикл", "цикла", "циклов");
}

/**
 * Genitive form used after «до» / «от»:
 *   one-form (1, 21, 31…) → «дня»
 *   few/many otherwise → «дней»
 *
 * Note: «до 24 дней», «до 25 дней» → «дней»
 *       «до 21 дня», «до 31 дня» → «дня»
 */
export function ruDayWordGenitive(days: number): string {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod10 === 1 && mod100 !== 11) {
    return "дня";
  }
  return "дней";
}
