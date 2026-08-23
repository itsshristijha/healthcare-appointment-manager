import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ham_token');
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('ham_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password, expectedRole) {
    const res = await client.post('/auth/login', { email, password, expectedRole });
    localStorage.setItem('ham_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  async function completeGoogleLogin(token) {
    localStorage.setItem('ham_token', token);
    const res = await client.get('/auth/me');
    setUser(res.data.user);
    return res.data.user;
  }

  async function register(name, email, password, phone) {
    const res = await client.post('/auth/register', { name, email, password, phone });
    localStorage.setItem('ham_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem('ham_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, completeGoogleLogin, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
