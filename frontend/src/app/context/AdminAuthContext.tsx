import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, registerUser, type ApiUser } from "../lib/api";

type AuthRole = "admin" | "staff" | "user" | null;

interface RegisteredUser {
  username: string;
  password: string;
  role: "user";
  userId?: number;
}

interface AuthContextType {
  isAuthReady: boolean;
  isLoggedIn: boolean;
  username: string | null;
  role: AuthRole;
  userId: number | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (data: {
    username: string;
    password: string;
    full_name: string;
    phone?: string;
    gender?: string;
    birthday?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CREDENTIALS = {
  admin: { username: "admin", password: "123" as const },
  user: { username: "user", password: "123" as const },
};

const AUTH_STORAGE_KEY = "siteAuth";
const LEGACY_AUTH_STORAGE_KEY = "adminAuth";
const REGISTERED_USERS_STORAGE_KEY = "siteRegisteredUsers";

function readRegisteredUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RegisteredUser[]) : [];
  } catch {
    return [];
  }
}

function writeRegisteredUsers(users: RegisteredUser[]) {
  localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(users));
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const savedAuth =
      localStorage.getItem(AUTH_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (!savedAuth) {
      setIsAuthReady(true);
      return;
    }

    const { username, role, userId } = JSON.parse(savedAuth) as {
      username?: string;
      role?: AuthRole;
      userId?: number | null;
    };

    setUsername(username ?? null);
    setRole(role ?? null);
    setUserId(userId ?? null);
    setIsLoggedIn(Boolean(username));
    setIsAuthReady(true);

  }, []);

  const applyUser = (
    inputUsername: string,
    matchedRole: AuthRole,
    nextUserId?: number | null,
    access?: string | null,
  ) => {
    setUsername(inputUsername);
    setRole(matchedRole);
    setUserId(nextUserId ?? null);
    setIsLoggedIn(true);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        username: inputUsername,
        role: matchedRole,
        userId: nextUserId ?? null,
        access: access ?? null,
      }),
    );
  };

  const roleFromApiUser = (user: ApiUser): AuthRole =>
    user.role === "admin" ? "admin" : user.role === "staff" ? "staff" : "user";

  const login = async (
    inputUsername: string,
    inputPassword: string,
  ): Promise<boolean> => {
    try {
      const response = await loginUser(inputUsername, inputPassword);
      const apiUser = response.user;
      applyUser(
        apiUser.username,
        roleFromApiUser(apiUser),
        apiUser.user_id,
        response.access,
      );
      return true;
    } catch {
      // DB-backed auth is required for cart, wishlist, orders and recommendations.
    }

    return false;
  };

  const register = async (data: {
    username: string;
    password: string;
    full_name: string;
    phone?: string;
    gender?: string;
    birthday?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
  }) => {
    const inputUsername = data.username;
    const inputPassword = data.password;
    const normalizedUsername = inputUsername.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername)) {
      return { success: false, error: "Email không hợp lệ" };
    }

    if (
      inputPassword.length < 8 ||
      inputPassword.length > 64 ||
      /\s/.test(inputPassword) ||
      !/[A-Z]/.test(inputPassword) ||
      !/[a-z]/.test(inputPassword) ||
      !/\d/.test(inputPassword) ||
      !/[^A-Za-z0-9]/.test(inputPassword)
    ) {
      return {
        success: false,
        error:
          "Mật khẩu cần 8-64 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt",
      };
    }

    if (normalizedUsername === AUTH_CREDENTIALS.admin.username) {
      return { success: false, error: "Tên đăng nhập này đã được sử dụng" };
    }

    if (normalizedUsername === AUTH_CREDENTIALS.user.username) {
      return { success: false, error: "Tên đăng nhập này đã được sử dụng" };
    }

    const users = readRegisteredUsers();
    const existingUser = users.some(
      (user) => user.username === normalizedUsername,
    );

    if (existingUser) {
      return { success: false, error: "Tên đăng nhập này đã được sử dụng" };
    }

    try {
      const response = await registerUser({
        ...data,
        username: normalizedUsername,
        password: inputPassword,
      });
      const apiUser = response.user;
      const newUser: RegisteredUser = {
        username: normalizedUsername,
        password: inputPassword,
        role: "user",
        userId: apiUser.user_id,
      };

      const nextUsers = [...users, newUser];
      writeRegisteredUsers(nextUsers);
      applyUser(
        apiUser.username,
        roleFromApiUser(apiUser),
        apiUser.user_id,
        response.access,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Đăng ký thất bại",
      };
    }

    const newUser: RegisteredUser = {
      username: normalizedUsername,
      password: inputPassword,
      role: "user",
    };
    const nextUsers = [...users, newUser];
    writeRegisteredUsers(nextUsers);
    applyUser(newUser.username, newUser.role, null);

    return { success: true };
  };

  const logout = () => {
    setUsername(null);
    setRole(null);
    setUserId(null);
    setIsLoggedIn(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthReady,
        isLoggedIn,
        username,
        role,
        userId,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
