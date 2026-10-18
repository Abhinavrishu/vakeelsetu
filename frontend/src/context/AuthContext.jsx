import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuthUser, getAuthUser, setAuthUser } from "../utils/authStorage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => getAuthUser());

  useEffect(() => {
    if (session) {
      setAuthUser(session);
    } else {
      clearAuthUser();
    }
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    accessToken: session?.accessToken || null,
    refreshToken: session?.refreshToken || null,
    isAuthenticated: Boolean(session?.user),
    isLawyer: session?.user?.role === "lawyer",
    login: (nextSession) => setSession(nextSession),
    updateUser: (updatedUser) => setSession((current) => current ? { ...current, user: updatedUser } : current),
    logout: () => setSession(null),
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
