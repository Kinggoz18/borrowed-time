const WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** Prose spells out 1 to 12 and uses digits above. */
export const numWord = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 12 ? WORDS[n] : String(n));
export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
