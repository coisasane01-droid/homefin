import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { storeFamilySession } from '../services/familyAuth';
import { homefinApiUrl } from '../services/nativeApi';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saasDb } from '../services/saasDb';
import { db } from '../services/db';
import { UserSettings } from '../types';
import { ArrowLeft, Upload, Copy, Check, Share, PlusSquare, X, Download, Smartphone, Loader2, Cloud, CloudOff } from 'lucide-react';

type HomeFinInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type HomeFinWindow = Window & {
  __homefinInstallPrompt?: HomeFinInstallPromptEvent | null;
  __homefinAppInstalled?: boolean;
};

const MAX_IMAGE_FILE_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_DATA_URI_CHARS = 850_000;
const MAX_IMAGES_TOTAL_CHARS = 1_500_000;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível reduzir a imagem.'));
    }, type, quality);
  });
}

function blobToDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível carregar a imagem processada.'));
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem processada.'));
    reader.readAsDataURL(blob);
  });
}

async function compressFamilyImage(
  file: File,
  maxDimension: number,
  maxDataUriChars: number
) {
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error('O arquivo original ultrapassa o limite de 40 MB. Escolha uma imagem menor.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem selecionada.'));
      image.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('A imagem selecionada não possui dimensões válidas.');
    }

    const initialScale = Math.min(
      1,
      maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement('canvas');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const scale = initialScale * Math.pow(0.86, attempt);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a imagem.');

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.48, 0.86 - attempt * 0.045);
      const blob = await canvasToBlob(canvas, 'image/webp', quality);
      const dataUri = await blobToDataUri(blob);

      if (!/^data:image\/(?:webp|jpeg|png);base64,/.test(dataUri)) {
        throw new Error('O navegador gerou um formato de imagem não suportado.');
      }
      if (dataUri.length <= maxDataUriChars) return dataUri;
    }

    throw new Error('A imagem continua acima do limite após a compressão. Escolha outra imagem.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  const { t } = useTranslation();
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
  const [installPrompt, setInstallPrompt] = useState<HomeFinInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [completionWarning, setCompletionWarning] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationCompleted, setCreationCompleted] = useState(false);
  const [createdFamilyId, setCreatedFamilyId] = useState('');
  const [familySyncStatus, setFamilySyncStatus] = useState<'pending' | 'synced' | 'conflict' | null>(null);
  const saveInProgressRef = useRef(false);

  useEffect(() => {
    const handleFamilySyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{
        familyId: string;
        status: 'pending' | 'synced' | 'conflict';
      }>).detail;
      if (detail?.familyId === createdFamilyId) setFamilySyncStatus(detail.status);
    };
    window.addEventListener('homefin-family-sync-status', handleFamilySyncStatus);
    return () => window.removeEventListener('homefin-family-sync-status', handleFamilySyncStatus);
  }, [createdFamilyId]);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const iosDevice =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safariBrowser =
      /Safari/i.test(userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/i.test(userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    setIsIOS(iosDevice);
    setIsSafari(safariBrowser);
    setIsInstalled(isStandalone || Boolean((window as HomeFinWindow).__homefinAppInstalled));
    setShowInstallHelp(iosDevice && !isStandalone);

    const syncInstallPrompt = () => {
      setInstallPrompt((window as HomeFinWindow).__homefinInstallPrompt || null);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstallHelp(false);
    };

    syncInstallPrompt();
    window.addEventListener('homefin-install-available', syncInstallPrompt);
    window.addEventListener('homefin-app-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('homefin-install-available', syncInstallPrompt);
      window.removeEventListener('homefin-app-installed', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'dismissed') setShowInstallHelp(true);
      } catch (error) {
        console.error('Não foi possível abrir a instalação do HomeFin:', error);
        setShowInstallHelp(true);
      } finally {
        setInstallPrompt(null);
        (window as HomeFinWindow).__homefinInstallPrompt = null;
      }
      return;
    }

    setShowInstallHelp(true);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'background' | 'logo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (saveInProgressRef.current) return;
    if (!file.type.startsWith('image/')) {
      setError(t('signup.imageError'));
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setError(t('signup.imageSize'));
      e.target.value = '';
      return;
    }

    const otherImageLength = type === 'background'
      ? formData.logoImage.length
      : formData.backgroundImage.length;
    const availableChars = Math.min(
      MAX_IMAGE_DATA_URI_CHARS,
      MAX_IMAGES_TOTAL_CHARS - otherImageLength
    );
    if (availableChars < 1000) {
      setError(t('signup.imageSpace'));
      e.target.value = '';
      return;
    }

    const maxDimension = type === 'background' ? 1600 : 600;
    setIsCompressing(true);
    setError('');
    try {
      const dataUri = await compressFamilyImage(file, maxDimension, availableChars);
      if (type === 'background') {
        setFormData(prev => ({ ...prev, backgroundImage: dataUri }));
      } else {
        setFormData(prev => ({ ...prev, logoImage: dataUri }));
      }
    } catch (imageError) {
      setError(imageError instanceof Error
        ? imageError.message
        : 'Não foi possível processar a imagem. Tente outro arquivo.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInProgressRef.current || isCompressing || creationCompleted) return;
    if (!formData.familyName || !formData.pin || !formData.keyword) {
      setError(t('signup.required'));
      return;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      setError(t('signup.pinError'));
      return;
    }
    if (formData.keyword.trim().length < 8 || formData.keyword.trim().length > 256) {
      setError(t('signup.keywordError'));
      return;
    }

    saveInProgressRef.current = true;
    setIsSubmitting(true);
    setError('');
    let familyCreated = false;
    try {
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
    const enrollmentResponse = await fetch(homefinApiUrl('/api/family-auth'), {
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
    const enrollmentData = await enrollmentResponse.json().catch(() => null);

    if (!enrollmentResponse.ok || !enrollmentData?.success) {
      setError(
        enrollmentData?.error ||
        'Não foi possível criar a família. Verifique a configuração do servidor.'
      );
      return;
    }
    familyCreated = true;
    setCreationCompleted(true);

    const newFamily = enrollmentData.family;
    const confirmedFamilyId = String(newFamily?.id || familyId);
    const link = `${window.location.origin}/#/login?family=${encodeURIComponent(confirmedFamilyId)}`;
    setCreatedFamilyId(confirmedFamilyId);
    setGeneratedLink(link);
    setFamilySyncStatus('pending');
    localStorage.setItem('homefin_current_family_id', newFamily.id);
    localStorage.setItem('homefin_current_family_name', newFamily.name);
    setShowSuccessModal(true);

    // Guardar a sessão do servidor antes de inicializar ou sincronizar dados.
    if (!enrollmentData.token) {
      setCompletionWarning('A família foi criada, mas a sessão automática não foi confirmada. Use o link de acesso e entre com o PIN informado.');
      return;
    }

    await storeFamilySession(newFamily.id, {
      token: enrollmentData.token,
      expiresIn: Number(enrollmentData.expiresIn) || 43200,
    });
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
    await db.sync();
    setFamilySyncStatus(db.getSyncStatus(newFamily.id) || 'pending');

    // Registrar o uso do código promocional após atualizar o cache com os dados atuais.
    if (code) {
      try {
        saasDb.useCode(code, newFamily.id);
      } catch (codeError) {
        console.error('Não foi possível atualizar o uso do código promocional.', codeError);
      }
    }

    } catch (saveError) {
      console.error('Falha ao concluir o cadastro familiar:', saveError);
      if (familyCreated) {
        setCompletionWarning('A família foi criada no servidor, mas a preparação ou sincronização deste dispositivo não foi concluída. Não tente cadastrá-la novamente. Seus dados de acesso foram preservados; tente entrar pelo link abaixo.');
        setShowSuccessModal(true);
        setCreationCompleted(true);
      } else {
        setError('Não foi possível concluir o cadastro. Os dados preenchidos foram mantidos; verifique a conexão e tente novamente.');
      }
    } finally {
      saveInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in zoom-in duration-300 relative">
        <div className="absolute top-5 right-5 z-50">
          <LanguageSelector />
        </div>
        <button 
          disabled={isCompressing || isSubmitting}
          onClick={() => {
            if (location.state?.plan) {
              navigate('/plans', { state: { flow: 'signup' } });
            } else {
              navigate('/');
            }
          }} 
          className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title={t("signup.back")}
        >
          <ArrowLeft size={24} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-6 text-center">{t("signup.title")}</h2>
        <p className="text-gray-500 mb-6 text-center">{t("signup.subtitle")}</p>

        <form onSubmit={handleSave}>
          <fieldset disabled={isCompressing || isSubmitting || creationCompleted} className="space-y-4 border-0 p-0 m-0 min-w-0">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
              {error}
              {creationCompleted && createdFamilyId && (
                <p className="mt-2 font-semibold">{t("signup.familyCode")} {createdFamilyId}</p>
              )}
              {creationCompleted && generatedLink && (
                <a href={generatedLink} className="mt-2 block font-semibold underline">
                  Abrir acesso da família
                </a>
              )}
            </div>
          )}
          {(isCompressing || isSubmitting) && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm font-medium text-indigo-700" role="status" aria-live="polite">
              <Loader2 size={18} className="animate-spin" />
              {isCompressing ? t('signup.resizing') : t('signup.saving')}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("signup.familyName")}</label>
            <input 
              type="text" 
              value={formData.familyName}
              onChange={e => setFormData({...formData, familyName: e.target.value})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={t("signup.familyExample")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("signup.pinAccess")}</label>
              <input 
                type="password" minLength={4} maxLength={4} pattern="[0-9]{4}" required inputMode="numeric"
                value={formData.pin}
                onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g,'')})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-widest font-mono"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("signup.keyword")}</label>
              <input 
                type="text" minLength={8} maxLength={256} required
                value={formData.keyword}
                onChange={e => setFormData({...formData, keyword: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none lowercase"
                placeholder={t("signup.keywordExample")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("signup.logo")}</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
                  {formData.logoImage ? (
                    <img src={formData.logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload size={20} />
                      <span className="text-xs mt-1">{t("signup.upload")}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => void handleImageUpload(e, 'logo')} />
                </label>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("signup.background")}</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
                  {formData.backgroundImage ? (
                    <img src={formData.backgroundImage} alt="Background" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload size={20} />
                      <span className="text-xs mt-1">{t("signup.upload")}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => void handleImageUpload(e, 'background')} />
                </label>
             </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{t("signup.logoStyle")}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("signup.theme")}</label>
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
            disabled={isCompressing || isSubmitting || creationCompleted}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 mt-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t('signup.submitting') : creationCompleted ? t('signup.completed') : t('signup.finish')}
          </button>
          </fieldset>
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
              
              <h2 className="text-2xl font-bold text-gray-900">{t("signup.congratulations")}</h2>
              <p className="text-gray-600">
                {t("signup.created")}<br/>
                <span className="font-medium text-gray-900">Seja bem-vindo à família {formData.familyName}!</span>
              </p>

              {completionWarning && (
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
                  {completionWarning}
                </p>
              )}

              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-2 rounded-xl p-3 text-left text-sm ${
                  familySyncStatus === 'synced'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {familySyncStatus === 'synced'
                  ? <Cloud size={18} className="mt-0.5 shrink-0" />
                  : <CloudOff size={18} className="mt-0.5 shrink-0" />}
                <span>
                  {familySyncStatus === 'synced'
                    ? t('signup.synced')
                    : familySyncStatus === 'conflict'
                      ? t('signup.conflict')
                      : t('signup.pending')}
                </span>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 text-left">{t("signup.accessLink")}</label>
                <div className="flex gap-2">
                  <input 
                    readOnly 
                    value={generatedLink} 
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none"
                  />
                  <button 
                    onClick={copyLink}
                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    title={t("signup.copyLink")}
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

              {!isInstalled && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-bold text-gray-900 text-sm">{t("signup.installTitle")}</h3>
                  {isIOS ? (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-left text-sm text-gray-700">
                      <strong className="mb-1 flex items-center gap-1 text-blue-900">
                        <Smartphone size={15} /> {t("signup.iphone")}
                      </strong>
                      {isSafari
                        ? t('signup.safari')
                        : t('signup.openSafari')}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleInstallApp}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                      >
                        {installPrompt ? (
                          <><Download size={20} /> {t("signup.install")}</>
                        ) : (
                          <><PlusSquare size={20} /> {t("signup.instructions")}</>
                        )}
                      </button>

                      {showInstallHelp && (
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-left text-sm text-gray-700 space-y-3">
                          <p className="font-bold text-blue-900">{t("signup.nativeUnavailable")}</p>
                          <div>
                            <strong className="flex items-center gap-1"><PlusSquare size={15} /> {t("signup.android")}</strong>
                            {t("signup.androidHelp")}
                          </div>
                          <div>
                            <strong className="flex items-center gap-1"><Download size={15} /> {t("signup.computer")}</strong>
                            {t("signup.computerHelp")}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreConfiguracaoFamilia;
