import { createContext, useContext, useEffect, useState } from "react";

type AuthRole = "admin" | "user" | null;

interface RegisteredUser {
  username: string;
  password: string;
  role: "user";
}

interface AuthContextType {
  isLoggedIn: boolean;
  username: string | null;
  role: AuthRole;
  login: (username: string, password: string) => boolean;
  register: (
    username: string,
    password: string,
  ) => {
    success: boolean;
    error?: string;
  };
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

  // Check localStorage on mount
  useEffect(() => {
    const savedAuth =
      localStorage.getItem(AUTH_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (!savedAuth) {
      return;
    }

    const { username, role } = JSON.parse(savedAuth) as {
      username?: string;
      role?: AuthRole;
    };

    setUsername(username ?? null);
    setRole(role ?? null);
    setIsLoggedIn(Boolean(username));
  }, []);

  const login = (inputUsername: string, inputPassword: string): boolean => {
    const matchedUser = readRegisteredUsers().find(
      (user) =>
        user.username === inputUsername && user.password === inputPassword,
    );

    const matchedRole: AuthRole =
      inputUsername === AUTH_CREDENTIALS.admin.username &&
      inputPassword === AUTH_CREDENTIALS.admin.password
        ? "admin"
        : inputUsername === AUTH_CREDENTIALS.user.username &&
            inputPassword === AUTH_CREDENTIALS.user.password
          ? "user"
          : matchedUser
            ? matchedUser.role
            : null;

    if (matchedRole) {
      setUsername(inputUsername);
      setRole(matchedRole);
      setIsLoggedIn(true);
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ username: inputUsername, role: matchedRole }),
      );
      return true;
    }
    return false;
  };

  const register = (inputUsername: string, inputPassword: string) => {
    const normalizedUsername = inputUsername.trim();

    if (normalizedUsername.length < 3) {
      return { success: false, error: "Tên đăng nhập phải có ít nhất 3 ký tự" };
    }

    if (inputPassword.length < 3) {
      return { success: false, error: "Mật khẩu phải có ít nhất 3 ký tự" };
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

    const newUser: RegisteredUser = {
      username: normalizedUsername,
      password: inputPassword,
      role: "user",
    };

    const nextUsers = [...users, newUser];
    writeRegisteredUsers(nextUsers);
    setUsername(newUser.username);
    setRole(newUser.role);
    setIsLoggedIn(true);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ username: newUser.username, role: newUser.role }),
    );

    return { success: true };
  };

  const logout = () => {
    setUsername(null);
    setRole(null);
    setIsLoggedIn(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, username, role, login, register, logout }}
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
