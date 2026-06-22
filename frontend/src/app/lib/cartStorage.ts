export interface StoredCartItem {
  id: string;
  quantity: number;
  size: string;
  color: string;
}

const CART_STORAGE_KEY = "shopCartItems";
export const CART_UPDATED_EVENT = "cart:updated";

export function readStoredCart(): StoredCartItem[] {
  try {
    const rawValue = localStorage.getItem(CART_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as StoredCartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredCart(items: StoredCartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addStoredCartItem(nextItem: StoredCartItem) {
  const currentItems = readStoredCart();
  const existingItem = currentItems.find(
    (item) =>
      item.id === nextItem.id &&
      item.size === nextItem.size &&
      item.color === nextItem.color,
  );

  const nextItems = existingItem
    ? currentItems.map((item) =>
        item === existingItem
          ? { ...item, quantity: item.quantity + nextItem.quantity }
          : item,
      )
    : [...currentItems, nextItem];

  writeStoredCart(nextItems);
}
