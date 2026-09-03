import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saasDb } from '../services/saasDb';
import { db } from '../services/db';
import { UserSettings } from '../types';
import { ArrowLeft, Upload, Copy, Check, Share, PlusSquare, X } from 'lucide-react';

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'background') {
          setFormData(prev => ({ ...prev, backgroundImage: base64String }));
        } else {
          setFormData(prev => ({ ...prev, logoImage: base64String }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.familyName || !formData.pin || !formData.keyword) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (formData.pin.length !== 4) {
      setError('O PIN deve ter 4 dígitos.');
      return;
    }

    // Create Family in SaaS DB
    const plan = location.state?.plan || 'free';
    const newFamily = saasDb.createFamily(formData.familyName, plan, {
      houseName: formData.familyName,
      primaryColor: formData.color,
      // ... other defaults
    });

    // Set expiration for premium plans (30 days)
    if (plan === 'premium') {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      saasDb.updateFamily(newFamily.id, { expiresAt: expiresAt.toISOString() });
    }

    // Mark code as used
    if (code) {
      saasDb.useCode(code, newFamily.id);
    }

    // Initialize Local DB for this session (Simulating multi-tenant login)
    // In a real app, this would fetch from server. Here we reset local storage with new settings.
    
    // 1. Initialize DB with new Family ID
    db.init(newFamily.id);

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
    
    // 2. Save PIN and Keyword with namespaced keys
    const pinKey = `homefin_user_pin_${newFamily.id}`;
    const keywordKey = `homefin_user_keyword_${newFamily.id}`;
    
    localStorage.setItem(pinKey, formData.pin);
    localStorage.setItem(keywordKey, formData.keyword.toLowerCase());

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
              navigate('/plans');
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
                type="password" maxLength={4} inputMode="numeric"
                value={formData.pin}
                onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g,'')})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-widest font-mono"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-chave (Recuperação)</label>
              <input 
                type="text"
                value={formData.keyword}
                onChange={e => setFormData({...formData, keyword: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none lowercase"
                placeholder="Ex: cachorro"
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

              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-bold text-gray-900 text-sm">Instalar App (PWA)</h3>
                
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
                    <strong className="block text-gray-900 mb-1 flex items-center gap-1"><Share size={12} /> iPhone (iOS)</strong>
                    1. Toque em <strong>Compartilhar</strong><br/>
                    2. Selecione <strong>Adicionar à Tela de Início</strong>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
                    <strong className="block text-gray-900 mb-1 flex items-center gap-1"><PlusSquare size={12} /> Android</strong>
                    1. Toque no menu (3 pontos)<br/>
                    2. Selecione <strong>Instalar aplicativo</strong>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/login')}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 mt-2"
              >
                Ir para Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreConfiguracaoFamilia;
