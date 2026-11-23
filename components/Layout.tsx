import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X,
  LogOut,
  Home,
  Cloud,
  CloudOff,
  BookOpen,
} from 'lucide-react';
import { db } from '../services/db';
import { saasDb } from '../services/saasDb';
import { clearFamilySession, familyAuthRequest } from '../services/familyAuth';
import { showNotification } from '../services/utils/notifications';
import QuickMenu from './QuickMenu';
import { DEFAULT_QUICK_MENU, normalizeQuickMenu } from './quickMenuConfig';
import { SIDEBAR_MENU_ITEMS } from './navigationConfig';
import PageAdvertisement from './PageAdvertisement';
import LanguageSelector from './LanguageSelector';

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

const PAGE_GUIDES: Record<string, { title: string; intro: string; steps: string[]; tips: string[] }> = {
  bills: { title: 'Contas do Mês', intro: 'Acompanhe vencimentos, pagamentos e valores da família.', steps: ['Use as setas para consultar outros meses.', 'Clique em Nova Conta e preencha descrição, valor e vencimento.', 'Escolha categoria, status e, se desejar, atribua a um membro.', 'Use a repetição mensal para criar próximos lançamentos sem alterar os meses anteriores.', 'Abra uma conta para consultar ou atualizar seus dados; use o menu de opções para ações adicionais.'], tips: ['O valor pago pode ser informado separadamente do valor total.', 'Anexos e leitura por foto/IA dependem da disponibilidade e configuração do recurso.', 'Confira o mês selecionado antes de editar ou excluir.'] },
  dashboard: { title: 'Dashboard', intro: 'Veja um resumo da situação financeira da família.', steps: ['Confira os indicadores de valores totais, pagos e pendentes.', 'Observe os gráficos para identificar categorias e tendências.', 'Use os módulos do menu lateral para abrir os registros detalhados.', 'Atualize os lançamentos nos módulos de origem; o Dashboard reflete os dados disponíveis.'], tips: ['Os indicadores dependem dos lançamentos cadastrados e do período considerado.', 'Se algo parecer incorreto, confira os registros nos módulos de origem.'] },
  wallets: { title: 'Contas & Cofrinhos', intro: 'Organize contas financeiras e acompanhe saldos e movimentações.', steps: ['Cadastre as contas ou carteiras que deseja acompanhar.', 'Informe os dados solicitados e o saldo inicial, quando aplicável.', 'Registre entradas e saídas na conta correspondente.', 'Consulte os saldos para acompanhar a distribuição do dinheiro.'], tips: ['Confira a conta selecionada antes de registrar uma movimentação.', 'Mantenha os lançamentos atualizados.'] },
  calendar: { title: 'Agenda Família', intro: 'Organize compromissos, datas importantes e eventos da família.', steps: ['Use Hoje e as setas para navegar pelas datas.', 'Alterne entre Dia, Semana e Mês.', 'Clique em Novo evento ou em uma data para cadastrar um compromisso.', 'Preencha título, data, horário e detalhes disponíveis e salve.', 'Use Meus calendários para mostrar ou ocultar categorias.'], tips: ['Confira as permissões de notificação do aparelho e do navegador para receber alertas.', 'Mantenha o aplicativo e as notificações autorizados.'] },
  shopping: { title: 'Lista de Compras', intro: 'Monte listas e acompanhe o que ainda precisa comprar.', steps: ['Adicione os produtos que deseja comprar.', 'Informe quantidade e outros detalhes disponíveis.', 'Marque os itens conforme forem comprados.', 'Revise a lista antes de finalizar as compras.'], tips: ['Evite cadastrar o mesmo produto mais de uma vez na mesma lista.', 'Atualize a quantidade quando necessário.'] },
  debts: { title: 'Dívidas', intro: 'Registre compromissos financeiros e acompanhe o que falta pagar ou receber.', steps: ['Cadastre uma dívida e informe descrição, valor e vencimento.', 'Indique a natureza do registro conforme as opções da tela.', 'Atualize pagamentos e valores parciais ao longo do tempo.', 'Consulte a lista para acompanhar os saldos em aberto.'], tips: ['Registre cada pagamento para manter o saldo restante correto.', 'Confira os dados antes de excluir.'] },
  goals: { title: 'Metas e Sonhos', intro: 'Planeje objetivos e acompanhe seu progresso.', steps: ['Crie uma meta com nome e valor desejado.', 'Informe o progresso ou os valores guardados.', 'Acompanhe quanto falta para alcançar o objetivo.', 'Revise suas metas e atualize os valores periodicamente.'], tips: ['Defina valores realistas e mantenha os registros atualizados.', 'O progresso depende dos valores informados na meta.'] },
  assets: { title: 'Bens e Patrimônio', intro: 'Mantenha um registro dos bens e acompanhe seu patrimônio.', steps: ['Cadastre cada bem com descrição e informações solicitadas.', 'Informe valores e detalhes que ajudem a identificar o item.', 'Atualize o cadastro quando houver mudança de valor ou situação.', 'Consulte a relação para acompanhar os bens registrados.'], tips: ['Use descrições claras para diferenciar bens semelhantes.', 'Identifique valores estimados como estimativas.'] },
  reports: { title: 'Relatórios', intro: 'Consulte uma visão organizada das informações financeiras registradas.', steps: ['Abra o relatório desejado.', 'Selecione o período ou os filtros disponíveis.', 'Analise totais, categorias e comparações apresentados.', 'Use os módulos de origem para conferir lançamentos específicos.'], tips: ['Relatórios dependem da qualidade e atualização dos cadastros.', 'Confira o intervalo selecionado antes de comparar períodos.'] },
  inventory: { title: 'Estoque', intro: 'Controle produtos, quantidades, preços e movimentações.', steps: ['Cadastre o produto com identificação, descrição, unidade e preços.', 'Escolha o modo de quantidade adequado: inteiro ou fracionado, quando disponível.', 'Registre entradas ao receber mercadoria e saídas em vendas ou consumo.', 'Use busca e filtros para localizar produtos e identificar estoque baixo.', 'Consulte o histórico para verificar movimentações anteriores.', 'Use Compartilhar / Criar estoque para gerenciar acesso de outras famílias, se você for responsável pelo estoque.'], tips: ['Confira unidade e quantidade antes de salvar.', 'Pesquise nome ou código para evitar duplicidade.', 'O estoque compartilhado pode exigir conexão para alterações de famílias convidadas.'] },
  ranking: { title: 'Ranking Familiar', intro: 'Acompanhe a participação e os resultados apresentados no ranking.', steps: ['Consulte a classificação e os indicadores exibidos.', 'Observe o período e os critérios informados na tela.', 'Mantenha os registros dos módulos atualizados.'], tips: ['O ranking é uma visão de acompanhamento; confira os módulos de origem para entender cada resultado.'] },
  share: { title: 'Compartilhar / Indicar', intro: 'Consulte as opções para compartilhar o HomeFin e acompanhar indicações.', steps: ['Leia as informações e regras exibidas.', 'Use os recursos de compartilhamento para enviar o convite.', 'Acompanhe o status das indicações, quando apresentado.'], tips: ['Compartilhe apenas com pessoas que desejam conhecer o aplicativo.', 'Confira as condições antes de concluir uma indicação.'] },
  support: { title: 'Suporte', intro: 'Use este espaço para conversar com a equipe de atendimento.', steps: ['Abra uma nova conversa ou selecione um atendimento existente.', 'Descreva a dúvida com o máximo de contexto possível.', 'Anexe imagens ou documentos relevantes, se disponível.', 'Acompanhe as respostas nesta mesma área.'], tips: ['Informe em qual página ocorreu o problema e o que estava tentando fazer.', 'Não envie senhas, PINs ou chaves secretas.'] },
  settings: { title: 'Configurações', intro: 'Personalize a aparência e as preferências da sua família.', steps: ['Revise opções de aparência, como tema e cor principal.', 'Ajuste dados e elementos visuais da família.', 'Configure o menu central/flutuante escolhendo itens e apresentação.', 'Revise preferências de notificações e segurança.', 'Salve as alterações e aguarde a confirmação.'], tips: ['Algumas mudanças visuais podem ser aplicadas imediatamente; outras dependem de salvar.', 'Para receber notificações, autorize o aplicativo no aparelho e no navegador.'] },
  plans: { title: 'Meu Plano', intro: 'Consulte o plano da família e as informações de assinatura.', steps: ['Confira o plano associado à família.', 'Leia os recursos e limites descritos para cada opção.', 'Siga as instruções da tela para consultar ou alterar a assinatura, quando disponível.'], tips: ['Verifique valores, periodicidade e condições antes de confirmar uma contratação.'] },
};
interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPageKey = location.pathname.replace(/^\\/+|\\/+$/g, '').split('/')[0] || 'dashboard';
  const pageGuide = PAGE_GUIDES[currentPageKey] || { title: 'Como usar o HomeFin', intro: 'Orientações gerais para aproveitar os recursos do aplicativo.', steps: ['Use o menu lateral para acessar cada módulo.', 'Cadastre e mantenha seus dados atualizados no módulo correspondente.', 'Use os botões de cada página para criar, editar, consultar ou exportar informações.', 'Consulte este guia sempre que precisar entender uma função.'], tips: ['As opções podem variar conforme o módulo e as permissões da família.', 'Se encontrar um problema, abra Suporte e informe a página e a ação realizada.'] };
  const [houseName, setHouseName] = useState('Carregando...');
  const [logoImage, setLogoImage] = useState('');
  const [logoShape, setLogoShape] = useState<'circle' | 'square'>('square');
  const [isDark, setIsDark] = useState(false);
  const [showPlanPage, setShowPlanPage] = useState(false);
  const [quickMenu, setQuickMenu] = useState<ReturnType<typeof normalizeQuickMenu>>(DEFAULT_QUICK_MENU);
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'conflict' | null>(() => {
    const familyId = localStorage.getItem('homefin_current_family_id') || '';
    if (!familyId) return null;
    if (localStorage.getItem(`homefin_sync_conflict_${familyId}`)) return 'conflict';
    if (localStorage.getItem(`homefin_pending_sync_${familyId}`)) return 'pending';
    return localStorage.getItem(`homefin_remote_updated_at_${familyId}`)
      ? 'synced'
      : null;
  });

  useEffect(() => {
    loadSettings();
    checkPlanStatus();
    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ familyId: string; status: 'pending' | 'synced' | 'conflict' }>).detail;
      if (detail?.familyId === localStorage.getItem('homefin_current_family_id')) {
        setSyncStatus(detail.status);
      }
    };
    window.addEventListener('homefin-family-sync-status', handleSyncStatus);
    // Check for due bills notifications
    db.checkDueBills();
    return () => window.removeEventListener('homefin-family-sync-status', handleSyncStatus);
  }, [location.pathname]);

  // Recebe as mudanças das Configurações e reflete no menu sem recarregar a página.
  useEffect(() => {
    const handleQuickMenuUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ReturnType<typeof normalizeQuickMenu>>).detail;
      if (detail) setQuickMenu(normalizeQuickMenu(detail));
    };

    window.addEventListener('homefin-quick-menu-updated', handleQuickMenuUpdate);
    return () => window.removeEventListener('homefin-quick-menu-updated', handleQuickMenuUpdate);
  }, []);

  const checkPlanStatus = () => {
    const familyId = localStorage.getItem('homefin_current_family_id');
    if (familyId) {
      const families = saasDb.getFamilies();
      const family = families.find(f => f.id === familyId);
      // Show plan page if plan is NOT 'free' (meaning it's paid/premium)
      // User said: "se o plano for 100% free não precisa aparecer pagina planos"
      if (family && family.plan !== 'free') {
        setShowPlanPage(true);
      } else {
        setShowPlanPage(false);
      }
    }
  };

  const loadSettings = async () => {
    const s = await db.getSettings();
    setHouseName(s.houseName);
    setLogoImage(s.logoImage || '');
    setLogoShape(s.logoShape === 'circle' ? 'circle' : 'square');
    setIsDark(s.theme === 'dark');
    setQuickMenu(normalizeQuickMenu(s.quickMenu));
    
    if (s.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply primary color
    const colorHex = colors[s.primaryColor as keyof typeof colors] || colors.indigo;
    document.documentElement.style.setProperty('--primary-50', `${colorHex}1a`);
    document.documentElement.style.setProperty('--primary-100', `${colorHex}33`);
    document.documentElement.style.setProperty('--primary-500', colorHex);
    document.documentElement.style.setProperty('--primary-600', colorHex);
    document.documentElement.style.setProperty('--primary-700', colorHex);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const openMainMenu = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIsSidebarOpen(true);
    }
  };
  const openNewAccount = () => {
    navigate('/wallets', { state: { openNewAccount: true } });
  };

  const handleLogout = async () => {
    const familyId = localStorage.getItem('homefin_current_family_id');

    if (familyId && familyId !== 'v1') {
      try {
        await familyAuthRequest(familyId, { action: 'logout' }, true);
      } catch (error) {
        console.error('Não foi possível revogar a sessão no servidor:', error);
        showNotification(
          'Sessão encerrada neste dispositivo, mas não foi possível confirmar a revogação no servidor.',
          'warning'
        );
      } finally {
        await clearFamilySession(familyId);
      }
      window.location.hash = `/login?family=${encodeURIComponent(familyId)}`;
    } else {
      window.location.hash = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Mobile Header (z-40) */}
      <div className="md:hidden fixed w-full z-40 border-b border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl flex justify-between items-center h-[72px] dark:border-white/10 dark:bg-slate-950/65 print:hidden">
        <div className="flex items-center gap-2 text-primary-600 font-bold text-xl min-w-0">
           {logoImage ? (
             <img src={logoImage} alt="Foto da família" className={`w-9 h-9 object-cover flex-shrink-0 ${logoShape === 'circle' ? 'rounded-full' : 'rounded-md'}`} />
           ) : (
             <Home className="w-6 h-6 flex-shrink-0" />
           )}
           <span className="truncate">{houseName}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button onClick={toggleSidebar} className="p-2 text-gray-600 dark:text-gray-300">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar (z-50) - Highest layer for navigation */}
      <aside
        className={`relative isolate fixed md:sticky top-0 h-screen w-64 border-r border-blue-200/70 bg-white/55 shadow-[8px_0_38px_rgba(37,99,235,0.10),inset_-1px_0_0_rgba(255,255,255,0.65)] backdrop-blur-2xl dark:border-blue-300/15 dark:bg-slate-950/70 dark:shadow-[8px_0_42px_rgba(0,0,0,0.30),inset_-1px_0_0_rgba(96,165,250,0.12)] z-50 transform transition-all duration-300 ease-in-out print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          WebkitBackdropFilter: 'blur(28px) saturate(175%)',
          backdropFilter: 'blur(28px) saturate(175%)',
          backgroundImage: isDark
            ? 'radial-gradient(ellipse at 12% 8%, rgba(59,130,246,0.20), transparent 42%), radial-gradient(ellipse at 88% 42%, rgba(14,165,233,0.13), transparent 48%), linear-gradient(145deg, rgba(15,23,42,0.18), rgba(30,58,138,0.12))'
            : 'radial-gradient(ellipse at 12% 8%, rgba(59,130,246,0.13), transparent 42%), radial-gradient(ellipse at 88% 42%, rgba(14,165,233,0.09), transparent 48%), linear-gradient(145deg, rgba(255,255,255,0.30), rgba(219,234,254,0.16))',
        }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-blue-400/80 to-transparent shadow-[0_0_14px_rgba(59,130,246,0.55)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-400/15" />
        <div className="relative z-10 p-6 h-full min-h-0 flex flex-col overflow-hidden">
          <div className="hidden md:flex flex-col items-center text-center text-primary-600 font-bold text-xl mb-8 gap-2">
             {logoImage ? (
               <img src={logoImage} alt="Foto da família" className={`w-20 h-20 object-cover ${logoShape === 'circle' ? 'rounded-full' : 'rounded-md'}`} />
             ) : (
               <Home className="w-8 h-8" />
             )}
             <span className="break-words max-w-full">{houseName}</span>
             <LanguageSelector />
          </div>
          
          <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1 mt-14 md:mt-0">
            {SIDEBAR_MENU_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 border px-4 py-3 rounded-xl transition-all duration-200 ease-out ${
                    isActive
                      ? 'border-blue-400/40 bg-gradient-to-r from-blue-500/18 via-primary-500/12 to-cyan-400/10 text-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_0_0_1px_rgba(59,130,246,0.08),0_0_20px_rgba(59,130,246,0.16)] dark:border-blue-300/30 dark:from-blue-400/20 dark:via-primary-400/15 dark:to-cyan-300/10 dark:text-blue-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_22px_rgba(59,130,246,0.18)] font-semibold'
                      : 'border-transparent text-slate-600 hover:border-blue-200/70 hover:bg-gradient-to-r hover:from-white/65 hover:to-blue-50/50 hover:text-blue-700 hover:shadow-[0_4px_18px_rgba(59,130,246,0.10)] dark:text-slate-300 dark:hover:border-blue-300/15 dark:hover:from-blue-400/10 dark:hover:to-cyan-400/5 dark:hover:text-blue-100 dark:hover:shadow-[0_0_18px_rgba(59,130,246,0.12)]'
                  }`}
                >
                  <item.icon size={20} className={`shrink-0 transition-all duration-200 ${isActive ? 'text-blue-600 drop-shadow-[0_0_7px_rgba(59,130,246,0.35)] dark:text-blue-300 dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.55)]' : 'text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-300'}`} />
                  {t(({'Contas do Mês': 'bills', 'Dashboard': 'dashboard', 'Contas & Cofrinhos': 'wallets', 'Agenda Família': 'calendar', 'Lista de Compras': 'shopping', 'Dívidas': 'debts', 'Metas e Sonhos': 'goals', 'Bens e Patrimônio': 'assets', 'Relatórios': 'reports', 'Estoque': 'inventory', 'Planilhas': 'spreadsheets', 'Ranking Familiar': 'ranking', 'Compartilhar / Indicar': 'share', 'Suporte': 'support', 'Configurações': 'settings', 'Meu Plano': 'plans'} as Record<string, string>)[item.label] || item.label)}
                </Link>
              );
            })}
          </nav>

          <button 
            onClick={handleLogout}
            className="flex-shrink-0 flex items-center gap-3 border border-transparent px-4 py-3 text-red-500 hover:border-red-500/10 hover:bg-red-500/5 dark:hover:bg-red-400/10 rounded-xl transition-all mt-auto"
          >
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content - Padded top to account for fixed header */}
      <main className="flex-1 p-4 pb-28 md:p-8 md:pb-24 pt-[88px] md:pt-8 overflow-y-auto print:p-0 print:overflow-visible print:h-auto">
        <div className="max-w-6xl mx-auto print:max-w-none print:w-full">
          {syncStatus && (
            <div
              role="status"
              className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                syncStatus !== 'synced'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
              }`}
            >
              {syncStatus !== 'synced' ? <CloudOff size={16} /> : <Cloud size={16} />}
              {syncStatus === 'conflict'
                ? 'Há uma versão mais recente na nuvem. As alterações deste dispositivo foram preservadas e a sincronização foi bloqueada para evitar sobrescrita; contate o suporte para reconciliar.'
                : syncStatus === 'pending'
                  ? 'Alterações salvas neste dispositivo; a nuvem ainda não confirmou a sincronização.'
                : 'Sincronização com a nuvem confirmada.'}
            </div>
          )}
          <PageAdvertisement pageKey={location.pathname.replace(/^\\/+|\\/+$/g, '')} />
          {currentPageKey !== 'spreadsheets' && (
            <div className="mb-3 flex justify-end print:hidden">
              <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/80 bg-white/75 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.10)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-[0_6px_22px_rgba(37,99,235,0.16)] dark:border-blue-300/20 dark:bg-slate-900/65 dark:text-blue-200 dark:hover:bg-blue-400/10"><BookOpen size={18} /> COMO USAR</button>
            </div>
          )}
          {children}
          {helpOpen && (
            <div role="dialog" aria-modal="true" aria-labelledby="homefin-help-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
              <section className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-blue-200/70 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.30)] dark:border-blue-300/15 dark:bg-slate-900 sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div><p className="mb-1 text-sm font-semibold text-blue-600 dark:text-blue-300">Central de ajuda HomeFin</p><h2 id="homefin-help-title" className="text-2xl font-bold text-slate-900 dark:text-white">Como usar: {pageGuide.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{pageGuide.intro}</p></div>
                  <button type="button" onClick={() => setHelpOpen(false)} aria-label="Fechar guia" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
                </div>
                <div className="space-y-5"><div><h3 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">Passo a passo</h3><ol className="space-y-3">{pageGuide.steps.map((step, index) => <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-400/15 dark:text-blue-200">{index + 1}</span><span className="pt-1">{step}</span></li>)}</ol></div>
                  <div className="rounded-2xl border border-blue-200/70 bg-blue-50/80 p-4 dark:border-blue-300/15 dark:bg-blue-400/10"><h3 className="mb-2 font-bold text-blue-900 dark:text-blue-100">Dicas importantes</h3><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">{pageGuide.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></div></div>
                <div className="mt-6 flex justify-end"><button type="button" onClick={() => setHelpOpen(false)} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Entendi</button></div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Overlay for mobile sidebar (z-45) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-45 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <QuickMenu
        enabled={quickMenu.enabled}
        items={quickMenu.items}
        hidden={isSidebarOpen}
        onOpenMenu={openMainMenu}
        onNewAccount={openNewAccount}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
};

export default Layout;