import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { CART_ADDED_MESSAGE, CART_NOTICE_EVENT } from "../lib/cartNotice";

export function Root() {
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;

    const handleNotice = (event: Event) => {
      const detailMessage =
        (event as CustomEvent<{ message?: string }>).detail?.message ??
        CART_ADDED_MESSAGE;

      setNoticeMessage(detailMessage);

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        setNoticeMessage(null);
      }, 1600);
    };

    window.addEventListener(CART_NOTICE_EVENT, handleNotice);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener(CART_NOTICE_EVENT, handleNotice);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {noticeMessage && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-neutral-900 px-6 py-4 text-sm font-medium text-white shadow-xl">
          {noticeMessage}
        </div>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
