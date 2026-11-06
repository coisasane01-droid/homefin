import React, { useState, useEffect } from 'react';
import { Home, Delete, KeyRound, AlertCircle, AlertTriangle } from 'lucide-react';
import { UserSettings } from '../types';
import { familyAuthRequest, storeFamilySession } from '../services/familyAuth';

const PIN_LENGTH = 4;

const getInitialFamilySettings = (): UserSettings | null => {
  try {
    const hash = window.location.hash || '';
    const query = hash.includes('?') ? hash.split('?').slice(1).join('?') : '';
    const params = new URLSearchParams(query);
    const familyId =
      params.get('family') ||
      window.localStorage.getItem('homefin_current_family_id') ||
      'v1';

    const raw = window.localStorage.getItem(`homefin_data_${familyId}`);
    if (!raw) return null;

    const data = JSON.parse(raw);
    return data?.settings && typeof data.settings === 'object'
      ? data.settings as UserSettings
      : null;
  } catch (error) {
    console.error('Não foi possível carregar as configurações locais:', error);
    return null;
  }
};

const Auth: React.FC = () => {
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'login' | 'recovery' | 'reset_warning'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(getInitialFamilySettings);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [hasRecovery, setHasRecovery] = useState(false);
  const [authStatusReady, setAuthStatusReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const familyId = params.get('family') || localStorage.getItem('homefin_current_family_id') || 'v1';

    if (familyId && familyId !== 'v1') {
      localStorage.setItem('homefin_current_family_id', familyId);
    }

    if (familyId === 'v1') {
      setMode('reset_warning');
      setMessage('Selecione uma família para entrar');
      setAuthStatusReady(true);
      return;
    }

    let active = true;
    void familyAuthRequest(familyId, { action: 'status' })
      .then((result) => {
        if (!active) return;
        setHasRecovery(result.hasRecovery === true);
        setMode(result.enrolled ? 'login' : 'reset_warning');
        setMessage(result.enrolled ? 'Digite seu código de acesso' : 'Acesso familiar ainda não configurado no servidor');
        setAuthStatusReady(true);
      })
      .catch((statusError) => {
        if (!active) return;
        setError(statusError instanceof Error ? statusError.message : 'Não foi possível consultar o servidor.');
        setMessage('Não foi possível verificar o acesso no servidor.');
        setAuthStatusReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (e) {
        // Ignore errors on devices that don't support it
      }
    }
  };

  const handleNumberClick = (num: number) => {
    if (mode !== 'login' || !authStatusReady) return;

    triggerHaptic();

    if (pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');

      // Auto-submit when length reached
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => processPin(newPin), 300);
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic();
    setPin(prev => prev.slice(0, -1));
    setError('');
  };


  const processPin = async (inputPin: string) => {
    setError('');
    const familyId = localStorage.getItem('homefin_current_family_id') || 'v1';
    try {
      const result = await familyAuthRequest(familyId, { action: 'login', pin: inputPin });
      storeFamilySession(familyId, result);
      window.location.hash = '/dashboard';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível validar o acesso.');
      setPin('');
    }
  };

  const startRecovery = () => {
    setMode(hasRecovery ? 'recovery' : 'reset_warning');
    setPin('');
    setRecoveryInput('');
    setRecoveryPin('');
    setError('');
    setMessage(hasRecovery ? 'Recupere seu acesso' : 'Recuperação indisponível');
  };

  const checkRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const familyId = localStorage.getItem('homefin_current_family_id') || 'v1';
    if (!/^\d{4}$/.test(recoveryPin)) {
      setError('O novo PIN deve conter exatamente 4 dígitos.');
      return;
    }
    try {
      const result = await familyAuthRequest(familyId, {
        action: 'recover',
        keyword: recoveryInput,
        newPin: recoveryPin,
      });
      storeFamilySession(familyId, result);
      window.location.hash = '/dashboard';
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Não foi possível recuperar o acesso.');
      setRecoveryPin('');
    }
  };

  const cancelRecovery = () => {
    setMode(hasRecovery ? 'login' : 'reset_warning');
    setMessage(hasRecovery ? 'Digite seu código de acesso' : 'Acesso precisa de configuração');
    setError('');
    setRecoveryInput('');
    setRecoveryPin('');
  };

  const hasBackground = !!settings?.backgroundImage;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 transition-all duration-500 relative overflow-hidden ${hasBackground ? 'bg-gray-900' : 'bg-gray-50 dark:bg-gray-900'}`}>
      
      {/* Background Image Layer */}
      {hasBackground && (
        <div 
            className="absolute inset-0 bg-no-repeat transition-all duration-500 ease-out z-0"
            style={{
                backgroundImage: `url(${settings?.backgroundImage})`,
                backgroundPosition: settings?.backgroundPosition || 'center',
                backgroundSize: settings?.backgroundFit === 'contain' ? 'contain' : `${settings?.backgroundZoom || 100}%`,
                opacity: settings?.backgroundOpacity !== undefined ? settings.backgroundOpacity / 100 : 1
            }}
        />
      )}

      {/* Overlay for better contrast if background exists */}
      {hasBackground && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />}

      <div 
        className={`w-full relative z-10 transition-all duration-500 ${
            settings?.cardFullScreen 
                ? 'min-h-screen flex flex-col items-center justify-center p-8' 
                : 'max-w-sm bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl'
        } ${!hasBackground ? 'max-w-sm' : ''}`}
        style={{
            backgroundColor: hasBackground 
                ? `rgba(255, 255, 255, ${(settings?.cardOpacity ?? 40) / 100})` 
                : undefined
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          {settings?.logoImage ? (
              <div 
                  className="mb-6 relative flex items-center justify-center overflow-hidden drop-shadow-lg"
                  style={{ 
                      width: `${96 * ((settings.logoSize || 100) / 100)}px`,
                      height: `${96 * ((settings.logoSize || 100) / 100)}px`,
                      borderRadius: settings.logoShape === 'circle' ? '50%' : '12px' 
                  }}
              >
                  <img 
                    src={settings.logoImage} 
                    alt="Logo" 
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{ 
                        objectPosition: settings.logoPosition || 'center',
                        transform: `scale(${(settings.logoZoom || 100) / 100})`
                    }}
                  />
              </div>
          ) : (
              <div className={`p-4 rounded-full mb-6 shadow-sm ${hasBackground ? 'bg-white/20 text-white' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'}`}>
                <Home className="w-8 h-8" />
              </div>
          )}
          <h1 className={`text-2xl font-bold mb-2 ${hasBackground ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            {settings?.houseName || localStorage.getItem('homefin_current_family_name') || 'HomeFin'}
          </h1>
          <p className={`text-lg font-medium transition-colors text-center ${error ? 'text-red-500 flex items-center gap-2' : (hasBackground ? 'text-white/80' : 'text-gray-600 dark:text-gray-300')}`}>
            {error && <AlertCircle size={20} />}
            {error || message}
          </p>
        </div>

        {mode === 'recovery' ? (
           <form onSubmit={checkRecovery} className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
              <div className={`text-center text-sm mb-4 p-3 rounded-lg ${hasBackground ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-900/20 text-gray-500'}`}>
                  Confirme a palavra-chave cadastrada no servidor e escolha um novo PIN de 4 dígitos.
              </div>
              <input 
                type="text" 
                value={recoveryInput}
                onChange={e => setRecoveryInput(e.target.value)}
                className={`w-full text-center text-xl font-bold p-4 border rounded-xl outline-none lowercase focus:ring-2 focus:ring-primary-500 ${hasBackground ? 'bg-white/20 border-white/30 text-white placeholder:text-white/50' : 'dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`}
                placeholder="Palavra-chave..."
                autoFocus
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                value={recoveryPin}
                onChange={e => setRecoveryPin(e.target.value.replace(/\D/g, ''))}
                className={`w-full text-center text-xl font-bold tracking-[0.5em] p-4 border rounded-xl outline-none focus:ring-2 focus:ring-primary-500 ${hasBackground ? 'bg-white/20 border-white/30 text-white placeholder:text-white/50' : 'dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`}
                placeholder="Novo PIN"
              />
              <button 
                type="submit" 
                className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-primary-700 transition-transform active:scale-95"
              >
                Recuperar acesso
              </button>
              <button 
                type="button" 
                onClick={cancelRecovery}
                className={`w-full py-2 hover:opacity-80 ${hasBackground ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Voltar
              </button>
           </form>
        ) : mode === 'reset_warning' ? (
           <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 rounded-xl flex flex-col items-center text-center gap-3">
                  <AlertTriangle className="text-amber-500 w-10 h-10" />
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">
                    {localStorage.getItem('homefin_current_family_id') === 'v1' ? 'Selecione uma família' : 'Acesso precisa de configuração'}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {localStorage.getItem('homefin_current_family_id') === 'v1'
                      ? 'Abra o HomeFin e escolha a família para entrar.'
                      : 'Esta família ainda não possui uma credencial verificada no servidor.'}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Os dados locais foram preservados. Não crie outra família nem apague este dispositivo; solicite ao administrador a migração segura da credencial.
                  </p>
              </div>

              <button 
                onClick={() => { window.location.hash = '/'; }}
                className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-primary-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Home size={18} /> Voltar ao início
              </button>
              <button 
                type="button" 
                onClick={cancelRecovery}
                className={`w-full py-2 hover:opacity-80 ${hasBackground ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Cancelar
              </button>
           </div>
        ) : (
          <>
            {/* PIN Dots */}
            <div className="flex gap-4 justify-center mb-8">
                {[...Array(PIN_LENGTH)].map((_, i) => (
                <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length
                        ? 'bg-primary-600 scale-110 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]'
                        : (hasBackground ? 'bg-white/30' : 'bg-gray-300 dark:bg-gray-700')
                    } ${error ? 'animate-bounce bg-red-500' : ''}`}
                />
                ))}
            </div>

            {/* Recovery Prompt on Error */}
            {error && mode === 'login' && (
                <div className="mb-6 flex justify-center animate-in slide-in-from-top-2">
                    <button 
                        onPointerDown={(e) => {
                            e.preventDefault();
                            startRecovery();
                        }}
                        className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-2 touch-manipulation select-none active:scale-95"
                    >
                        <KeyRound size={16} /> Recuperar com Palavra-Chave
                    </button>
                </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4 md:gap-6 px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={!authStatusReady}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleNumberClick(num);
                  }}
                  className={`h-16 w-16 md:h-20 md:w-20 rounded-full text-2xl font-semibold shadow-sm active:scale-90 transition-all duration-75 mx-auto flex items-center justify-center touch-manipulation select-none ${
                      hasBackground 
                        ? 'bg-white/20 text-white hover:bg-white/30 border border-white/30 backdrop-blur-sm' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {num}
                </button>
              ))}
              
              {/* Bottom Row - Recovery Button */}
              <div className="flex items-center justify-center">
                {mode === 'login' && (
                    <button 
                      disabled={!authStatusReady}
                      onPointerDown={(e) => {
                          e.preventDefault();
                          startRecovery();
                      }}
                      className={`flex flex-col items-center justify-center transition-colors p-2 group h-16 w-16 md:h-20 md:w-20 touch-manipulation select-none active:scale-90 duration-75 ${hasBackground ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-primary-600'}`}
                    >
                      <KeyRound size={24} className="mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold uppercase tracking-tight">Palavra<br/>Chave</span>
                    </button>
                )}
              </div>

              <button
                disabled={!authStatusReady}
                onPointerDown={(e) => {
                    e.preventDefault();
                    handleNumberClick(0);
                }}
                className={`h-16 w-16 md:h-20 md:w-20 rounded-full text-2xl font-semibold shadow-sm active:scale-90 transition-all duration-75 mx-auto flex items-center justify-center touch-manipulation select-none ${
                    hasBackground 
                      ? 'bg-white/20 text-white hover:bg-white/30 border border-white/30 backdrop-blur-sm' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
                }`}
              >
                0
              </button>

              <button
                onPointerDown={(e) => {
                    e.preventDefault();
                    handleDelete();
                }}
                className={`h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center active:scale-90 transition-all duration-75 mx-auto touch-manipulation select-none ${
                    hasBackground 
                        ? 'text-white/70 hover:text-white' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
                }`}
              >
                <Delete size={28} />
              </button>
            </div>
            
            {/* Extra help text for clarity */}
            {mode === 'login' && !error && (
              <div className="mt-8 text-center">
                <button 
                  onClick={startRecovery}
                  className={`text-sm hover:underline font-medium opacity-80 hover:opacity-100 ${hasBackground ? 'text-white' : 'text-primary-600 dark:text-primary-400'}`}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
          </>
        )}

        {mode !== 'recovery' && mode !== 'reset_warning' && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('homefin_current_family_id');
                localStorage.removeItem('homefin_current_family_name');
                window.location.hash = '/';
              }}
              className={`text-sm font-semibold underline underline-offset-4 ${
                hasBackground ? 'text-white' : 'text-primary-600 dark:text-primary-400'
              }`}
            >
              Entrar em outra família
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Auth;