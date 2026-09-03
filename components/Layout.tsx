import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  ShoppingCart, 
  Target, 
  Gem, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  LogOut,
  Home,
  Calendar,
  CreditCard,
  Trophy,
  Wallet,
  Landmark
} from 'lucide-react';
import { db } from '../services/db';
import { saasDb } from '../services/saasDb';

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

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const [houseName, setHouseName] = useState('Carregando...');
  const [isDark, setIsDark] = useState(false);
  const [showPlanPage, setShowPlanPage] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPlanStatus();
    // Check for due bills notifications
    db.checkDueBills();
  }, [location.pathname]); 

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
    setIsDark(s.theme === 'dark');
    
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

  const menuItems = [
    { icon: FileText, label: 'Contas do Mês', path: '/bills' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Landmark, label: 'Contas & Cofrinhos', path: '/wallets' },
    { icon: Calendar, label: 'Agenda Família', path: '/calendar' },
    { icon: ShoppingCart, label: 'Lista de Compras', path: '/shopping' },
    { icon: Wallet, label: 'Dívidas', path: '/debts' },
    { icon: Target, label: 'Metas e Sonhos', path: '/goals' },
    { icon: Gem, label: 'Bens e Patrimônio', path: '/assets' },
    { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    { icon: Trophy, label: 'Ranking Familiar', path: '/ranking' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  if (showPlanPage) {
    menuItems.push({ icon: CreditCard, label: 'Meu Plano', path: '/my-plan' });
  }

  const handleLogout = () => {
    window.location.hash = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Mobile Header (z-40) */}
      <div className="md:hidden fixed w-full z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center shadow-sm h-[72px] print:hidden">
        <div className="flex items-center gap-2 text-primary-600 font-bold text-xl">
           <Home className="w-6 h-6" />
           <span>{houseName}</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 text-gray-600 dark:text-gray-300">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar (z-50) - Highest layer for navigation */}
      <aside 
        className={`fixed md:sticky top-0 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="hidden md:flex items-center gap-2 text-primary-600 font-bold text-2xl mb-8">
             <Home className="w-8 h-8" />
             <span>{houseName}</span>
          </div>
          
          <nav className="flex-1 space-y-1 mt-14 md:mt-0">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-semibold' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mt-auto"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content - Padded top to account for fixed header */}
      <main className="flex-1 p-4 md:p-8 pt-[88px] md:pt-8 overflow-y-auto print:p-0 print:overflow-visible print:h-auto">
        <div className="max-w-6xl mx-auto print:max-w-none print:w-full">
          {children}
        </div>
      </main>

      {/* Overlay for mobile sidebar (z-45) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-45 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;