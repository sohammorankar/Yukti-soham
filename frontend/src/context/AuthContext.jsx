import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, object=user
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.access_token) localStorage.setItem("yc_token", data.access_token);
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      if (data.access_token) localStorage.setItem("yc_token", data.access_token);
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore logout errors */ }
    localStorage.removeItem("yc_token");
    setUser(false);
  };

  const isAdmin = !!(user && user.roles && user.roles.length);
  const isAuthed = !!(user && user.email);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, isAdmin, isAuthed }}>
      {children}
    </AuthContext.Provider>
  );
}
