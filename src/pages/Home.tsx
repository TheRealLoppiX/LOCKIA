import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { EnvelopeSimple, LockSimple, User, Eye, EyeSlash, Sparkle } from '@phosphor-icons/react';
import { useAuth } from '../contexts/authContext';
import HexagonBackground from '../components/HexagonBackground';
import logo from '../assets/lockia-logo.png';
import './auth.css';
import './Home.css';

const LOCK_FRONT_URL = process.env.REACT_APP_LOCK_FRONT_URL || 'https://lock-front.onrender.com';

type Mode = 'landing' | 'login' | 'register' | 'forgot' | 'verify';

const AUTH_MODE_TO_MODE: Record<string, Mode> = {
  login: 'login',
  register: 'register',
  'forgot-password': 'forgot',
  'verify-email': 'verify',
};

const MODE_TO_AUTH_MODE: Record<Mode, string | undefined> = {
  landing: undefined,
  login: 'login',
  register: 'register',
  forgot: 'forgot-password',
  verify: 'verify-email',
};

// Painel visual (logo + fundo animado) — sempre visível à esquerda; só o
// painel da direita troca de conteúdo conforme o modo.
const BrandPanel: React.FC = () => (
  <div className="home-visual">
    <img src={logo} alt="LOCKIA" className="home-logo" />
    <p>Assistente de IA especializado em cibersegurança.</p>
  </div>
);

const LandingPanel: React.FC<{ onSwitch: (mode: Mode) => void }> = ({ onSwitch }) => (
  <div className="home-form landing-form">
    <h2>Bem-vindo(a)</h2>
    <p className="auth-subtitle">Entre com a mesma conta do LOCK ou crie uma agora.</p>
    <div className="home-button-row">
      <button className="auth-submit" onClick={() => onSwitch('login')}>Entrar</button>
      <button className="auth-submit secondary" onClick={() => onSwitch('register')}>Cadastre-se</button>
    </div>
    <a href={LOCK_FRONT_URL} target="_blank" rel="noopener noreferrer" className="lock-teaser">
      <Sparkle size={14} weight="fill" /> Experimente também o LOCK
    </a>
  </div>
);

const LoginPanel: React.FC<{ onSwitch: (mode: Mode) => void; onNeedsVerification: (email: string) => void }> = ({ onSwitch, onNeedsVerification }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Lido uma única vez (e removido) — setado pelo authContext quando um 401
  // desloga o usuário automaticamente, pra explicar por que ele voltou pro
  // login em vez de deixá-lo achando que só "caiu" sem motivo.
  const [sessionExpired] = useState(() => {
    const flagged = sessionStorage.getItem('lockia-session-expired');
    if (flagged) sessionStorage.removeItem('lockia-session-expired');
    return !!flagged;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        // identifier pode ser o nome de usuário, não o e-mail — a tela de
        // verificação precisa do e-mail de verdade.
        onNeedsVerification(identifier.includes('@') ? identifier : '');
      } else {
        setError(err.message || 'Erro ao entrar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="home-form">
      <h1>Entrar</h1>
      <p className="auth-subtitle">Use a mesma conta do LOCK para acessar o LOCKIA.</p>
      {sessionExpired && !error && <div className="auth-notice">Sua sessão expirou. Faça login novamente.</div>}
      {error && <div className="auth-error">{error}</div>}
      <div className="auth-field">
        <EnvelopeSimple size={18} className="auth-field-icon" />
        <input type="text" placeholder="E-mail" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      </div>
      <div className="auth-field auth-field-password">
        <LockSimple size={18} className="auth-field-icon" />
        <input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <span className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
        </span>
      </div>
      <div className="home-forgot-link">
        <button type="button" className="link-btn" onClick={() => onSwitch('forgot')}>Esqueceu a senha?</button>
      </div>
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      <div className="auth-switch">
        Não tem conta? <button type="button" className="link-btn" onClick={() => onSwitch('register')}>Cadastre-se</button>
      </div>
    </form>
  );
};

const RegisterPanel: React.FC<{ onSwitch: (mode: Mode) => void; onRegistered: (email: string) => void }> = ({ onSwitch, onRegistered }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email);
      onRegistered(email);
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="home-form">
      <h1>Criar conta</h1>
      <p className="auth-subtitle">A mesma conta funciona no LOCK e no LOCKIA. A sua senha de acesso é gerada automaticamente e enviada para o seu e-mail.</p>
      {error && <div className="auth-error">{error}</div>}
      <div className="auth-field">
        <User size={18} className="auth-field-icon" />
        <input type="text" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="auth-field">
        <EnvelopeSimple size={18} className="auth-field-icon" />
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Criando...' : 'Criar conta'}</button>
      <div className="auth-switch">
        Já tem conta? <button type="button" className="link-btn" onClick={() => onSwitch('login')}>Entrar</button>
      </div>
    </form>
  );
};

