const LAST_SEARCH_PREFIX = "recommendationLastSearch";

export function recommendationSearchKey(userId?: number | null) {
  return `${LAST_SEARCH_PREFIX}:${userId ?? "guest"}`;
}

export function readRecommendationSearch(userId?: number | null) {
  try {
    return localStorage.getItem(recommendationSearchKey(userId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeRecommendationSearch(
  search: string | undefined,
  userId?: number | null,
) {
  try {
    const key = recommendationSearchKey(userId);
    if (search?.trim()) {
      localStorage.setItem(key, search.trim());
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage is optional. DB interactions remain the source of truth.
  }
}
