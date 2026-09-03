import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saasDb, AccessCode, Family, Plan, LandingConfig, PaymentConfig, AppBannerConfig } from '../services/saasDb';
import { Trash2, RefreshCw, Plus, X, Check, Copy, LogOut, Edit, Save, Image, Layout, Settings, DollarSign, CreditCard, MonitorPlay } from 'lucide-react';

const SuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(saasDb.getLandingConfig());
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(saasDb.getPaymentConfig());
  const [appBannerConfig, setAppBannerConfig] = useState<AppBannerConfig>(saasDb.getAppBannerConfig());
  const [activeTab, setActiveTab] = useState<'codes' | 'families' | 'plans' | 'landing' | 'payments' | 'security' | 'banner'>('codes');
  
  // Security State
  const [securityConfig, setSecurityConfig] = useState({
    newPassword: '',
    confirmPassword: '',
    recoveryKeyword: ''
  });

  // Code Generator State
  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number | ''>('');
  
  // Delete Confirmation State
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  
  // Feedback State
  const [savedTabs, setSavedTabs] = useState<Record<string, boolean>>({});
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const showSavedFeedback = (tab: string) => {
    setSavedTabs(prev => ({ ...prev, [tab]: true }));
    setTimeout(() => {
      setSavedTabs(prev => ({ ...prev, [tab]: false }));
    }, 2000);
  };

  // Plan Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCodes(saasDb.getCodes());
    setFamilies(saasDb.getFamilies());
    setPlans(saasDb.getPlans());
    setLandingConfig(saasDb.getLandingConfig());
    setPaymentConfig(saasDb.getPaymentConfig());
    
    const adminConfig = saasDb.getAdminConfig();
    setSecurityConfig(prev => ({ ...prev, recoveryKeyword: adminConfig.recoveryKeyword || '' }));
  };

  const handleUpdateSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (securityConfig.newPassword && securityConfig.newPassword !== securityConfig.confirmPassword) {
        alert('As novas senhas não coincidem.');
        return;
    }

    const updates: any = {};
    if (securityConfig.newPassword) updates.password = securityConfig.newPassword;
    if (securityConfig.recoveryKeyword) updates.recoveryKeyword = securityConfig.recoveryKeyword;

    if (Object.keys(updates).length > 0) {
        saasDb.updateAdminConfig(updates);
        showSavedFeedback('security');
        setSecurityConfig(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    }
  };

  const handleUpdateLanding = (e: React.FormEvent) => {
    e.preventDefault();
    saasDb.updateLandingConfig(landingConfig);
    showSavedFeedback('landing');
  };

  const handleUpdatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    saasDb.updatePaymentConfig(paymentConfig);
    showSavedFeedback('payments');
  };

  const handleUpdateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    saasDb.updateAppBannerConfig(appBannerConfig);
    showSavedFeedback('banner');
  };

  const handleUpdatePlan = (updatedPlan: Plan) => {
    saasDb.savePlan(updatedPlan);
    loadData();
    setSavedPlanId(updatedPlan.id);
    setTimeout(() => setSavedPlanId(null), 1000);
  };

  const handleGenerateCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setNewCode(randomCode);
  };

  const handleCreateCode = () => {
    if (!newCode) return;
    saasDb.createCode(
      newCode, 
      isUnlimited ? -1 : maxUses, 
      expiresAt || undefined,
      discountPercent === '' ? undefined : Number(discountPercent)
    );
    setNewCode('');
    setMaxUses(1);
    setIsUnlimited(false);
    setExpiresAt('');
    setDiscountPercent('');
    loadData();
  };

  const confirmDeleteCode = (code: string) => {
    setCodeToDelete(code);
  };

  const executeDeleteCode = () => {
    if (codeToDelete) {
      saasDb.deleteCode(codeToDelete);
      setCodeToDelete(null);
      loadData();
    }
  };

  const handleCreatePlan = () => {
    if (!newPlanName) return;
    
    const id = newPlanName.toLowerCase().replace(/\s+/g, '-');
    const newPlan: Plan = {
      id,
      name: newPlanName,
      price: 0,
      period: '/mês',
      features: [],
      cta: 'Assinar',
      popular: false
    };
    
    saasDb.createPlan(newPlan);
    loadData();
    setNewPlanName('');
    setIsPlanModalOpen(false);
  };

  const executeDeletePlan = () => {
    if (planToDelete) {
      saasDb.deletePlan(planToDelete);
      setPlanToDelete(null);
      loadData();
    }
  };

  const executeDeleteFamily = () => {
    if (familyToDelete) {
      saasDb.deleteFamily(familyToDelete);
      setFamilyToDelete(null);
      loadData();
    }
  };

  const handleCopyFamilyLink = async (familyId: string) => {
    const link = `${window.location.origin}/#/login?family=${familyId}`;
    
    // Função auxiliar para o fallback
    const fallbackCopy = () => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        
        // Mantém o elemento "visível" para o DOM, mas transparente
        textArea.style.position = "fixed";
        textArea.style.left = "0";
        textArea.style.top = "0";
        textArea.style.opacity = "0";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          alert('Link de acesso copiado!');
        } else {
          throw new Error('Comando de cópia falhou');
        }
      } catch (err) {
        prompt("Copie o link abaixo:", link);
      }
    };

    // Tenta API moderna primeiro
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        alert('Link de acesso copiado!');
      } catch (err) {
        console.warn('Clipboard API falhou, tentando fallback...', err);
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }
  };

  const handleToggleStatus = (code: string, currentStatus: 'active' | 'inactive') => {
    saasDb.updateCodeStatus(code, currentStatus === 'active' ? 'inactive' : 'active');
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center md:text-left">Painel Super Admin</h1>
          <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('codes')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'codes' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Códigos
              </button>
              <button 
                onClick={() => setActiveTab('families')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'families' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Famílias
              </button>
              <button 
                onClick={() => setActiveTab('plans')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'plans' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Planos
              </button>
              <button 
                onClick={() => setActiveTab('landing')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'landing' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Landing
              </button>
              <button 
                onClick={() => setActiveTab('banner')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'banner' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Banner App
              </button>
              <button 
                onClick={() => setActiveTab('payments')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'payments' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Pagamentos
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${activeTab === 'security' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Segurança
              </button>
            </div>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm md:text-base"
              title="Sair do Painel"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {activeTab === 'codes' && (
          <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
            {/* Generator Panel */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm h-fit">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Plus className="text-indigo-600" /> Novo Código
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCode}
                      onChange={e => setNewCode(e.target.value.toUpperCase())}
                      className="flex-1 p-2 border rounded-lg uppercase font-mono"
                      placeholder="EX: PROMO2026"
                    />
                    <button 
                      onClick={handleGenerateCode}
                      className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                      title="Gerar Aleatório"
                    >
                      <RefreshCw size={20} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Usos</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="number" 
                      min="1"
                      value={maxUses}
                      onChange={e => setMaxUses(Number(e.target.value))}
                      className="flex-1 p-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-400 min-w-0"
                      disabled={isUnlimited}
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={isUnlimited}
                        onChange={e => setIsUnlimited(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      Ilimitado
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (%) (Opcional)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={e => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Ex: 10, 50, 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiração (Opcional)</label>
                  <input 
                    type="date" 
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <button 
                  onClick={handleCreateCode}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                >
                  Criar Código
                </button>
              </div>
            </div>

            {/* List Panel */}
            <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm">
              <h2 className="text-xl font-bold mb-4">Códigos Ativos</h2>
              <div className="w-full">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-2 px-1 sm:px-4">Código</th>
                      <th className="py-2 px-1 sm:px-4 text-center">Desconto</th>
                      <th className="py-2 px-1 sm:px-4 text-center">Usos</th>
                      <th className="py-2 px-1 sm:px-4 hidden sm:table-cell">Expiração</th>
                      <th className="py-2 px-1 sm:px-4 text-center">Status</th>
                      <th className="py-2 px-1 sm:px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((code, index) => (
                      <tr key={`${code.code}-${index}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-1 sm:px-4 font-mono font-bold text-indigo-900 break-all">{code.code}</td>
                        <td className="py-2 px-1 sm:px-4 text-center">
                          {code.discountPercent ? (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">
                              {code.discountPercent}% OFF
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2 px-1 sm:px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                            code.maxUses === -1 
                              ? 'bg-blue-100 text-blue-700' 
                              : code.usedCount >= code.maxUses 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                          }`}>
                            {code.usedCount} / {code.maxUses === -1 ? '∞' : code.maxUses}
                          </span>
                        </td>
                        <td className="py-2 px-1 sm:px-4 text-gray-500 hidden sm:table-cell">
                          {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-2 px-1 sm:px-4 text-center">
                          <button 
                            onClick={() => handleToggleStatus(code.code, code.status)}
                            className={`px-2 py-1 rounded text-[10px] sm:text-xs font-bold uppercase transition-colors ${code.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {code.status === 'active' ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="py-2 px-1 sm:px-4 text-right">
                          <button 
                            onClick={() => confirmDeleteCode(code.code)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {codes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 italic">Nenhum código criado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {codeToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Código?</h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir o código <span className="font-mono font-bold text-indigo-600">{codeToDelete}</span>?
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setCodeToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDeleteCode}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors shadow-lg shadow-red-500/30"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'families' && (
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold mb-4">Famílias Cadastradas</h2>
            <div className="w-full">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 px-1 sm:px-4 hidden sm:table-cell">ID</th>
                    <th className="py-2 px-1 sm:px-4">Nome</th>
                    <th className="py-2 px-1 sm:px-4 text-center">Plano</th>
                    <th className="py-2 px-1 sm:px-4 hidden sm:table-cell">Criado em</th>
                    <th className="py-2 px-1 sm:px-4 text-center">Status</th>
                    <th className="py-2 px-1 sm:px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {families.map((family, index) => (
                    <tr key={`${family.id}-${index}`} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-1 sm:px-4 font-mono text-gray-400 hidden sm:table-cell">{family.id}</td>
                      <td className="py-2 px-1 sm:px-4 font-bold text-gray-900 break-words max-w-[120px] sm:max-w-none">
                        <div>{family.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono font-normal sm:hidden mt-0.5">ID: {family.id}</div>
                      </td>
                      <td className="py-2 px-1 sm:px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase ${family.plan === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {family.plan}
                        </span>
                      </td>
                      <td className="py-2 px-1 sm:px-4 text-gray-500 hidden sm:table-cell">
                        {new Date(family.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-1 sm:px-4 text-center">
                        <span className="text-green-600 font-bold text-[10px] sm:text-xs uppercase">Ativo</span>
                      </td>
                      <td className="py-2 px-1 sm:px-4 text-right">
                        <button 
                          onClick={() => handleCopyFamilyLink(family.id)}
                          className="text-blue-400 hover:text-blue-600 p-1 mr-2"
                          title="Copiar Link de Acesso"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => setFamilyToDelete(family.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Excluir Família"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {families.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 italic">Nenhuma família registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Family Confirmation Modal */}
        {familyToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Família?</h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir a família <span className="font-bold text-indigo-600">{families.find(f => f.id === familyToDelete)?.name}</span>?
                Esta ação removerá todos os dados associados e não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setFamilyToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDeleteFamily}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors shadow-lg shadow-red-500/30"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => setIsPlanModalOpen(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus size={20} /> Novo Plano
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {plans.map((plan, index) => (
                <div key={`${plan.id}-${index}`} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative group">
                  <button 
                    onClick={() => setPlanToDelete(plan.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir Plano"
                  >
                    <Trash2 size={20} />
                  </button>

                  <div className="flex justify-between items-start mb-4 pr-8">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {plan.name}
                        {savedPlanId === plan.id && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                            <Check size={12} /> Salvo
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">ID: {plan.id}</span>
                    </div>
                    {plan.popular && (
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full uppercase">Popular</span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Imagem do Plano (URL ou Upload)</label>
                      <div className="flex gap-2 mb-2">
                        <input 
                          type="text" 
                          value={plan.image || ''}
                          onChange={e => handleUpdatePlan({ ...plan, image: e.target.value })}
                          className="flex-1 p-2 border rounded-lg text-sm"
                          placeholder="https://..."
                        />
                        <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-gray-600 transition-colors">
                          <Image size={20} />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  handleUpdatePlan({ ...plan, image: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {plan.image && (
                        <div className="relative w-full h-32 bg-gray-50 rounded-lg overflow-hidden border">
                          <img src={plan.image} alt={plan.name} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => handleUpdatePlan({ ...plan, image: undefined })}
                            className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Plano</label>
                      <input 
                        type="text" 
                        value={plan.name || ''}
                        onChange={e => handleUpdatePlan({ ...plan, name: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                        <input 
                          type="number" 
                          value={plan.price ?? 0}
                          onChange={e => handleUpdatePlan({ ...plan, price: Number(e.target.value) })}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                        <input 
                          type="text" 
                          value={plan.period || ''}
                          onChange={e => handleUpdatePlan({ ...plan, period: e.target.value })}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão (CTA)</label>
                      <input 
                        type="text" 
                        value={plan.cta || ''}
                        onChange={e => handleUpdatePlan({ ...plan, cta: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Funcionalidades (separadas por vírgula)</label>
                      <textarea 
                        value={(plan.features || []).join(', ')}
                        onChange={e => handleUpdatePlan({ ...plan, features: e.target.value.split(',').map(f => f.trim()) })}
                        className="w-full p-2 border rounded-lg h-24"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={!!plan.popular}
                        onChange={e => handleUpdatePlan({ ...plan, popular: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label className="text-sm text-gray-700">Destacar como Popular</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'landing' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Layout className="text-indigo-600" /> Configuração da Landing Page
            </h2>
            
            <form onSubmit={handleUpdateLanding} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título Principal</label>
                <textarea 
                  value={landingConfig.title || ''}
                  onChange={e => setLandingConfig({ ...landingConfig, title: e.target.value })}
                  className="w-full p-3 border rounded-lg h-24 font-bold text-lg"
                  placeholder="Use Enter para quebra de linha"
                />
                <p className="text-xs text-gray-500 mt-1">Use Enter para criar quebras de linha no título.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                <textarea 
                  value={landingConfig.subtitle || ''}
                  onChange={e => setLandingConfig({ ...landingConfig, subtitle: e.target.value })}
                  className="w-full p-3 border rounded-lg h-20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão Principal</label>
                <input 
                  type="text" 
                  value={landingConfig.buttonText || ''}
                  onChange={e => setLandingConfig({ ...landingConfig, buttonText: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagem de Fundo (URL ou Upload)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={landingConfig.bannerImage || ''}
                      onChange={e => setLandingConfig({ ...landingConfig, bannerImage: e.target.value })}
                      className="flex-1 p-3 border rounded-lg min-w-0"
                      placeholder="https://..."
                    />
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-gray-600 transition-colors flex items-center justify-center">
                      <Image size={20} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLandingConfig({ ...landingConfig, bannerImage: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {landingConfig.bannerImage && (
                    <div className="mt-2 h-24 w-full rounded-lg bg-cover bg-center border relative group">
                        <div style={{ backgroundImage: `url(${landingConfig.bannerImage})` }} className="w-full h-full rounded-lg bg-cover bg-center"></div>
                        <button 
                            type="button"
                            onClick={() => setLandingConfig({ ...landingConfig, bannerImage: '' })}
                            className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={16} />
                        </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo (PNG Transparente Recomendado)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={landingConfig.logoImage || ''}
                      onChange={e => setLandingConfig({ ...landingConfig, logoImage: e.target.value })}
                      className="flex-1 p-3 border rounded-lg min-w-0"
                      placeholder="https://..."
                    />
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-gray-600 transition-colors flex items-center justify-center">
                      <Image size={20} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLandingConfig({ ...landingConfig, logoImage: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {landingConfig.logoImage && (
                    <div className="mt-2 p-4 bg-gray-100 rounded-lg flex justify-center relative group">
                      <img 
                        src={landingConfig.logoImage} 
                        alt="Logo Preview" 
                        className="object-contain transition-all duration-300"
                        style={{ 
                          width: landingConfig.logoWidth ? `${landingConfig.logoWidth}px` : '48px',
                          borderRadius: landingConfig.logoRadius ? `${landingConfig.logoRadius}px` : '0px'
                        }} 
                      />
                      <button 
                            type="button"
                            onClick={() => setLandingConfig({ ...landingConfig, logoImage: '' })}
                            className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={16} />
                        </button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Largura Logo (px)</label>
                        <input 
                            type="number" 
                            value={landingConfig.logoWidth || '48'}
                            onChange={e => setLandingConfig({ ...landingConfig, logoWidth: e.target.value })}
                            className="w-full p-2 border rounded-lg text-sm"
                            placeholder="Ex: 150"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Raio Borda (px)</label>
                        <input 
                            type="number" 
                            value={landingConfig.logoRadius || '0'}
                            onChange={e => setLandingConfig({ ...landingConfig, logoRadius: e.target.value })}
                            className="w-full p-2 border rounded-lg text-sm"
                            placeholder="Ex: 10"
                        />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do App (PWA)</label>
                  <input 
                    type="text" 
                    value={landingConfig.pwaName || ''}
                    onChange={e => setLandingConfig({ ...landingConfig, pwaName: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Ex: HomeFin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ícone PWA (App Instalável)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={landingConfig.pwaIcon || ''}
                      onChange={e => setLandingConfig({ ...landingConfig, pwaIcon: e.target.value })}
                      className="flex-1 p-3 border rounded-lg min-w-0"
                      placeholder="https://..."
                    />
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-gray-600 transition-colors flex items-center justify-center">
                      <Image size={20} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLandingConfig({ ...landingConfig, pwaIcon: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {landingConfig.pwaIcon && (
                    <div className="mt-2 p-4 bg-gray-100 rounded-lg flex justify-center relative group">
                      <img src={landingConfig.pwaIcon} alt="PWA Icon Preview" className="h-12 w-12 object-contain rounded-lg" />
                      <button 
                            type="button"
                            onClick={() => setLandingConfig({ ...landingConfig, pwaIcon: '' })}
                            className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={16} />
                        </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Recomendado: Imagem quadrada (512x512px) PNG.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor Inicial (Degradê)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.bgColorStart || '#312e81'}
                      onChange={e => setLandingConfig({ ...landingConfig, bgColorStart: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.bgColorStart || '#312e81'}
                      onChange={e => setLandingConfig({ ...landingConfig, bgColorStart: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor Final (Degradê)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.bgColorEnd || '#3730a3'}
                      onChange={e => setLandingConfig({ ...landingConfig, bgColorEnd: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.bgColorEnd || '#3730a3'}
                      onChange={e => setLandingConfig({ ...landingConfig, bgColorEnd: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor do Texto (Geral)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.textColor || '#ffffff'}
                      onChange={e => setLandingConfig({ ...landingConfig, textColor: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.textColor || '#ffffff'}
                      onChange={e => setLandingConfig({ ...landingConfig, textColor: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor do Título (Parte 1)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.titleColor || '#ffffff'}
                      onChange={e => setLandingConfig({ ...landingConfig, titleColor: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.titleColor || '#ffffff'}
                      onChange={e => setLandingConfig({ ...landingConfig, titleColor: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor Destaque Início (Parte 2)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.accentColorStart || '#818cf8'}
                      onChange={e => setLandingConfig({ ...landingConfig, accentColorStart: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.accentColorStart || '#818cf8'}
                      onChange={e => setLandingConfig({ ...landingConfig, accentColorStart: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor Destaque Fim (Parte 2)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={landingConfig.accentColorEnd || '#c084fc'}
                      onChange={e => setLandingConfig({ ...landingConfig, accentColorEnd: e.target.value })}
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={landingConfig.accentColorEnd || '#c084fc'}
                      onChange={e => setLandingConfig({ ...landingConfig, accentColorEnd: e.target.value })}
                      className="flex-1 p-2 border rounded-lg uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <button 
                  type="submit"
                  className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    savedTabs['landing'] 
                      ? 'bg-green-600 text-white scale-[1.02] shadow-lg' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {savedTabs['landing'] ? <Check size={20} /> : <Save size={20} />}
                  {savedTabs['landing'] ? 'Salvo com Sucesso!' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === 'banner' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MonitorPlay className="text-indigo-600" /> Configuração do Banner do App (Contas do Mês)
            </h2>
            
            <form onSubmit={handleUpdateBanner} className="space-y-6">
              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border">
                <input 
                  type="checkbox" 
                  id="bannerEnabled"
                  checked={appBannerConfig.enabled}
                  onChange={e => setAppBannerConfig({ ...appBannerConfig, enabled: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label htmlFor="bannerEnabled" className="font-medium text-gray-700 cursor-pointer">
                  Habilitar Banner no Aplicativo
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagem do Banner (URL ou Upload)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={appBannerConfig.imageUrl || ''}
                    onChange={e => setAppBannerConfig({ ...appBannerConfig, imageUrl: e.target.value })}
                    className="flex-1 p-3 border rounded-lg min-w-0"
                    placeholder="https://..."
                  />
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-gray-600 transition-colors flex items-center justify-center">
                    <Image size={20} />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setAppBannerConfig({ ...appBannerConfig, imageUrl: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {appBannerConfig.imageUrl && (
                  <div className="mt-2 h-24 sm:h-32 md:h-40 w-full rounded-lg bg-cover bg-center border relative group">
                      <div style={{ backgroundImage: `url(${appBannerConfig.imageUrl})` }} className="w-full h-full rounded-lg bg-cover bg-center"></div>
                      <button 
                          type="button"
                          onClick={() => setAppBannerConfig({ ...appBannerConfig, imageUrl: '' })}
                          className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                          <X size={16} />
                      </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link de Destino (URL)</label>
                <input 
                  type="text" 
                  value={appBannerConfig.linkUrl || ''}
                  onChange={e => setAppBannerConfig({ ...appBannerConfig, linkUrl: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-500 mt-1">Para onde o usuário será redirecionado ao clicar no banner.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto Alternativo (Acessibilidade)</label>
                <input 
                  type="text" 
                  value={appBannerConfig.altText || ''}
                  onChange={e => setAppBannerConfig({ ...appBannerConfig, altText: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Ex: Promoção de Fim de Ano"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button 
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  {savedTabs['banner'] ? <Check size={20} /> : <Save size={20} />}
                  {savedTabs['banner'] ? 'Salvo!' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <CreditCard className="text-indigo-600" /> Configuração de Pagamentos
            </h2>
            
            <form onSubmit={handleUpdatePayment} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
                <input 
                  type="text" 
                  value={paymentConfig.pixKey || ''}
                  onChange={e => setPaymentConfig({ ...paymentConfig, pixKey: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="CPF, CNPJ, Email ou Chave Aleatória"
                />
                <p className="text-xs text-gray-500 mt-1">Esta chave será exibida para o usuário copiar no checkout.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL do QR Code PIX (Opcional)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={paymentConfig.pixQrCodeUrl || ''}
                    onChange={e => setPaymentConfig({ ...paymentConfig, pixQrCodeUrl: e.target.value })}
                    className="flex-1 p-3 border rounded-lg min-w-0"
                    placeholder="https://..."
                  />
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-gray-600 transition-colors flex items-center justify-center">
                    <Image size={20} />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPaymentConfig({ ...paymentConfig, pixQrCodeUrl: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {paymentConfig.pixQrCodeUrl && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg flex justify-center relative group w-fit mx-auto border">
                    <img src={paymentConfig.pixQrCodeUrl} alt="QR Code Preview" className="w-32 h-32 object-contain" />
                    <button 
                      type="button"
                      onClick={() => setPaymentConfig({ ...paymentConfig, pixQrCodeUrl: '' })}
                      className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Se não fornecido, um placeholder será exibido.</p>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="text-blue-500" /> Integração Mercado Pago
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Public Key (Chave Pública)</label>
                    <input 
                      type="text" 
                      value={paymentConfig.mercadoPagoPublicKey || ''}
                      onChange={e => setPaymentConfig({ ...paymentConfig, mercadoPagoPublicKey: e.target.value })}
                      className="w-full p-3 border rounded-lg font-mono text-sm"
                      placeholder="TEST-..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Usada no frontend para criar tokens de cartão.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Token de Acesso)</label>
                    <input 
                      type="password" 
                      value={paymentConfig.mercadoPagoAccessToken || ''}
                      onChange={e => setPaymentConfig({ ...paymentConfig, mercadoPagoAccessToken: e.target.value })}
                      className="w-full p-3 border rounded-lg font-mono text-sm"
                      placeholder="TEST-..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Usada no backend para processar pagamentos. Mantenha em segredo!</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-800 mb-2">Webhook URL (Para Vercel)</h4>
                    <div className="flex items-center gap-2 bg-white p-2 rounded border border-blue-200">
                      <code className="text-xs text-gray-600 flex-1 overflow-x-auto whitespace-nowrap">
                        {window.location.origin}/api/webhook
                      </code>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/webhook`);
                          alert('URL copiada!');
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Copiar URL"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Configure esta URL no painel do Mercado Pago para receber notificações de pagamento automático.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <button 
                  type="submit"
                  className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    savedTabs['payments'] 
                      ? 'bg-green-600 text-white scale-[1.02] shadow-lg' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {savedTabs['payments'] ? <Check size={20} /> : <Save size={20} />}
                  {savedTabs['payments'] ? 'Salvo com Sucesso!' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="text-indigo-600" /> Segurança do Painel
            </h2>
            
            <form onSubmit={handleUpdateSecurity} className="space-y-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Mantenha estas credenciais seguras. A palavra-chave é a única forma de recuperar o acesso caso esqueça a senha.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha de Acesso</label>
                <input 
                  type="password" 
                  value={securityConfig.newPassword}
                  onChange={e => setSecurityConfig({ ...securityConfig, newPassword: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Deixe em branco para manter a atual"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  value={securityConfig.confirmPassword}
                  onChange={e => setSecurityConfig({ ...securityConfig, confirmPassword: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Repita a nova senha"
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-chave de Recuperação</label>
                <input 
                  type="text" 
                  value={securityConfig.recoveryKeyword}
                  onChange={e => setSecurityConfig({ ...securityConfig, recoveryKeyword: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Ex: nome do cachorro, cidade natal..."
                />
                <p className="text-xs text-gray-500 mt-1">
                    Esta palavra será solicitada caso você clique em "Esqueci a senha" na tela de login.
                </p>
              </div>

              <div className="pt-4 border-t">
                <button 
                  type="submit"
                  className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    savedTabs['security'] 
                      ? 'bg-green-600 text-white scale-[1.02] shadow-lg' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {savedTabs['security'] ? <Check size={20} /> : <Save size={20} />}
                  {savedTabs['security'] ? 'Atualizado com Sucesso!' : 'Atualizar Credenciais'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plan Creation Modal */}
        {isPlanModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Novo Plano</h3>
              <input 
                type="text" 
                value={newPlanName}
                onChange={e => setNewPlanName(e.target.value)}
                className="w-full p-3 border rounded-lg mb-6"
                placeholder="Nome do Plano (ex: Família Gold)"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreatePlan}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold transition-colors"
                  disabled={!newPlanName}
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Delete Confirmation Modal */}
        {planToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Plano?</h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setPlanToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDeletePlan}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors shadow-lg shadow-red-500/30"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
