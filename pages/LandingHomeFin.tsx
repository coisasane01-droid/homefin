import { showNotification } from '../services/utils/notifications';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { saasDb, LandingConfig } from '../services/saasDb';

const LandingHomeFin: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginFamilyName, setLoginFamilyName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [config, setConfig] = useState<LandingConfig>(saasDb.getLandingConfig());
  
  // Recovery State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryKeyword, setRecoveryKeyword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setConfig(saasDb.getLandingConfig());
  }, []);

  useEffect(() => {
    if (config.pwaIcon) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = config.pwaIcon;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = config.pwaIcon;
        document.head.appendChild(newLink);
      }
    }
    if (config.pwaName) {
      document.title = config.pwaName;
    }
  }, [config.pwaIcon, config.pwaName]);

  const handleCreateAccount = () => {
    setIsModalOpen(true);
  };

  const handleValidateCode = () => {
    if (!accessCode) {
      setError('Por favor, insira um código.');
      return;
    }

    const validation = saasDb.validateCode(accessCode);
    if (validation.valid) {
      // If it's a discount code (not full access), redirect to plans
      if (validation.discountPercent !== undefined && validation.discountPercent < 100) {
        navigate('/plans', { state: { code: accessCode, discountPercent: validation.discountPercent } });
      } else {
        // Full access code
        navigate('/setup', { state: { code: accessCode } });
      }
    } else {
      setError(validation.message || 'Código inválido.');
    }
  };

  const handleNoCode = () => {
    navigate('/plans');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const nameToSearch = loginFamilyName.trim().toLowerCase();
    
    if (!nameToSearch) {
      setLoginError('Por favor, digite o nome da família.');
      return;
    }

    const families = saasDb.getFamilies();
    // Busca exata pelo nome ou ID da família
    const family = families.find(f => 
      f.name.toLowerCase() === nameToSearch || 
      f.id === nameToSearch
    );

    if (family) {
      navigate(`/login?family=${family.id}`);
    } else {
      setLoginError('Família não encontrada. Verifique o nome e tente novamente.');
    }
  };

  const handleSuperAdmin = () => {
    setIsAdminModalOpen(true);
  };

  const submitAdminPassword = (e?: React.FormEvent) => {
    e?.preventDefault();
    const currentConfig = saasDb.getAdminConfig();
    const currentPassword = currentConfig?.password || 'admin123';
    
    if (adminPassword === currentPassword) {
      navigate('/admin');
    } else {
      showNotification('Acesso negado.', 'error');
      setAdminPassword('');
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentConfig = saasDb.getAdminConfig();
    const currentKeyword = currentConfig?.recoveryKeyword || 'admin';

    if (recoveryKeyword !== currentKeyword) {
      showNotification('Palavra-chave incorreta.', 'error');
      return;
    }

    if (!newPassword || newPassword !== confirmPassword) {
      showNotification('As senhas não coincidem ou estão vazias.', 'error');
      return;
    }

    saasDb.updateAdminConfig({ password: newPassword });
    showNotification('Senha atualizada com sucesso! Use a nova senha para entrar.', 'success');
    setIsRecoveryMode(false);
    setAdminPassword('');
    setRecoveryKeyword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div 
      className="min-h-screen font-sans flex flex-col relative bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ 
        backgroundImage: config.bannerImage ? `url(${config.bannerImage})` : `linear-gradient(to bottom right, ${config.bgColorStart || '#312e81'}, ${config.bgColorEnd || '#3730a3'})`,
        color: config.textColor || '#ffffff'
      }}
    >
      {/* Overlay for better readability if banner is present */}
      {config.bannerImage && <div className="absolute inset-0 bg-black/60 z-0"></div>}

      {/* Header */}
      <header className="container mx-auto px-6 pt-6 pb-2 flex justify-end items-center shrink-0 relative z-10">
        {/* Logo moved to Hero section */}
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-10 text-center flex-grow relative z-10">
        
        {/* Large Logo */}
        <div className="flex justify-center items-center mb-8">
          {config.logoImage ? (
            <img 
              src={config.logoImage} 
              alt="Logo" 
              className={`object-contain drop-shadow-2xl transition-all duration-300 ${!config.logoWidth ? 'h-40 md:h-56 w-auto' : ''}`}
              style={{ 
                width: config.logoWidth ? `${config.logoWidth}px` : undefined,
                borderRadius: config.logoRadius ? `${config.logoRadius}px` : undefined
              }} 
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
               <Home size={80} className="text-current opacity-90" />
               <span className="text-6xl md:text-7xl font-bold tracking-tighter">HomeFin</span>
            </div>
          )}
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight whitespace-pre-line" style={{ color: config.titleColor || '#ffffff' }}>
          {config.title.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {i === 1 ? (
                <span style={{ 
                  background: `linear-gradient(to right, ${config.accentColorStart || '#818cf8'}, ${config.accentColorEnd || '#c084fc'})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {line}
                </span>
              ) : (
                line
              )}
              {i < config.title.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </h1>
        <p className="text-xl md:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed" style={{ color: config.textColor ? `${config.textColor}dd` : '#e0e7ff' }}>
          {config.subtitle}
        </p>
        
        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={handleCreateAccount}
            className="bg-white text-indigo-900 px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-opacity-90 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
          >
            {config.buttonText} <ArrowRight size={20} />
          </button>

          <button 
            onClick={() => setIsLoginModalOpen(true)} 
            className="px-6 py-2 rounded-full font-bold text-sm transition-all transform hover:scale-105 hover:shadow-lg backdrop-blur-sm border bg-white/5 hover:bg-white/10"
            style={{ 
              color: config.textColor || '#ffffff',
              borderColor: config.textColor || '#ffffff'
            }}
          >
            Já tenho conta
          </button>
        </div>

        {/* Features Preview */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-white/30 transition-colors">
            <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white">
              <CheckCircle2 />
            </div>
            <h3 className="text-xl font-bold mb-2">Controle Total</h3>
            <p style={{ color: config.textColor ? `${config.textColor}cc` : '#c7d2fe' }}>Saiba exatamente para onde vai seu dinheiro com gráficos claros e relatórios detalhados.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-white/30 transition-colors">
            <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white">
              <Lock />
            </div>
            <h3 className="text-xl font-bold mb-2">Segurança Máxima</h3>
            <p style={{ color: config.textColor ? `${config.textColor}cc` : '#c7d2fe' }}>Seus dados são protegidos com criptografia de ponta a ponta e acesso via PIN.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-white/30 transition-colors">
            <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white">
              <Home />
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-Família</h3>
            <p style={{ color: config.textColor ? `${config.textColor}cc` : '#c7d2fe' }}>Gerencie as finanças de toda a casa com perfis personalizados para cada membro.</p>
          </div>
        </div>
      </main>

      {/* Footer / Secret Admin Access */}
      <footer className="w-full text-center py-6 shrink-0 relative z-10">
        <button 
          onClick={handleSuperAdmin} 
          className="transition-opacity cursor-pointer p-4 text-xs font-medium hover:opacity-100 opacity-60"
          style={{ color: config.textColor || '#ffffff' }}
        >
          &copy; 2026 HomeFin SaaS
        </button>
      </footer>

      {/* Modal: Admin Login */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative border border-gray-800">
            <button 
              onClick={() => {
                setIsAdminModalOpen(false);
                setIsRecoveryMode(false);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
            
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              <Lock size={20} className="text-red-500" /> {isRecoveryMode ? 'Recuperar Senha' : 'Acesso Restrito'}
            </h2>

            {!isRecoveryMode ? (
              <form onSubmit={submitAdminPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Senha Mestra</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-gray-600"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  Entrar no Painel
                </button>
                
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(true)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Palavra-chave de Segurança</label>
                  <input 
                    type="text" 
                    value={recoveryKeyword}
                    onChange={(e) => setRecoveryKeyword(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-gray-600"
                    placeholder="Digite a palavra-chave"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-gray-600"
                    placeholder="Nova senha"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Confirmar Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-gray-600"
                    placeholder="Confirme a senha"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  Redefinir Senha
                </button>
                
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(false)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline"
                  >
                    Voltar ao Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Access Code */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            
            <h2 className="text-2xl font-bold mb-2 text-indigo-900">Bem-vindo!</h2>
            <p className="text-gray-600 mb-6">Para começar, você possui um código de convite?</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Acesso</label>
                <input 
                  type="text" 
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="EX: FREE-2026"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-widest font-mono text-center text-lg"
                />
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              </div>

              <button 
                onClick={handleValidateCode}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
              >
                Sim, tenho um código
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Ou</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button 
                onClick={handleNoCode}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Não tenho código (Ver Planos)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Login Family Name */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            
            <h2 className="text-2xl font-bold mb-2 text-indigo-900">Acessar Família</h2>
            <p className="text-gray-600 mb-6">Digite o nome da sua família para entrar.</p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Família</label>
                <input 
                  type="text" 
                  value={loginFamilyName}
                  onChange={(e) => {
                    setLoginFamilyName(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Ex: Família Silva"
                  className={`w-full p-3 border rounded-lg focus:ring-2 outline-none ${loginError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`}
                  autoFocus
                />
                {loginError && <p className="text-red-500 text-sm mt-1">{loginError}</p>}
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
              >
                Continuar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingHomeFin;
