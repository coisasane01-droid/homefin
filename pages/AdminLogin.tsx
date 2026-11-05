import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '../services/utils/notifications';

const TOKEN_KEY = 'homefin_admin_session_token';
const EXPIRY_KEY = 'homefin_admin_session_expires_at';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(sessionStorage.getItem(EXPIRY_KEY) || 0);
    if (token && expiresAt > Date.now()) {
      navigate('/admin/panel', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      showNotification('Digite a senha de acesso.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
        cache: 'no-store',
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token || !result.expiresAt) {
        throw new Error(result.error || 'Não foi possível autenticar.');
      }

      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(EXPIRY_KEY, String(result.expiresAt));
      sessionStorage.setItem('homefin_super_admin_authenticated', 'true');
      navigate('/admin/panel', { replace: true });
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : 'Falha ao conectar com o servidor.',
        'error'
      );
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-indigo-600 px-8 py-8 text-white text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-4">
              <ShieldCheck size={42} />
            </div>
            <h1 className="text-2xl font-bold">HomeFin - Admin</h1>
            <p className="text-indigo-100 text-sm mt-2">Painel administrativo restrito</p>
          </div>

          <div className="p-8">
            {!showRecoveryInfo ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Senha de acesso
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Digite sua senha administrativa"
                      autoFocus
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Verificando...' : 'Entrar no Painel'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRecoveryInfo(true)}
                  className="w-full text-sm text-gray-500 hover:text-indigo-600 underline"
                >
                  Esqueci a senha
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Recuperar acesso administrativo
                  </h2>
                  <p className="text-sm text-gray-600 mt-2">
                    A senha é validada no servidor e não pode ser redefinida por uma palavra-chave salva neste navegador.
                    Para recuperar o acesso, atualize HOMEFIN_ADMIN_SECRET nas variáveis de ambiente do projeto HomeFin na Vercel.
                    Depois, será necessário um novo deploy para o servidor usar a configuração atualizada.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Não coloque o segredo no código do aplicativo nem o envie em mensagens.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecoveryInfo(false)}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
                >
                  Voltar para o login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
