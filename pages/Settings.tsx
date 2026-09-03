import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { UserSettings } from '../types';
import { Settings as SettingsIcon, Save, Moon, Sun, Lock, KeyRound, X, CheckCircle2, ShieldCheck, Image as ImageIcon, Maximize2, Palette, Bell, Info } from 'lucide-react';

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

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
      theme: 'light',
      houseName: '',
      primaryColor: 'indigo',
      integrations: { openBanking: false, saneago: false, equatorial: false },
      backgroundZoom: 100,
      backgroundOpacity: 100,
      backgroundFit: 'cover',
      cardOpacity: 40,
      cardFullScreen: false,
      logoShape: 'square',
      logoZoom: 100,
      logoSize: 100,
      customCategories: [],
      categories: ['Fixa', 'Variável', 'Cartão', 'Imposto']
  });
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newMember, setNewMember] = useState('');
  
  // PIN Change State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinForm, setPinForm] = useState({ current: '', new: '', confirm: '' });
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Keyword State
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [keywordForm, setKeywordForm] = useState({ currentPin: '', keyword: '' });
  const [keywordError, setKeywordError] = useState('');
  const [keywordSuccess, setKeywordSuccess] = useState('');
  
  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Position Modal State
  const [positionModal, setPositionModal] = useState<'background' | 'logo' | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [tempPosition, setTempPosition] = useState({ x: 50, y: 50 });
  const [tempZoom, setTempZoom] = useState(100);
  const [tempOpacity, setTempOpacity] = useState(100);
  const [tempCardOpacity, setTempCardOpacity] = useState(40);
  const [tempCardFullScreen, setTempCardFullScreen] = useState(false);
  const [tempShape, setTempShape] = useState<'circle' | 'square'>('square');
  const [tempLogoSize, setTempLogoSize] = useState(100);
  const [tempFit, setTempFit] = useState<'cover' | 'contain'>('cover');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
      const s = await db.getSettings();
      setSettings({
          ...s,
          backgroundZoom: s.backgroundZoom ?? 100,
          backgroundOpacity: s.backgroundOpacity ?? 100,
          backgroundFit: s.backgroundFit ?? 'cover',
          cardOpacity: s.cardOpacity ?? 40,
          cardFullScreen: s.cardFullScreen ?? false,
          logoShape: s.logoShape ?? 'square',
          logoZoom: s.logoZoom ?? 100,
          logoSize: s.logoSize ?? 100,
          customCategories: s.customCategories ?? [],
          categories: s.categories ?? ['Fixa', 'Variável', 'Cartão', 'Imposto'],
          members: s.members ?? ['Eu']
      });
      setNotificationsEnabled(!!s.notificationsEnabled);
  };

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
        alert('Seu navegador não suporta notificações.');
        return;
    }

    const newState = !notificationsEnabled;

    // If turning ON, check permission
    if (newState) {
        if (Notification.permission === 'denied') {
            alert('As notificações estão bloqueadas pelo navegador.\n\nPara ativar:\n1. Clique no ícone de cadeado 🔒 ou configurações ao lado da URL.\n2. Encontre "Notificações" e mude para "Permitir".\n3. Recarregue a página.');
            return;
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Para receber alertas, você precisa clicar em "Permitir" quando o navegador solicitar.');
                return;
            }
        }
        
        // Permission granted, send test
        new Notification('Notificações Ativadas', { body: 'Você receberá alertas sobre novas atividades.' });
    }

    // Update state and persist
    setNotificationsEnabled(newState);
    const updatedSettings = { ...settings, notificationsEnabled: newState };
    setSettings(updatedSettings);
    await db.updateSettings(updatedSettings);
  };

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleSave = async () => {
    await db.updateSettings(settings);
    
    // Apply theme
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply primary color
    const colorHex = colors[settings.primaryColor as keyof typeof colors] || colors.indigo;
    document.documentElement.style.setProperty('--primary-50', `${colorHex}1a`);
    document.documentElement.style.setProperty('--primary-100', `${colorHex}33`);
    document.documentElement.style.setProperty('--primary-500', colorHex);
    document.documentElement.style.setProperty('--primary-600', colorHex);
    document.documentElement.style.setProperty('--primary-700', colorHex);
    
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            if (type === 'background') {
                setSettings({ ...settings, backgroundImage: base64String });
            } else {
                setSettings({ ...settings, logoImage: base64String });
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const openPositionModal = (type: 'background' | 'logo') => {
    const currentPos = type === 'background' ? settings.backgroundPosition : settings.logoPosition;
    if (currentPos) {
        const [x, y] = currentPos.split(' ').map(v => parseInt(v));
        setTempPosition({ x: x || 50, y: y || 50 });
    } else {
        setTempPosition({ x: 50, y: 50 });
    }

    if (type === 'background') {
        setTempZoom(settings.backgroundZoom || 100);
        setTempOpacity(settings.backgroundOpacity ?? 100);
        setTempFit(settings.backgroundFit || 'cover');
        setTempCardOpacity(settings.cardOpacity ?? 40);
        setTempCardFullScreen(settings.cardFullScreen ?? false);
    } else {
        setTempZoom(settings.logoZoom || 100);
        setTempShape(settings.logoShape || 'square');
        setTempLogoSize(settings.logoSize || 100);
    }

    setPositionModal(type);
  };

  const savePosition = () => {
    const posString = `${tempPosition.x}% ${tempPosition.y}%`;
    if (positionModal === 'background') {
        setSettings({ 
            ...settings, 
            backgroundPosition: posString,
            backgroundZoom: tempZoom,
            backgroundOpacity: tempOpacity,
            backgroundFit: tempFit,
            cardOpacity: tempCardOpacity,
            cardFullScreen: tempCardFullScreen
        });
    } else if (positionModal === 'logo') {
        setSettings({ 
            ...settings, 
            logoPosition: posString,
            logoZoom: tempZoom,
            logoShape: tempShape,
            logoSize: tempLogoSize
        });
    }
    setPositionModal(null);
  };

  // --- PIN LOGIC ---
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('homefin_user_pin');

    if (pinForm.current !== storedPin) {
        setPinError('O PIN atual está incorreto.');
        return;
    }
    if (pinForm.new.length !== 4 || isNaN(Number(pinForm.new))) {
        setPinError('O novo PIN deve ter 4 números.');
        return;
    }
    if (pinForm.new !== pinForm.confirm) {
        setPinError('A confirmação do PIN não coincide.');
        return;
    }

    localStorage.setItem('homefin_user_pin', pinForm.new);
    setPinError('');
    setPinSuccess('Senha alterada com sucesso!');
    setPinForm({ current: '', new: '', confirm: '' });
    
    setTimeout(() => {
        setIsPinModalOpen(false);
        setPinSuccess('');
    }, 1500);
  };

  // --- KEYWORD LOGIC ---
  const handleSaveKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('homefin_user_pin');

    if (keywordForm.currentPin !== storedPin) {
        setKeywordError('PIN incorreto para autorizar a mudança.');
        return;
    }

    if (!keywordForm.keyword || keywordForm.keyword.trim().length < 3) {
        setKeywordError('A palavra-chave deve ter pelo menos 3 letras.');
        return;
    }

    localStorage.setItem('homefin_user_keyword', keywordForm.keyword.trim().toLowerCase());
    setKeywordError('');
    setKeywordSuccess('Palavra-chave de recuperação salva!');
    setKeywordForm({ currentPin: '', keyword: '' });

    setTimeout(() => {
        setIsKeywordModalOpen(false);
        setKeywordSuccess('');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2 mb-6">
        <SettingsIcon className="text-primary-600" /> Configurações
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
          title="Como funcionam as Configurações?"
        >
          <Info size={18} />
        </button>
      </h2>

      <div className="space-y-6">
        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-6">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary-500" /> Aparência
            </h3>
            
            {/* Theme Toggle */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tema do Aplicativo</label>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSettings({...settings, theme: 'light'})}
                        className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${settings.theme === 'light' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Sun /> Claro
                    </button>
                    <button 
                        onClick={() => setSettings({...settings, theme: 'dark'})}
                        className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${settings.theme === 'dark' ? 'border-primary-500 bg-gray-700 text-white' : 'border-gray-200 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <Moon /> Escuro
                    </button>
                </div>
            </div>

            {/* Primary Color Picker */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cor Principal</label>
                <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
                    {Object.entries(colors).map(([name, hex]) => (
                        <button
                            key={name}
                            onClick={() => setSettings({...settings, primaryColor: name})}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${settings.primaryColor === name ? 'border-gray-900 dark:border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: hex }}
                            title={name}
                        />
                    ))}
                </div>
            </div>

            {/* Background Image Upload */}
            <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Imagem de Fundo (Login)</label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <ImageIcon size={20} className="text-gray-400" />
                        <span className="text-sm text-gray-500">Upload de Fundo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'background')} />
                    </label>
                    {settings.backgroundImage && (
                        <button 
                            onClick={() => openPositionModal('background')}
                            className="flex items-center justify-center gap-2 p-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-xl hover:bg-primary-100 transition-colors"
                        >
                            <Maximize2 size={20} />
                            <span className="text-sm font-bold">Ajustar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Logotipo Personalizado</label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <SettingsIcon size={20} className="text-gray-400" />
                        <span className="text-sm text-gray-500">Upload de Logo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'logo')} />
                    </label>
                    {settings.logoImage && (
                        <button 
                            onClick={() => openPositionModal('logo')}
                            className="flex items-center justify-center gap-2 p-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-xl hover:bg-primary-100 transition-colors"
                        >
                            <Maximize2 size={20} />
                            <span className="text-sm font-bold">Ajustar</span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Categories Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary-500" /> Categorias de Contas
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie todas as categorias disponíveis para suas contas. Você pode adicionar, remover ou editar qualquer categoria.</p>
            
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="Nome da categoria..."
                    className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <button 
                    onClick={() => {
                        if (newCategory.trim()) {
                            const newCat = newCategory.trim();
                            // Prevent duplicates
                            if (!settings.categories?.includes(newCat)) {
                                setSettings({
                                    ...settings,
                                    categories: [...(settings.categories || []), newCat]
                                });
                            }
                            setNewCategory('');
                        }
                    }}
                    className="px-2 py-1 bg-primary-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-primary-700 shrink-0 self-center"
                >
                    Adicionar
                </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
                {settings.categories?.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full text-sm dark:text-gray-200 group">
                        {cat}
                        <button 
                            onClick={() => {
                                setSettings({
                                    ...settings,
                                    categories: settings.categories?.filter((_, i) => i !== idx)
                                });
                            }}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover categoria"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
                {(!settings.categories || settings.categories.length === 0) && (
                    <p className="text-xs text-gray-400 italic">Nenhuma categoria definida.</p>
                )}
            </div>
        </div>

        {/* Members Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary-500" /> Membros da Família
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Adicione pessoas para atribuir gastos a elas (ex: Pedro, Maria, Filho).</p>
            
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={newMember}
                    onChange={e => setNewMember(e.target.value)}
                    placeholder="Nome do membro..."
                    className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <button 
                    onClick={() => {
                        if (newMember.trim()) {
                            const newMem = newMember.trim();
                            if (!settings.members?.includes(newMem)) {
                                setSettings({
                                    ...settings,
                                    members: [...(settings.members || []), newMem]
                                });
                            }
                            setNewMember('');
                        }
                    }}
                    className="px-2 py-1 bg-primary-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-primary-700 shrink-0 self-center"
                >
                    Adicionar
                </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
                {settings.members?.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full text-sm dark:text-gray-200 group">
                        {member}
                        <button 
                            onClick={() => {
                                setSettings({
                                    ...settings,
                                    members: settings.members?.filter((_, i) => i !== idx)
                                });
                            }}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover membro"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
                {(!settings.members || settings.members.length === 0) && (
                    <p className="text-xs text-gray-400 italic">Nenhum membro definido.</p>
                )}
            </div>
        </div>

        {/* General Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg dark:text-white">Geral</h3>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Casa</label>
                <input 
                    type="text" 
                    value={settings.houseName}
                    onChange={e => setSettings({...settings, houseName: e.target.value})}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
            </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" /> Notificações
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Receba alertas sobre novas contas, metas e atividades.</p>
            
            <button
                onClick={handleToggleNotifications}
                className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                        <Bell size={20} />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Alertas do Sistema</p>
                        <p className="text-xs text-gray-500">{notificationsEnabled ? 'Ativado' : 'Desativado (Clique para ativar)'}</p>
                    </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notificationsEnabled ? 'left-7' : 'left-1'}`} />
                </div>
            </button>

            <div className="pt-4 border-t dark:border-gray-700 space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Lembrete Automático de Contas</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Seja avisado quando uma conta estiver perto do vencimento.</p>
                
                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border rounded-lg dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={settings.notificationPreferences?.push || false}
                            onChange={e => setSettings({
                                ...settings, 
                                notificationPreferences: { ...settings.notificationPreferences, push: e.target.checked, whatsapp: settings.notificationPreferences?.whatsapp || false, email: settings.notificationPreferences?.email || false }
                            })}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium dark:text-gray-200">Push (Navegador)</span>
                    </label>

                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border rounded-lg dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={settings.notificationPreferences?.whatsapp || false}
                                onChange={e => setSettings({
                                    ...settings, 
                                    notificationPreferences: { ...settings.notificationPreferences, whatsapp: e.target.checked, push: settings.notificationPreferences?.push || false, email: settings.notificationPreferences?.email || false }
                                })}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium dark:text-gray-200">WhatsApp</span>
                        </label>
                        {settings.notificationPreferences?.whatsapp && (
                            <input 
                                type="tel" 
                                placeholder="Seu número com DDD"
                                value={settings.notificationPreferences?.whatsappNumber || ''}
                                onChange={e => setSettings({
                                    ...settings,
                                    notificationPreferences: { ...settings.notificationPreferences, whatsappNumber: e.target.value, push: settings.notificationPreferences?.push || false, whatsapp: settings.notificationPreferences?.whatsapp || false, email: settings.notificationPreferences?.email || false }
                                })}
                                className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white ml-8 w-[calc(100%-2rem)]"
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border rounded-lg dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={settings.notificationPreferences?.email || false}
                                onChange={e => setSettings({
                                    ...settings, 
                                    notificationPreferences: { ...settings.notificationPreferences, email: e.target.checked, push: settings.notificationPreferences?.push || false, whatsapp: settings.notificationPreferences?.whatsapp || false }
                                })}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium dark:text-gray-200">E-mail</span>
                        </label>
                        {settings.notificationPreferences?.email && (
                            <input 
                                type="email" 
                                placeholder="Seu endereço de e-mail"
                                value={settings.notificationPreferences?.emailAddress || ''}
                                onChange={e => setSettings({
                                    ...settings,
                                    notificationPreferences: { ...settings.notificationPreferences, emailAddress: e.target.value, push: settings.notificationPreferences?.push || false, whatsapp: settings.notificationPreferences?.whatsapp || false, email: settings.notificationPreferences?.email || false }
                                })}
                                className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white ml-8 w-[calc(100%-2rem)]"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Security Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" /> Segurança
            </h3>
            
            <button
                onClick={() => setIsPinModalOpen(true)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600">
                        <KeyRound size={20} />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Alterar Senha de Acesso</p>
                        <p className="text-xs text-gray-500">Mudar seu PIN de 4 dígitos</p>
                    </div>
                </div>
                <div className="text-gray-400 group-hover:text-primary-600 transition-colors">
                    →
                </div>
            </button>

            <button
                onClick={() => setIsKeywordModalOpen(true)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Palavra-chave de Recuperação</p>
                        <p className="text-xs text-gray-500">Para recuperar a conta se esquecer o PIN</p>
                    </div>
                </div>
                <div className="text-gray-400 group-hover:text-emerald-600 transition-colors">
                    →
                </div>
            </button>
        </div>

        <button 
            onClick={handleSave}
            className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-700 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        >
            <Save size={20} /> {settingsSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Position Adjustment Modal */}
      {positionModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                    <h3 className="font-bold text-lg dark:text-white">Ajustar {positionModal === 'background' ? 'Fundo' : 'Logo'}</h3>
                    <button onClick={() => setPositionModal(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500 dark:text-gray-400"><X size={20} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Preview Area */}
                    <div className="aspect-[9/16] w-full max-w-[240px] mx-auto bg-gray-900 rounded-2xl overflow-hidden relative border-4 border-gray-800 shadow-2xl">
                        {/* Background Layer */}
                        {(positionModal === 'background' || settings.backgroundImage) && (
                            <div 
                                className="absolute inset-0 bg-no-repeat transition-all duration-200 ease-out"
                                style={{ 
                                    backgroundImage: `url(${settings.backgroundImage})`,
                                    backgroundPosition: positionModal === 'background' 
                                        ? `${tempPosition.x}% ${tempPosition.y}%` 
                                        : settings.backgroundPosition,
                                    backgroundSize: positionModal === 'background'
                                        ? (tempFit === 'contain' ? 'contain' : `${tempZoom}%`)
                                        : (settings.backgroundFit === 'contain' ? 'contain' : `${settings.backgroundZoom || 100}%`),
                                    opacity: positionModal === 'background'
                                        ? tempOpacity / 100
                                        : (settings.backgroundOpacity !== undefined ? settings.backgroundOpacity / 100 : 1),
                                }}
                            />
                        )}
                        
                        {/* Logo Layer */}
                        {(positionModal === 'logo' || settings.logoImage) && (
                            <div className="absolute inset-0 flex items-start justify-center pt-12 pointer-events-none">
                                <div 
                                    className="overflow-hidden drop-shadow-lg"
                                    style={{
                                        width: `${96 * ((positionModal === 'logo' ? tempLogoSize : (settings.logoSize || 100)) / 100)}px`,
                                        height: `${96 * ((positionModal === 'logo' ? tempLogoSize : (settings.logoSize || 100)) / 100)}px`,
                                        borderRadius: positionModal === 'logo'
                                            ? (tempShape === 'circle' ? '50%' : '12px')
                                            : (settings.logoShape === 'circle' ? '50%' : '12px')
                                    }}
                                >
                                    <img 
                                        src={settings.logoImage} 
                                        alt="Logo Preview" 
                                        className="w-full h-full object-cover transition-all duration-200 ease-out"
                                        style={{ 
                                            objectPosition: positionModal === 'logo' 
                                                ? `${tempPosition.x}% ${tempPosition.y}%` 
                                                : settings.logoPosition,
                                            transform: positionModal === 'logo' 
                                                ? `scale(${tempZoom / 100})` 
                                                : `scale(${(settings.logoZoom || 100) / 100})`,
                                        }} 
                                    />
                                </div>
                            </div>
                        )}

                        {/* Mock UI Overlay */}
                        <div className={`absolute inset-0 flex flex-col justify-end p-6 pointer-events-none ${positionModal === 'background' && tempCardFullScreen ? 'p-0' : ''}`}>
                            <div 
                                className={`bg-white/10 backdrop-blur-md rounded-xl p-4 w-full border border-white/20 transition-all duration-300 ${positionModal === 'background' && tempCardFullScreen ? 'h-full rounded-none border-none' : 'h-1/3'}`}
                                style={{ 
                                    backgroundColor: `rgba(255, 255, 255, ${(positionModal === 'background' ? tempCardOpacity : (settings.cardOpacity ?? 40)) / 100})` 
                                }}
                            ></div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="space-y-6">
                        {/* Common Position Controls */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Posição</h4>
                            <div>
                                <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    <span>Horizontal (X)</span>
                                    <span>{tempPosition.x}%</span>
                                </label>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={tempPosition.x} 
                                    onChange={e => setTempPosition({...tempPosition, x: Number(e.target.value)})}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    <span>Vertical (Y)</span>
                                    <span>{tempPosition.y}%</span>
                                </label>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={tempPosition.y} 
                                    onChange={e => setTempPosition({...tempPosition, y: Number(e.target.value)})}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                />
                            </div>
                        </div>

                        {/* Specific Controls */}
                        {positionModal === 'background' && (
                            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Ajustes do Fundo</h4>
                                
                                {/* Fit Toggle */}
                                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setTempFit('cover')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tempFit === 'cover' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        Preencher (Cover)
                                    </button>
                                    <button 
                                        onClick={() => setTempFit('contain')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tempFit === 'contain' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        Ajustar (Contain)
                                    </button>
                                </div>

                                {tempFit === 'cover' && (
                                    <div>
                                        <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                            <span>Zoom da Imagem</span>
                                            <span>{tempZoom}%</span>
                                        </label>
                                        <input 
                                            type="range" min="100" max="300" 
                                            value={tempZoom} 
                                            onChange={e => setTempZoom(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        <span>Opacidade da Imagem</span>
                                        <span>{tempOpacity}%</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={tempOpacity} 
                                        onChange={e => setTempOpacity(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                    />
                                </div>

                                <div className="pt-4 border-t dark:border-gray-700 space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Ajustes do Card</h4>
                                    
                                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cobrir Tela Inteira</span>
                                        <button 
                                            onClick={() => setTempCardFullScreen(!tempCardFullScreen)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${tempCardFullScreen ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${tempCardFullScreen ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                            <span>Opacidade do Card</span>
                                            <span>{tempCardOpacity}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" 
                                            value={tempCardOpacity} 
                                            onChange={e => setTempCardOpacity(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {positionModal === 'logo' && (
                            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Estilo do Logo</h4>
                                
                                {/* Shape Toggle */}
                                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setTempShape('circle')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tempShape === 'circle' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        Redondo
                                    </button>
                                    <button 
                                        onClick={() => setTempShape('square')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tempShape === 'square' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        Quadrado
                                    </button>
                                </div>

                                <div>
                                    <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        <span>Tamanho do Contêiner</span>
                                        <span>{tempLogoSize}%</span>
                                    </label>
                                    <input 
                                        type="range" min="50" max="150" 
                                        value={tempLogoSize} 
                                        onChange={e => setTempLogoSize(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                    />
                                </div>

                                <div>
                                    <label className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        <span>Zoom Interno (Imagem)</span>
                                        <span>{tempZoom}%</span>
                                    </label>
                                    <input 
                                        type="range" min="50" max="200" 
                                        value={tempZoom} 
                                        onChange={e => setTempZoom(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex gap-3">
                    <button 
                        onClick={() => setPositionModal(null)}
                        className="flex-1 py-3 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={savePosition}
                        className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-transform active:scale-[0.98]"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* PIN Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                    <h3 className="font-bold text-lg dark:text-white">Alterar Senha (PIN)</h3>
                    <button onClick={() => setIsPinModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500 dark:text-gray-400"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleChangePin} className="p-6 space-y-5">
                    {pinSuccess ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center animate-in zoom-in">
                            <CheckCircle2 size={32} />
                            <span className="font-bold">{pinSuccess}</span>
                        </div>
                    ) : (
                        <>
                            {pinError && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center font-medium animate-in slide-in-from-top-2">
                                    {pinError}
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">PIN Atual</label>
                                <input 
                                    type="password" inputMode="numeric" maxLength={4}
                                    value={pinForm.current}
                                    onChange={e => setPinForm({...pinForm, current: e.target.value.replace(/\D/g,'')})}
                                    className="w-full text-center text-3xl tracking-[0.5em] font-bold p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                                    placeholder="••••"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Novo PIN</label>
                                    <input 
                                        type="password" inputMode="numeric" maxLength={4}
                                        value={pinForm.new}
                                        onChange={e => setPinForm({...pinForm, new: e.target.value.replace(/\D/g,'')})}
                                        className="w-full text-center text-xl tracking-[0.2em] font-bold p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                        placeholder="••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Confirmar</label>
                                    <input 
                                        type="password" inputMode="numeric" maxLength={4}
                                        value={pinForm.confirm}
                                        onChange={e => setPinForm({...pinForm, confirm: e.target.value.replace(/\D/g,'')})}
                                        className="w-full text-center text-xl tracking-[0.2em] font-bold p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                        placeholder="••••"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] mt-2"
                            >
                                Confirmar Alteração
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
      )}

      {/* Keyword Modal */}
      {isKeywordModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                    <h3 className="font-bold text-lg dark:text-white">Palavra-chave</h3>
                    <button onClick={() => setIsKeywordModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500 dark:text-gray-400"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSaveKeyword} className="p-6 space-y-5">
                    {keywordSuccess ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center animate-in zoom-in">
                            <CheckCircle2 size={32} />
                            <span className="font-bold">{keywordSuccess}</span>
                        </div>
                    ) : (
                        <>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                Esta palavra servirá para recuperar seu acesso caso esqueça o PIN. Memorize-a bem!
                            </div>

                            {keywordError && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center font-medium animate-in slide-in-from-top-2">
                                    {keywordError}
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">PIN Atual (Confirmação)</label>
                                <input 
                                    type="password" inputMode="numeric" maxLength={4}
                                    value={keywordForm.currentPin}
                                    onChange={e => setKeywordForm({...keywordForm, currentPin: e.target.value.replace(/\D/g,'')})}
                                    className="w-full text-center text-xl tracking-[0.2em] font-bold p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="••••"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Palavra-chave</label>
                                <input 
                                    type="text"
                                    value={keywordForm.keyword}
                                    onChange={e => setKeywordForm({...keywordForm, keyword: e.target.value})}
                                    className="w-full text-center text-lg font-bold p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none lowercase"
                                    placeholder="ex: cachorro"
                                    autoComplete="off"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-2"
                            >
                                Salvar Palavra-chave
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
      )}
      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funcionam as Configurações?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300 max-h-[60vh] overflow-y-auto">
              <p>
                A área de <strong>Configurações</strong> permite personalizar totalmente a aparência e a segurança do seu aplicativo.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Palette size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Aparência:</strong>
                    <p className="mt-1 opacity-90">
                      Escolha entre o tema Claro ou Escuro, defina sua cor principal favorita e personalize a imagem de fundo da tela de login e o logo da sua casa.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <SettingsIcon size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Dados da Casa:</strong>
                    <p className="mt-1 opacity-90">
                      Defina o nome da sua casa (ex: "Família Silva"), adicione ou remova membros da família e crie categorias personalizadas para organizar suas despesas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Lock size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Segurança:</strong>
                    <p className="mt-1 opacity-90">
                      Altere seu PIN de acesso de 4 dígitos e defina uma "Palavra-chave de Recuperação". Essa palavra é essencial caso você esqueça seu PIN no futuro.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;