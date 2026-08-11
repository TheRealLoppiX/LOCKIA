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
  forgotPassword: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface DecodedToken {
  sub: string;
  name: string;
  email: string;
  avatar_url?: string;
  exp: number;
}

function userFromToken(token: string): User {
  const decoded: DecodedToken = jwtDecode(token);
  return { id: decoded.sub, name: decoded.name, email: decoded.email, avatar_url: decoded.avatar_url };
}

function isTokenExpired(token: string): boolean {
  try {
    const decoded: DecodedToken = jwtDecode(token);
    return !decoded.exp || decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Handoff de sessão vindo do LOCK (card "LOCKIA" no dashboard) — o token
    // chega no fragmento da URL (ex: #token=eyJ...), nunca numa query string,
    // porque fragmentos não são enviados ao servidor nem aparecem em logs/
    // Referer. Some da barra de endereço assim que aplicado.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const handoffToken = hashParams.get('token');
    if (handoffToken) {
      // Limpa a URL sempre que houver um token no fragmento, mesmo se ele já
      // estiver expirado — senão o JWT (com nome/e-mail decodificáveis) fica
      // exposto na barra de endereço/histórico do navegador indefinidamente.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (!isTokenExpired(handoffToken)) {
        applySession(handoffToken);
        setLoading(false);
        return;
      }
    }

    const storedUser = localStorage.getItem('lockia-user');
    const storedToken = localStorage.getItem('lockia-token');
    if (storedUser && storedToken) {
      try {
        if (isTokenExpired(storedToken)) {
          throw new Error('token expirado');
        }
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        localStorage.removeItem('lockia-user');
        localStorage.removeItem('lockia-token');
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // O e-mail de redefinição sempre aponta pro LOCK-FRONT (é lá que existe a
  // tela de "crie uma nova senha" com o token) — mesmo pedido feito a partir
  // do LOCKIA, já que é a mesma conta/backend.
  const forgotPassword = async (email: string) => {
    const response = await fetch(`${LOCK_API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível enviar o link.');
    }
  };

  const logout = (reason?: 'expired') => {
    localStorage.removeItem('lockia-user');
    localStorage.removeItem('lockia-token');
    setUser(null);
    setToken(null);
    if (reason === 'expired') {
      // Lido pela tela de login (Home.tsx) pra mostrar um aviso — some da
      // sessionStorage assim que lido, então só aparece uma vez.
      sessionStorage.setItem('lockia-session-expired', '1');
    }
    navigate('/login');
  };

  // Um 401 em qualquer chamada ao LOCKIA-API (ver api.ts) dispara este
  // evento — sem isso, o usuário ficava "logado" na UI vendo só uma bolha de
  // erro no chat, sem nenhuma ação clara pra recuperar a sessão.
  useEffect(() => {
    const handleExpired = () => logout('expired');
    window.addEventListener('lockia:session-expired', handleExpired);
    return () => window.removeEventListener('lockia:session-expired', handleExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user && !!token, loading, login, register, forgotPassword, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
