import type { CSSProperties } from "react";

const COLOR_MAP: Record<string, string> = {
  black: "#111827",
  den: "#111827",
  "đen": "#111827",
  white: "#ffffff",
  trang: "#ffffff",
  "trắng": "#ffffff",
  gray: "#9ca3af",
  grey: "#9ca3af",
  xam: "#9ca3af",
  "xám": "#9ca3af",
  blue: "#2563eb",
  xanh: "#2563eb",
  red: "#dc2626",
  do: "#dc2626",
  "đỏ": "#dc2626",
  pink: "#ec4899",
  hong: "#ec4899",
  "hồng": "#ec4899",
  beige: "#d6c3a5",
  be: "#d6c3a5",
  cream: "#f5f5dc",
  kem: "#f5f5dc",
  brown: "#92400e",
  nau: "#92400e",
  "nâu": "#92400e",
};

export function formatCurrency(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")}đ`;
}

export function formatShortDate(value?: string | Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function getColorSwatchStyle(color: string): CSSProperties {
  const key = color.trim().toLowerCase();
  const background = COLOR_MAP[key] ?? COLOR_MAP[key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? key;
  return {
    background,
  };
}
