const toPositiveInteger = (value: number): number | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const integer = Math.floor(value);
  return integer > 0 ? integer : null;
};

const getFallbackLimit = (
  defaultLimit: number,
  maxLimit: number
): [number, number] => {
  const normalizedMax = toPositiveInteger(maxLimit) ?? 1;
  const normalizedDefault = toPositiveInteger(defaultLimit);
  const fallback = normalizedDefault
    ? Math.min(normalizedDefault, normalizedMax)
    : normalizedMax;

  return [fallback, normalizedMax];
};

/**
 * Parses a numeric limit query parameter, ensuring that the result is a positive
 * integer that does not exceed the provided maximum. Invalid values fall back
 * to the provided default limit.
 */
export const parseLimit = (
  value: string | null,
  defaultLimit: number,
  maxLimit: number
): number => {
  const [fallback, normalizedMax] = getFallbackLimit(defaultLimit, maxLimit);

  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);
  const positive = toPositiveInteger(parsed);
  if (!positive) {
    return fallback;
  }

  return Math.min(positive, normalizedMax);
};
