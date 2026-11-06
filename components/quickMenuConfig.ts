import { Banknote, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SIDEBAR_MENU_ITEMS } from './navigationConfig';

export type QuickMenuDisplayMode = 'both' | 'label' | 'icon';

export interface QuickMenuItem {
  id: string;
  display: QuickMenuDisplayMode;
}

interface QuickMenuOption {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: 'new-account' | 'open-menu';
}

export const QUICK_MENU_ACTIONS: QuickMenuOption[] = [
  ...SIDEBAR_MENU_ITEMS.map(({ path, label, icon }) => ({
    id: path,
    label,
    icon,
    path,
  })),
  { id: 'new-account', label: 'Nova Conta', icon: Banknote, action: 'new-account' },
  { id: 'open-menu', label: 'Abrir Menu', icon: Menu, action: 'open-menu' },
];

export const DEFAULT_QUICK_MENU = {
  enabled: true,
  items: [
    { id: '/dashboard', display: 'both' as const },
    { id: '/spreadsheets', display: 'both' as const },
  ],
};

export const normalizeQuickMenu = (value?: {
  enabled?: boolean;
  items?: unknown[];
}) => {
  const availableIds = new Set<string>(QUICK_MENU_ACTIONS.map((item) => item.id));
  const sourceItems = Array.isArray(value?.items) ? value.items : DEFAULT_QUICK_MENU.items;
  const items: QuickMenuItem[] = [];
  for (const rawItem of sourceItems) {
    const id = typeof rawItem === 'string'
      ? rawItem
      : rawItem && typeof rawItem === 'object' && 'id' in rawItem
        ? String(rawItem.id)
        : '';
    if (!availableIds.has(id) || items.some((item) => item.id === id)) continue;
    const display = rawItem && typeof rawItem === 'object' && 'display' in rawItem
      ? rawItem.display
      : 'both';
    items.push({
      id,
      display: display === 'label' || display === 'icon' ? display : 'both',
    });
  }

  return {
    enabled: value?.enabled ?? DEFAULT_QUICK_MENU.enabled,
    items,
  };
};
