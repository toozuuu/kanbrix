import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import { api } from "../lib/api";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, invitationToken?: string) => Promise<void>;
  register: (name: string, email: string, password: string, invitationToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string, invitationToken?: string) => {
    const res = await api.auth.login({ email, password, invitation_token: invitationToken });
    if (res.joined_workspace_id) localStorage.setItem("rusttrack-active-workspace", res.joined_workspace_id);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string, invitationToken?: string) => {
    const res = await api.auth.register({ name, email, password, invitation_token: invitationToken });
    if (res.joined_workspace_id) localStorage.setItem("rusttrack-active-workspace", res.joined_workspace_id);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
