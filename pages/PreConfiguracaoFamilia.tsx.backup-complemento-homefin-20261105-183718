import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saasDb } from '../services/saasDb';
import { db } from '../services/db';
import { UserSettings } from '../types';
import { ArrowLeft, Upload, Copy, Check, Share, PlusSquare, X, Download, Smartphone } from 'lucide-react';

const colors = {
  slate: '#64748b',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

const PreConfiguracaoFamilia: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const code = location.state?.code;

  const [formData, setFormData] = useState({
    familyName: '',
    pin: '',
    keyword: '',
    color: 'indigo',
    backgroundImage: '',
    logoImage: '',
    logoShape: 'square'
  });
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    setIsInstalled(isStandalone);

    const syncInstallPrompt = () => {
      setInstallPrompt((window as any).__homefinInstallPrompt || null);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstallHelp(false);
      (window as any).__homefinInstallPrompt = null;
    };

    syncInstallPrompt();
    window.addEventListener('homefin-install-available', syncInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('homefin-install-available', syncInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } catch (error) {
        console.error('Não foi possível abrir a instalação do HomeFin:', error);
        setShowInstallHelp(true);
      } finally {
        setInstallPrompt(null);
        (window as any).__homefinInstallPrompt = null;
      }
      return;
    }

    // Sem o evento nativo, o navegador não permite forçar o diálogo de instalação.
    setShowInstallHelp(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.');
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const maxDimension = type === 'background' ? 1600 : 600;
    const quality = type === 'background' ? 0.82 : 0.86;

    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível processar a imagem.');

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            setError('Não foi possível reduzir a imagem. Tente outro arquivo.');
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== 'string') {
              setError('Não foi possível carregar a imagem processada.');
              return;
            }

            const base64String = reader.result;
            if (type === 'background') {
              setFormData(prev => ({ ...prev, backgroundImage: base64String }));
            } else {
              setFormData(prev => ({ ...prev, logoImage: base64String }));
            }
            setError('');
          };
          reader.onerror = () => setError('Falha ao ler a imagem processada.');
          reader.readAsDataURL(blob);
        }, 'image/webp', quality);
      } catch {
        URL.revokeObjectURL(objectUrl);
        setError('Não foi possível processar a imagem. Tente outro arquivo.');
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Não foi possível abrir a imagem selecionada.');
    };

    image.src = objectUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.familyName || !formData.pin || !formData.keyword) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      setError('O PIN deve ter 4 dígitos.');
      return;
    }
    if (formData.keyword.trim().length < 8 || formData.keyword.trim().length > 256) {
      setError('A palavra-chave de recuperação deve ter entre 8 e 256 caracteres.');
      return;
    }

    // Novos cadastros ficam no plano gratuito até a confirmação real do pagamento.
    const plan = 'free';

    const baseId = formData.familyName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'familia';

    const familyId = `${baseId}-${crypto.randomUUID().slice(0, 8)}`;

    const familyData: any = {
      id: familyId,
      name: formData.familyName.trim(),
      plan,
      status: 'active',
      createdAt: new Date().toISOString(),
      settings: {
        theme: 'light',
        houseName: formData.familyName.trim(),
        primaryColor: formData.color,
        backgroundImage: formData.backgroundImage || '',
        logoImage: formData.logoImage || '',
        logoShape: formData.logoShape === 'circle' ? 'circle' : 'square'
      }
    };

    // O servidor grava a família e o hash do PIN na mesma transação.
    let enrollmentResponse: Response;
    let enrollmentData: any;

    try {
      enrollmentResponse = await fetch('/api/family-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          familyId,
          family: familyData,
          pin: formData.pin,
          keyword: formData.keyword
        }),
        cache: 'no-store'
      });
      enrollmentData = await enrollmentResponse.json();
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
      return;
    }

    if (!enrollmentResponse.ok || !enrollmentData?.success) {
      setError(
        enrollmentData?.error ||
        'Não foi possível criar a família. Verifique a configuração do servidor.'
      );
      return;
    }

    const newFamily = enrollmentData.family;

    // Guardar a sessão do servidor antes de inicializar ou sincronizar dados.
    if (!enrollmentData.token) {
      setError('A família foi criada, mas não foi possível iniciar a sessão. Entre novamente com seu código.');
      return;
    }

    localStorage.setItem(
      `homefin_family_session_token_${newFamily.id}`,
      enrollmentData.token
    );
    localStorage.setItem(
      `homefin_family_session_expires_at_${newFamily.id}`,
      String(Date.now() + (Number(enrollmentData.expiresIn) || 43200) * 1000)
    );
    localStorage.setItem('homefin_current_family_id', newFamily.id);
    localStorage.setItem('homefin_current_family_name', newFamily.name);

    // Atualizar o contexto local da família sem gravar uma cópia SaaS antiga.
    try {
      const remoteSaasData = await (await import('../services/supabaseService')).supabaseService.getSaasData();
      if (remoteSaasData) {
        remoteSaasData.families = Array.isArray(remoteSaasData.families)
          ? remoteSaasData.families
          : [];
        if (!remoteSaasData.families.some((f: any) => f.id === newFamily.id)) {
          remoteSaasData.families.push(newFamily);
        }
        localStorage.setItem('homefin_saas_data_v1', JSON.stringify(remoteSaasData));
      }
    } catch (syncError) {
      console.error('Família criada; atualização do cache SaaS será retomada depois.', syncError);
    }

    // Inicializar os dados financeiros da nova família.
    await db.init(newFamily.id);

    const newSettings: UserSettings = {
      theme: 'light',
      houseName: formData.familyName,
      primaryColor: formData.color,
      backgroundImage: formData.backgroundImage,
      logoImage: formData.logoImage,
      backgroundZoom: 100,
      backgroundOpacity: 100,
      backgroundFit: 'cover',
      cardOpacity: 40,
      cardFullScreen: false,
      logoShape: formData.logoShape as 'square' | 'circle',
      logoZoom: 100,
      logoSize: 100,
      customCategories: [],
      categories: ['Fixa', 'Variável', 'Cartão', 'Imposto'],
      notificationsEnabled: true,
      integrations: { openBanking: false, saneago: false, equatorial: false }
    };

    await db.updateSettings(newSettings);

    // Registrar o uso do código promocional após atualizar o cache com os dados atuais.
    if (code) {
      try {
        saasDb.useCode(code, newFamily.id);
      } catch (codeError) {
        console.error('Não foi possível atualizar o uso do código promocional.', codeError);
      }
    }

    // Generate Link
    const link = `${window.location.origin}/#/login?family=${newFamily.id}`;
    setGeneratedLink(link);

    // Show success modal instead of alert
    setShowSuccessModal(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in zoom-in duration-300 relative">
        <button 
          onClick={() => {
            if (location.state?.plan) {
              navigate('/plans', { state: { flow: 'signup' } });
            } else {
              navigate('/');
            }
          }} 
          className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors"
          title="Voltar"
        >
          <ArrowLeft size={24} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-6 text-center">Configuração Inicial</h2>
        <p className="text-gray-500 mb-6 text-center">Vamos preparar o ambiente para sua família.</p>

        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Família / Casa</label>
            <input 
              type="text" 
              value={formData.familyName}
              onChange={e => setFormData({...formData, familyName: e.target.value})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Família Silva"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN de Acesso (4 dígitos)</label>
              <input 
                type="password" minLength={4} maxLength={4} pattern="[0-9]{4}" required inputMode="numeric"
                value={formData.pin}
                onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g,'')})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-widest font-mono"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-chave (Recuperação)</label>
              <input 
                type="text" minLength={8} maxLength={256} required
                value={formData.keyword}
                onChange={e => setFormData({...formData, keyword: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none lowercase"
                placeholder="Ex: lua-azul-2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo da Família</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
                  {formData.logoImage ? (
                    <img src={formData.logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload size={20} />
                      <span className="text-xs mt-1">Upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'logo')} />
                </label>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagem de Fundo</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
                  {formData.backgroundImage ? (
                    <img src={formData.backgroundImage} alt="Background" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload size={20} />
                      <span className="text-xs mt-1">Upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'background')} />
                </label>
             </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Estilo do Logo</label>
             <div className="flex bg-gray-100 p-1 rounded-lg">
               <button
                 type="button"
                 onClick={() => setFormData({...formData, logoShape: 'circle'})}
                 className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                   formData.logoShape === 'circle'
                     ? 'bg-white text-green-600 shadow-sm'
                     : 'text-gray-500 hover:text-gray-700'
                 }`}
               >
                 Redondo
               </button>
               <button
                 type="button"
                 onClick={() => setFormData({...formData, logoShape: 'square'})}
                 className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                   formData.logoShape === 'square'
                     ? 'bg-white text-green-600 shadow-sm'
                     : 'text-gray-500 hover:text-gray-700'
                 }`}
               >
                 Quadrado
               </button>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor do Tema</label>
            <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto p-2 border rounded-lg">
              {Object.entries(colors).map(([name, hex]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData({...formData, color: name})}
                  className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${
                    formData.color === name 
                      ? 'border-gray-900 scale-110 ring-2 ring-offset-2 ring-gray-200' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={name}
                />
              ))}
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 mt-4"
          >
            Finalizar Configuração
          </button>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check size={32} strokeWidth={3} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900">Parabéns!</h2>
              <p className="text-gray-600">
                Seu login foi criado com sucesso.<br/>
                <span className="font-medium text-gray-900">Seja bem-vindo à família {formData.familyName}!</span>
              </p>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 text-left">Link de Acesso</label>
                <div className="flex gap-2">
                  <input 
                    readOnly 
                    value={generatedLink} 
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none"
                  />
                  <button 
                    onClick={copyLink}
                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    title="Copiar Link"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 mt-4"
              >
                Ir para Login
              </button>

              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-bold text-gray-900 text-sm">Instale o HomeFin no seu aparelho</h3>
                {isInstalled ? (
                  <div className="w-full bg-green-50 text-green-700 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Check size={20} /> Aplicativo já instalado
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstallApp}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Download size={20} /> Instalar aplicativo
                  </button>
                )}

                {showInstallHelp && !isInstalled && (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-left text-sm text-gray-700 space-y-3">
                    <p className="font-bold text-blue-900">Como instalar no seu aparelho</p>
                    <div>
                      <strong className="flex items-center gap-1"><Smartphone size={15} /> iPhone / iPad</strong>
                      Abra este link no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.
                    </div>
                    <div>
                      <strong className="flex items-center gap-1"><PlusSquare size={15} /> Android</strong>
                      Se a instalação não abrir automaticamente, use o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.
                    </div>
                    <div>
                      <strong className="flex items-center gap-1"><Download size={15} /> Computador</strong>
                      No Chrome ou Edge, procure o ícone de instalação na barra de endereço ou no menu do navegador.
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreConfiguracaoFamilia;
