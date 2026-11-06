import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '../services/utils/notifications';
import { saasDb } from '../services/saasDb';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [recoveryKeyword, setRecoveryKeyword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('homefin_super_admin_authenticated') === 'true') {
      navigate('/admin/panel', { replace: true });
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const currentConfig = saasDb.getAdminConfig();
    const currentPassword = currentConfig?.password || 'admin123';

    if (password === currentPassword) {
      sessionStorage.setItem('homefin_super_admin_authenticated', 'true');
      window.location.hash = '/admin/panel';
      window.location.reload();
      return;
    }

    showNotification('Acesso negado.', 'error');
    setPassword('');
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();

    const currentConfig = saasDb.getAdminConfig();
    const currentKeyword = currentConfig?.recoveryKeyword || 'admin';

    if (!recoveryKeyword.trim()) {
      showNotification('Digite a palavra-chave de recuperação.', 'error');
      return;
    }

    if (recoveryKeyword.trim() !== currentKeyword) {
      showNotification('Palavra-chave incorreta.', 'error');
      return;
    }

    if (!newPassword || newPassword !== confirmPassword) {
      showNotification('As senhas não coincidem ou estão vazias.', 'error');
      return;
    }

    setLoading(true);

    saasDb.updateAdminConfig({ password: newPassword });

    showNotification('Senha atualizada com sucesso!', 'success');

    setLoading(false);
    setIsRecoveryMode(false);
    setRecoveryKeyword('');
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');
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

            <p className="text-indigo-100 text-sm mt-2">
              Painel administrativo restrito
            </p>
          </div>

          <div className="p-8">
            {!isRecoveryMode ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Senha de acesso
                  </label>

                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Digite sua senha"
                      autoFocus
                      autoComplete="current-password"
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
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
                >
                  Entrar no Painel
                </button>

                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(true)}
                  className="w-full text-sm text-gray-500 hover:text-indigo-600 underline"
                >
                  Esqueci a senha
                </button>
              </form>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Recuperar senha
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Use a palavra-chave de recuperação cadastrada no painel.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Palavra-chave
                  </label>

                  <input
                    type="text"
                    value={recoveryKeyword}
                    onChange={(e) => setRecoveryKeyword(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Digite a palavra-chave"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nova senha
                  </label>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Digite a nova senha"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirmar nova senha
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  Atualizar senha
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryMode(false);
                    setRecoveryKeyword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="w-full text-sm text-gray-500 hover:text-indigo-600 underline"
                >
                  Voltar para o login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
