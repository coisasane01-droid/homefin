import { Banknote, Menu } from 'lucide-react';

export const QUICK_MENU_ACTIONS = [
  {
    id: 'new-account',
    label: 'Nova Conta',
    icon: Banknote,
    action: 'new-account',
  },
  {
    id: 'open-menu',
    label: 'Abrir Menu',
    icon: Menu,
    action: 'open-menu',
  },
] as const;

export type QuickMenuItemId = (typeof QUICK_MENU_ACTIONS)[number]['id'];

export const DEFAULT_QUICK_MENU = {
  enabled: true,
  items: QUICK_MENU_ACTIONS.map((item) => item.id),
};

export const normalizeQuickMenu = (value?: {
  enabled?: boolean;
  items?: string[];
}) => {
  const availableIds = new Set<string>(QUICK_MENU_ACTIONS.map((item) => item.id));
  const items = Array.isArray(value?.items)
    ? value.items.filter(
        (id, index, list): id is QuickMenuItemId =>
          availableIds.has(id) && list.indexOf(id) === index
      )
    : [...DEFAULT_QUICK_MENU.items];

  return {
    enabled: value?.enabled ?? DEFAULT_QUICK_MENU.enabled,
    items,
  };
};
