import React from 'react';
import { Navigate } from 'react-router-dom';
import SuperAdmin from '../pages/SuperAdmin';

const TOKEN_KEY = 'homefin_admin_session_token';
const EXPIRY_KEY = 'homefin_admin_session_expires_at';

const AdminPanelGuard: React.FC = () => {
  const [status, setStatus] = React.useState<'checking' | 'valid' | 'invalid'>('checking');

  React.useEffect(() => {
    let active = true;

    const validateSession = async () => {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const expiresAt = Number(sessionStorage.getItem(EXPIRY_KEY) || 0);

      if (!token || !expiresAt || expiresAt <= Date.now()) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EXPIRY_KEY);
        sessionStorage.removeItem('homefin_super_admin_authenticated');
        if (active) setStatus('invalid');
        return;
      }

      try {
        const response = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'verify' }),
          cache: 'no-store',
        });

        if (!response.ok) throw new Error('Sessão inválida.');
        if (active) setStatus('valid');
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EXPIRY_KEY);
        sessionStorage.removeItem('homefin_super_admin_authenticated');
        if (active) setStatus('invalid');
      }
    };

    void validateSession();
    return () => { active = false; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Verificando acesso administrativo...
      </div>
    );
  }

  if (status !== 'valid') return <Navigate to="/admin" replace />;
  return <SuperAdmin />;
};

export default AdminPanelGuard;
