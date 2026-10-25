export const CITY_NAMES = { delhi: "Dew Nelhi", paris: "Arisp" } as const;

/** Fictional display names; geographic source identifiers remain unchanged. */
export function placeName(label: string): string {
  if (label === "New Delhi" || label === "Delhi") return CITY_NAMES.delhi;
  if (label === "Paris") return CITY_NAMES.paris;
  const areas: Record<string, string> = {
    "Observatory quarter": "Clockwork quarter",
    "Republic square": "Liberty square",
    "Street approach": "Market approach",
    "Boulevard approach": "West boulevard",
  };
  if (areas[label]) return areas[label];
  const words = [...label.matchAll(/[\p{L}]+/gu)];
  if (!words.length) return label;
  const replacement = words.map((match) => match[0]);
  if (words.length > 1) {
    const first = replacement[0][0],
      second = replacement[1][0];
    replacement[0] =
      (first === first.toUpperCase()
        ? second.toUpperCase()
        : second.toLowerCase()) + replacement[0].slice(1);
    replacement[1] =
      (second === second.toUpperCase()
        ? first.toUpperCase()
        : first.toLowerCase()) + replacement[1].slice(1);
  } else {
    const word = replacement[0];
    if (word.length < 3) return label;
    replacement[0] = word.slice(1) + word[0].toLowerCase();
    if (word === word.toUpperCase())
      replacement[0] = replacement[0].toUpperCase();
    else
      replacement[0] =
        replacement[0][0].toUpperCase() + replacement[0].slice(1);
  }
  let index = 0;
  return label.replace(/[\p{L}]+/gu, () => replacement[index++]);
}
