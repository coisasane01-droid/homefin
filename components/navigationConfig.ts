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
