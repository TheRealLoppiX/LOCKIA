import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/authContext';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/chat" replace /> : children;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Uma rota só pras 4 variantes da home — são a MESMA instância de
        componente por baixo (só o parâmetro muda), então trocar de modo
        não remonta a página. Ver Home.tsx. */}
    <Route path="/:authMode?" element={<PublicOnlyRoute><Home /></PublicOnlyRoute>} />
    <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