const VerifyPanel: React.FC<{ email: string; onSwitch: (mode: Mode) => void }> = ({ email, onSwitch }) => {
  const { verifyEmail, resendVerificationCode } = useAuth();
  const [emailInput, setEmailInput] = useState(email);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Preenche o campo se a tela abriu vinda do cadastro/login (prop
  // `email`), mas mantém editável — um F5 nesta tela ou acesso direto pela
  // URL /verify-email perde esse valor, já que só vive na Home.
  useEffect(() => {
    if (email) setEmailInput(email);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setLoading(true);
    try {
      await verifyEmail(emailInput, code);
    } catch (err: any) {
      setError(err.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailInput) {
      setError('Informe o seu e-mail para reenviar o código.');
      return;
    }
    setError(null);
    setResendMessage(null);
    setResending(true);
    try {
      await resendVerificationCode(emailInput);
      setResendMessage('Se a conta existir e ainda não estiver verificada, um novo código foi enviado.');
    } catch (err: any) {
      setError(err.message || 'Não foi possível reenviar o código.');
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="home-form">
      <h1>Confirme o seu e-mail</h1>
      <p className="auth-subtitle">Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por 30 minutos.</p>
      {error && <div className="auth-error">{error}</div>}
      {resendMessage && <div className="auth-notice">{resendMessage}</div>}
      <div className="auth-field">
        <EnvelopeSimple size={18} className="auth-field-icon" />
        <input type="email" placeholder="Seu e-mail" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required />
      </div>
      <div className="auth-field">
        <input
          type="text"
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
          style={{ letterSpacing: '4px', textTransform: 'uppercase' }}
        />
      </div>
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Confirmando...' : 'Confirmar'}</button>
      <div className="auth-switch">
        Não recebeu?{' '}
        <button type="button" className="link-btn" onClick={handleResend} disabled={resending}>
          {resending ? 'Enviando...' : 'Reenviar código'}
        </button>
      </div>
      <div className="auth-switch">
        <button type="button" className="link-btn" onClick={() => onSwitch('login')}>← Voltar para o login</button>
      </div>
    </form>
  );
};

const ForgotPanel: React.FC<{ onSwitch: (mode: Mode) => void }> = ({ onSwitch }) => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="home-form">
        <h1>Verifique seu e-mail</h1>
        <p className="auth-subtitle">
          Se existir uma conta com o e-mail <strong>{email}</strong>, enviamos um e-mail de confirmação seguido de uma nova senha de acesso gerada automaticamente (mesma conta dos dois produtos). Use essa senha para entrar — você pode trocá-la depois em Configurações.
        </p>
        <div className="auth-switch">
          <button type="button" className="link-btn" onClick={() => onSwitch('login')}>← Voltar para o login</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="home-form">
      <h1>Redefinir senha</h1>
      <p className="auth-subtitle">Digite seu e-mail para receber uma nova senha de acesso gerada automaticamente.</p>
      {error && <div className="auth-error">{error}</div>}
      <div className="auth-field">
        <EnvelopeSimple size={18} className="auth-field-icon" />
        <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar nova senha'}</button>
      <div className="auth-switch">
        <button type="button" className="link-btn" onClick={() => onSwitch('login')}>← Voltar para o login</button>
      </div>
    </form>
  );
};

const Home: React.FC = () => {
  const { authMode } = useParams<{ authMode?: string }>();
  const navigate = useNavigate();
  // Carrega o e-mail do cadastro/login pra tela de verificação — só vive
  // aqui (não é persistido), então um F5 na tela de verificação perde esse
  // preenchimento automático, mas o campo continua editável nesse caso.
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');

  // "/", "/login", "/register" e "/forgot-password" são todos a MESMA rota
  // (path="/:authMode?") — só o parâmetro muda, então trocar de modo não
  // remonta o componente (mesmo caso clássico de "/users/1" -> "/users/2").
  const mode: Mode | null = authMode === undefined ? 'landing' : AUTH_MODE_TO_MODE[authMode] ?? null;

  const switchMode = (next: Mode) => {
    const path = MODE_TO_AUTH_MODE[next];
    navigate(path ? `/${path}` : '/');
  };

  if (mode === null) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="home-shell">
      <HexagonBackground />
      <BrandPanel />
      <div className="home-panel">
        <div className="home-panel-card">
          <div key={mode} className="home-mode-transition">
            {mode === 'landing' && <LandingPanel onSwitch={switchMode} />}
            {mode === 'login' && (
              <LoginPanel
                onSwitch={switchMode}
                onNeedsVerification={(email) => {
                  setPendingVerifyEmail(email);
                  switchMode('verify');
                }}
              />
            )}
            {mode === 'register' && (
              <RegisterPanel
                onSwitch={switchMode}
                onRegistered={(email) => {
                  setPendingVerifyEmail(email);
                  switchMode('verify');
                }}
              />
            )}
            {mode === 'forgot' && <ForgotPanel onSwitch={switchMode} />}
            {mode === 'verify' && <VerifyPanel email={pendingVerifyEmail} onSwitch={switchMode} />}
            {mode !== 'landing' && (
              <button type="button" className="home-back-btn" onClick={() => switchMode('landing')}>← Voltar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
