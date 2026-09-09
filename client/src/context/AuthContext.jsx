import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
const Auth = createContext();
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("kra-token")) return setReady(true);
    api
      .get("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem("kra-token"))
      .finally(() => setReady(true));
  }, []);
  const login = (session) => {
    if (!session?.token || !session?.user) {
      throw new Error(
        "La réponse de connexion est invalide. Vérifiez que l'API de production renvoie bien un token.",
      );
    }
    const { token, user } = session;
    localStorage.setItem("kra-token", token);
    setUser(user);
  };
  const logout = () => {
    localStorage.removeItem("kra-token");
    setUser(null);
  };
  return (
    <Auth.Provider value={{ user, ready, login, logout }}>
      {children}
    </Auth.Provider>
  );
}
