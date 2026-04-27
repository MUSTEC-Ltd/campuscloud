import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { logout as apiLogout } from '../api/auth';
import { clearAllInstances } from '../api/instances';
import { isDemoMode, disableDemoMode } from '../api/mock-seed';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('cc_token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_user') || 'null');
    } catch {
      return null;
    }
  });
  const [demoMode, setDemoMode] = useState(() => isDemoMode());

  const loginCtx = useCallback((accessToken, userData, demo = false) => {
    setToken(accessToken);
    setUser(userData);
    setDemoMode(demo);
    localStorage.setItem('cc_token', accessToken);
    localStorage.setItem('cc_user', JSON.stringify(userData));
  }, []);

  const logoutCtx = useCallback(async () => {
    await apiLogout();
    disableDemoMode();
    setToken(null);
    setUser(null);
    setDemoMode(false);
    localStorage.removeItem('cc_token');
    localStorage.removeItem('cc_user');
    clearAllInstances();
  }, []);

  // When http.js silently refreshes the access token it writes to localStorage.
  // Pick up the new value so protected API calls use the fresh token.
  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem('cc_token');
      if (stored && stored !== token) setToken(stored);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [token]);

  // Force logout when a refresh attempt fails (session fully expired)
  useEffect(() => {
    const handler = () => logoutCtx();
    window.addEventListener('cc:sessionexpired', handler);
    return () => window.removeEventListener('cc:sessionexpired', handler);
  }, [logoutCtx]);

  return (
    <AuthContext.Provider
      value={{ token, user, demoMode, login: loginCtx, logout: logoutCtx, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
