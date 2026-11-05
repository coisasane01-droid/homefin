import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import { clearFamilySession, getFamilySessionToken, verifyFamilySession } from '../services/familyAuth';

type GuardState = 'checking' | 'valid' | 'invalid' | 'unavailable';

const FamilySessionGuard: React.FC = () => {
  const [state, setState] = useState<GuardState>('checking');
  const [retry, setRetry] = useState(0);
  const familyId = localStorage.getItem('homefin_current_family_id') || '';

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!getFamilySessionToken(familyId)) {
        setState('invalid');
        return;
      }
      setState('checking');
      try {
        const valid = await verifyFamilySession(familyId);
        if (active) setState(valid ? 'valid' : 'invalid');
      } catch (error) {
        console.error('Não foi possível validar a sessão familiar:', error);
        if (active) setState('unavailable');
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [familyId, retry]);

  if (state === 'checking') return <LoadingScreen />;
  if (state === 'valid') return <Outlet />;
  if (state === 'invalid') {
    clearFamilySession(familyId);
    return <Navigate to={`/login?family=${encodeURIComponent(familyId)}`} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-900">
      <p className="max-w-md text-gray-700 dark:text-gray-200">
        Não foi possível confirmar sua sessão no servidor. Seus dados locais foram preservados.
      </p>
      <button
        type="button"
        onClick={() => setRetry((value) => value + 1)}
        className="rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white"
      >
        Tentar novamente
      </button>
    </div>
  );
};

export default FamilySessionGuard;
