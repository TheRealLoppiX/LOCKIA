import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// LOCKIA não tem cadastro de usuário próprio — é a mesma conta do LOCK. Login
// e registro chamam o LOCK-API diretamente (cross-origin); o token resultante
// (assinado com o mesmo APP_JWT_SECRET) é aceito pelo LOCKIA-API sem
// nenhuma ponte de SSO.
const LOCK_API_URL = process.env.REACT_APP_LOCK_API_URL || 'http://localhost:3333';

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface DecodedToken {
  sub: string;
  name: string;
  email: string;
  avatar_url?: string;
}

function userFromToken(token: string): User {
  const decoded: DecodedToken = jwtDecode(token);
  return { id: decoded.sub, name: decoded.name, email: decoded.email, avatar_url: decoded.avatar_url };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('lockia-user');
    const storedToken = localStorage.getItem('lockia-token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const applySession = (receivedToken: string) => {
    const userData = userFromToken(receivedToken);
    localStorage.setItem('lockia-user', JSON.stringify(userData));
    localStorage.setItem('lockia-token', receivedToken);
    setUser(userData);
    setToken(receivedToken);
    navigate('/chat');
  };

  const login = async (identifier: string, password: string) => {
    const response = await fetch(`${LOCK_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.token) {
      throw new Error(data.message || 'E-mail ou senha inválidos.');
    }
    applySession(data.token);
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await fetch(`${LOCK_API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.token) {
      throw new Error(data.message || 'Não foi possível criar a conta.');
    }
    applySession(data.token);
  };

  const logout = () => {
    localStorage.removeItem('lockia-user');
    localStorage.removeItem('lockia-token');
    setUser(null);
    setToken(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user && !!token, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
