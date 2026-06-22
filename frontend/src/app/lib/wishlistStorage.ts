export const WISHLIST_STORAGE_KEY = "shopWishlistProductIds";
export const WISHLIST_UPDATED_EVENT = "wishlist:updated";

export function readStoredWishlistIds(): string[] {
  try {
    const rawValue = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasStoredWishlistIds(): boolean {
  return localStorage.getItem(WISHLIST_STORAGE_KEY) !== null;
}

export function writeStoredWishlistIds(ids: string[]) {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(WISHLIST_UPDATED_EVENT));
}

export function addStoredWishlistId(productId: string) {
  const currentIds = readStoredWishlistIds();
  if (currentIds.includes(productId)) {
    return;
  }
  writeStoredWishlistIds([...currentIds, productId]);
}

export function removeStoredWishlistId(productId: string) {
  const currentIds = readStoredWishlistIds();
  writeStoredWishlistIds(currentIds.filter((id) => id !== productId));
}
