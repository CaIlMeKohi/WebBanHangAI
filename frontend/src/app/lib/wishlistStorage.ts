export const WISHLIST_STORAGE_KEY = "shopWishlistProductIds";
export const WISHLIST_UPDATED_EVENT = "wishlist:updated";

function wishlistStorageKey(userId?: number | string | null) {
  return userId ? `${WISHLIST_STORAGE_KEY}:${userId}` : WISHLIST_STORAGE_KEY;
}

function parseWishlistIds(rawValue: string | null): string[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function migrateLegacyWishlist(userId?: number | string | null): string[] {
  if (!userId) {
    return parseWishlistIds(localStorage.getItem(WISHLIST_STORAGE_KEY));
  }

  const scopedKey = wishlistStorageKey(userId);
  const scopedRawValue = localStorage.getItem(scopedKey);
  if (scopedRawValue !== null) {
    return parseWishlistIds(scopedRawValue);
  }

  const legacyIds = parseWishlistIds(localStorage.getItem(WISHLIST_STORAGE_KEY));
  if (legacyIds.length > 0) {
    localStorage.setItem(scopedKey, JSON.stringify(legacyIds));
  }
  return legacyIds;
}

export function readStoredWishlistIds(userId?: number | string | null): string[] {
  return migrateLegacyWishlist(userId);
}

export function hasStoredWishlistIds(userId?: number | string | null): boolean {
  const scopedKey = wishlistStorageKey(userId);
  if (localStorage.getItem(scopedKey) !== null) {
    return true;
  }
  return !userId && localStorage.getItem(WISHLIST_STORAGE_KEY) !== null;
}

export function writeStoredWishlistIds(
  ids: string[],
  userId?: number | string | null,
) {
  localStorage.setItem(wishlistStorageKey(userId), JSON.stringify(ids));
  window.dispatchEvent(new Event(WISHLIST_UPDATED_EVENT));
}

export function addStoredWishlistId(
  productId: string,
  userId?: number | string | null,
) {
  const currentIds = readStoredWishlistIds(userId);
  if (currentIds.includes(productId)) {
    return;
  }
  writeStoredWishlistIds([...currentIds, productId], userId);
}

export function removeStoredWishlistId(
  productId: string,
  userId?: number | string | null,
) {
  const currentIds = readStoredWishlistIds(userId);
  writeStoredWishlistIds(
    currentIds.filter((id) => id !== productId),
    userId,
  );
}
