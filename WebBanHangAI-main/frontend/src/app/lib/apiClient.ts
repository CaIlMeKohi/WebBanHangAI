export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export async function apiGet<T>(path: string, withAuth = true): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: withAuth ? authHeaders() : {},
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  withAuth = true,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: jsonHeaders(withAuth),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
}

export async function apiPostMultipart<T>(
  path: string,
  body: FormData,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function apiPutMultipart<T>(
  path: string,
  body: FormData,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

export function authHeaders(): HeadersInit {
  try {
    const sessions = ["siteAuth", "adminAuth"]
      .map((key) => readStoredSession(key))
      .filter((session): session is StoredSession => Boolean(session));
    const isAdminArea =
      window.location.pathname.startsWith("/portal-admin") ||
      window.location.pathname.startsWith("/staff");
    const preferred = isAdminArea
      ? sessions.find((session) => session.role === "admin" || session.role === "staff") ??
        sessions[0]
      : sessions[0];
    return preferred?.access ? { Authorization: `Bearer ${preferred.access}` } : {};
  } catch {
    return {};
  }
}

interface StoredSession {
  access: string;
  role?: string | null;
}

function readStoredSession(key: string): StoredSession | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { access?: unknown; role?: unknown };
    const access =
      typeof parsed.access === "string" && parsed.access.trim()
        ? parsed.access.trim()
        : "";
    if (!access) return null;
    return {
      access,
      role: typeof parsed.role === "string" ? parsed.role : null,
    };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function jsonHeaders(withAuth = true): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(withAuth ? authHeaders() : {}),
  };
}

async function buildApiError(response: Response): Promise<Error> {
  try {
    const data = await response.json();
    const detail = data.detail ?? Object.values(data).flat().join(" ");
    if (isInvalidAuthResponse(response.status, detail)) {
      clearStoredSessions();
      return new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
    }
    return new Error(detail || `API error ${response.status}`);
  } catch {
    return new Error(`API error ${response.status}`);
  }
}

function isInvalidAuthResponse(status: number, detail: unknown) {
  if (![401, 403].includes(status)) return false;
  const message = String(detail ?? "").toLowerCase();
  return (
    message.includes("token") ||
    message.includes("phien") ||
    message.includes("phiên") ||
    message.includes("dang nhap") ||
    message.includes("đăng nhập") ||
    message.includes("authentication") ||
    message.includes("credentials")
  );
}

function clearStoredSessions() {
  localStorage.removeItem("siteAuth");
  localStorage.removeItem("adminAuth");
}
