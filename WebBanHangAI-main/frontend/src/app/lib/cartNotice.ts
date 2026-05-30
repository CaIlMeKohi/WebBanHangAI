export const CART_NOTICE_EVENT = "cart:notice";
export const CART_ADDED_MESSAGE = "Đã thêm hàng vào giỏ!";

export function dispatchCartAddedNotice(message: string = CART_ADDED_MESSAGE) {
  window.dispatchEvent(
    new CustomEvent(CART_NOTICE_EVENT, {
      detail: { message },
    }),
  );
}
