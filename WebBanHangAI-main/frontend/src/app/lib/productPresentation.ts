const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatShortDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return dateFormatter.format(parsedDate);
}

export function getColorSwatchStyle(color: string) {
  const normalizedColor = normalizeLabel(color);

  if (normalizedColor.includes("trang")) {
    return { backgroundColor: "#ffffff" };
  }
  if (normalizedColor.includes("den")) {
    return { backgroundColor: "#000000" };
  }
  if (normalizedColor.includes("xam")) {
    return { backgroundColor: "#9ca3af" };
  }
  if (normalizedColor.includes("be")) {
    return { backgroundColor: "#f5f5dc" };
  }
  if (normalizedColor.includes("kem")) {
    return { backgroundColor: "#fffdd0" };
  }
  if (normalizedColor.includes("navy")) {
    return { backgroundColor: "#000080" };
  }
  if (normalizedColor.includes("xanh")) {
    return { backgroundColor: "#3b82f6" };
  }
  if (normalizedColor.includes("nau")) {
    return { backgroundColor: "#c19a6b" };
  }
  if (normalizedColor.includes("cat")) {
    return { backgroundColor: "#c2b280" };
  }

  return { backgroundColor: "#e5e7eb" };
}
