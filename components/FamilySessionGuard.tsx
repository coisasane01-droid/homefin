import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { App } from '@capacitor/app';
import LoadingScreen from './LoadingScreen';
import {
  clearFamilySession,
  getFamilySessionToken,
  verifyFamilySession,
} from '../services/familyAuth';
import {
  authenticateNativeBiometry,
  isNativeHomeFin,
} from '../services/secureSession';

type GuardState = 'checking' | 'valid' | 'invalid' | 'unavailable';

const FamilySessionGuard: React.FC = () => {
  const [state, setState] = useState<GuardState>('checking');
  const [retry, setRetry] = useState(0);
  const [locked, setLocked] = useState(false);
  const [pinFallback, setPinFallback] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const lockedRef = useRef(false);
  const authenticatingRef = useRef(false);

  const familyId =
    localStorage.getItem('homefin_current_family_id') || '';

  // Validação da sessão familiar no servidor.
  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!familyId || familyId === 'v1') {
        if (active) setState('invalid');
        return;
      }

      setState('checking');

      try {
        const token = await getFamilySessionToken(familyId);

        if (!token) {
          if (active) setState('invalid');
          return;
        }

        const valid = await verifyFamilySession(familyId);

        if (!valid) {
          await clearFamilySession(familyId);
        }

        if (active) {
          setState(valid ? 'valid' : 'invalid');
        }
      } catch (error) {
        console.error('Falha na validação da sessão:', error);

        if (active) setState('unavailable');
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [familyId, retry]);

  // Bloqueio e desbloqueio biométrico nativo.
  useEffect(() => {
    if (!isNativeHomeFin() || !familyId || familyId === 'v1') {
      return;
    }

    let active = true;

    const lockApplication = () => {
      if (
        localStorage.getItem(
          `homefin_passkey_enabled_${familyId}`
        ) !== '1'
      ) {
        return;
      }

      lockedRef.current = true;
      setLocked(true);
      setPinFallback(false);
    };

    const unlockApplication = async () => {
      if (
        !active ||
        !lockedRef.current ||
        authenticatingRef.current
      ) {
        return;
      }

      authenticatingRef.current = true;
      setUnlocking(true);

      try {
        await authenticateNativeBiometry();

        if (active) {
          lockedRef.current = false;
          setLocked(false);
          setPinFallback(false);
        }
      } catch (error) {
        console.warn('Autenticação biométrica não concluída:', error);

        if (active) {
          setPinFallback(true);
        }
      } finally {
        authenticatingRef.current = false;

        if (active) setUnlocking(false);
      }
    };

    let pauseHandle: { remove: () => Promise<void> } | undefined;
    let resumeHandle: { remove: () => Promise<void> } | undefined;

    void App.addListener('pause', lockApplication).then(handle => {
      if (active) pauseHandle = handle;
      else void handle.remove();
    });

    void App.addListener('resume', () => {
      void unlockApplication();
    }).then(handle => {
      if (active) resumeHandle = handle;
      else void handle.remove();
    });

    return () => {
      active = false;
      void pauseHandle?.remove();
      void resumeHandle?.remove();
    };
  }, [familyId]);

  if (state === 'checking') return <LoadingScreen />;

  if (state === 'invalid') {
    return (
      <Navigate
        to={`/login?family=${encodeURIComponent(familyId)}&reason=session`}
        replace
      />
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-900">
        <p className="max-w-md text-gray-700 dark:text-gray-200">
          Não foi possível confirmar sua sessão no servidor.
          Seus dados locais foram preservados.
        </p>

        <button
          type="button"
          onClick={() => setRetry(value => value + 1)}
          className="rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <Outlet />

      {locked && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gray-950 px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-600/20">
            <svg
              viewBox="0 0 24 24"
              className="h-11 w-11 text-primary-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path d="M12 14v3" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white">
            HomeFin protegido
          </h2>

          <p className="mt-3 max-w-sm text-gray-300">
            Confirme sua identidade para visualizar novamente
            suas informações financeiras.
          </p>

          {unlocking && (
            <p className="mt-6 text-sm text-primary-300">
              Aguardando autenticação biométrica...
            </p>
          )}

          {pinFallback && (
            <div className="mt-7 w-full max-w-sm space-y-3">
              <p className="text-sm text-amber-300">
                Não foi possível concluir a biometria.
                Você pode continuar com seu PIN.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.hash =
                    `/login?family=${encodeURIComponent(familyId)}`;
                }}
                className="w-full rounded-xl bg-primary-600 px-5 py-4 font-semibold text-white"
              >
                Entrar com PIN
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FamilySessionGuard;
