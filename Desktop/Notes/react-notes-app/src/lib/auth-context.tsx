import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface User {
  id: number;
  name: string;
  isAdmin?: boolean;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: User | null;
  signIn: (name: string, passcode: string) => Promise<void>;
  signUp: (name: string) => Promise<string>;
  signOut: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getToken(): string | null {
  return localStorage.getItem("token");
}

function getUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getToken);
  const [user, setUser] = useState<User | null>(getUser);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  // Re-fetch the user profile on mount so isAdmin always reflects the DB.
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data.user ?? data);
      })
      .catch(() => {/* ignore network errors — keep cached user */});
  }, [token]);

  const signIn = useCallback(async (name: string, passcode: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passcode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Invalid credentials");
    }
    const data = await res.json();
    localStorage.removeItem(`notes-${data.user.id}`);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const signUp = useCallback(async (name: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Registration failed");
    }
    const data = await res.json();
    // Don't set token/user here — let the user see the passcode first,
    // then sign in explicitly via signIn().
    return data.passcode as string;
  }, []);

  const signOut = useCallback(() => {
    // clear user-scoped caches so a fresh login re-fetches from the backend
    if (user) {
      localStorage.removeItem(`notes-${user.id}`);
    }
    setToken(null);
    setUser(null);
  }, [user]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: !!token, user, signIn, signUp, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
