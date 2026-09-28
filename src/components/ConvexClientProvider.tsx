"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://dummy-preview.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

interface AuthUser {
  email: string;
  name: string;
  id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, name?: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load local session if present
    const saved = localStorage.getItem("leancanvas_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, name?: string) => {
    const newUser = {
      email,
      name: name || email.split("@")[0],
    };
    setUser(newUser);
    localStorage.setItem("leancanvas_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("leancanvas_user");
  };

  return (
    <ConvexProvider client={convex}>
      <AuthContext.Provider value={{ user, login, logout, isLoading }}>
        {children}
      </AuthContext.Provider>
    </ConvexProvider>
  );
}
