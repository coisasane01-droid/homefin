import {
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Gem,
  Headphones,
  Landmark,
  Package,
  LayoutDashboard,
  Settings,
  Share2,
  ShoppingCart,
  Table2,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

export const SIDEBAR_MENU_ITEMS: NavigationItem[] = [
  { icon: FileText, label: 'Contas do Mês', path: '/bills' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Landmark, label: 'Contas & Cofrinhos', path: '/wallets' },
  { icon: Calendar, label: 'Agenda Família', path: '/calendar' },
  { icon: ShoppingCart, label: 'Lista de Compras', path: '/shopping' },
  { icon: Wallet, label: 'Dívidas', path: '/debts' },
  { icon: Target, label: 'Metas e Sonhos', path: '/goals' },
  { icon: Gem, label: 'Bens e Patrimônio', path: '/assets' },
  { icon: BarChart3, label: 'Relatórios', path: '/reports' },
  { icon: Package, label: 'Estoque', path: '/inventory' },
  { icon: Table2, label: 'Planilhas', path: '/spreadsheets' },
  { icon: Trophy, label: 'Ranking Familiar', path: '/ranking' },
  { icon: Share2, label: 'Compartilhar / Indicar', path: '/share' },
  { icon: Headphones, label: 'Suporte', path: '/support' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
  { icon: CreditCard, label: 'Meu Plano', path: '/plans' },
];


export const FAMILY_PAGE_ACCESS_OPTIONS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/bills', label: 'Contas do Mês' },
  { path: '/shopping', label: 'Lista de Compras' },
  { path: '/calendar', label: 'Agenda Família' },
  { path: '/wallets', label: 'Contas & Cofrinhos' },
  { path: '/goals', label: 'Metas e Sonhos' },
  { path: '/assets', label: 'Bens e Patrimônio' },
  { path: '/reports', label: 'Relatórios' },
  { path: '/inventory', label: 'Estoque' },
  { path: '/spreadsheets', label: 'Planilhas' },
  { path: '/ranking', label: 'Ranking Familiar' },
  { path: '/debts', label: 'Dívidas' },
  { path: '/settings', label: 'Configurações' },
  { path: '/my-plan', label: 'Meu Plano' },
  { path: '/share', label: 'Compartilhar / Indicar' },
  { path: '/support', label: 'Suporte' },
] as const;
