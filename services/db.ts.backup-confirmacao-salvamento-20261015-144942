import { AppData, Bill, ShoppingItem, Goal, Asset, UserSettings, KnownProduct, CalendarEvent, Debt } from '../types';
import { supabase } from './supabaseService';
import { homefinProxy } from './homefinProxy';
/*
  Persistência: Supabase (com cache local para funcionamento offline).
  A tabela esperada é public.homefin_data.
*/


// import { createClient } from '@supabase/supabase-js';
// const SUPABASE_URL = 'https://seu-projeto.supabase.co';
// const SUPABASE_KEY = 'sua-anon-key';
// export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentFamilyId = localStorage.getItem('homefin_current_family_id') || 'v1';

const getStorageKey = () => `homefin_data_${currentFamilyId}`;
const getPendingSyncKey = (familyId: string) => `homefin_pending_sync_${familyId}`;

const defaultSettings: UserSettings = {
  theme: 'light',
  houseName: 'Minha Casa',
  primaryColor: 'indigo',
  backgroundZoom: 100,
  backgroundOpacity: 100,
  backgroundFit: 'cover',
  cardOpacity: 40,
  cardFullScreen: false,
  logoShape: 'square',
  logoZoom: 100,
  customCategories: [],
  categories: ['Fixa', 'Variável', 'Cartão', 'Imposto'],
  notificationsEnabled: false,
  integrations: { openBanking: false, saneago: false, equatorial: false }
};

const initialData: AppData = {
  bills: [], shoppingList: [], knownProducts: [], goals: [], assets: [], events: [],
  debts: [], bankAccounts: [], settings: defaultSettings,
};

let cachedData: AppData = initialData;
let syncPromise: Promise<void> = Promise.resolve();

const normalizeData = (parsed: Partial<AppData>): AppData => ({
  ...initialData, ...parsed,
  bills: parsed.bills || [], shoppingList: parsed.shoppingList || [], knownProducts: parsed.knownProducts || [],
  goals: parsed.goals || [], assets: parsed.assets || [], events: parsed.events || [], debts: parsed.debts || [],
  bankAccounts: parsed.bankAccounts || [],
  settings: { ...defaultSettings, ...(parsed.settings || {}), categories: parsed.settings?.categories || defaultSettings.categories }
});

const getLocalData = (): AppData => {
  return cachedData;
};

const enqueueRemoteSave = (
  familyId: string,
  storageKey: string,
  serializedSnapshot: string
): Promise<void> => {
  const pendingKey = getPendingSyncKey(familyId);
  const snapshot = JSON.parse(serializedSnapshot) as AppData;

  const currentSync = syncPromise
    .catch(() => undefined)
    .then(async () => {
      await homefinProxy.saveFamilyData(familyId, snapshot);

      if (localStorage.getItem(storageKey) === serializedSnapshot) {
        localStorage.removeItem(pendingKey);
      }
    });

  syncPromise = currentSync.catch((error) => {
    console.error('HomeFin: erro ao sincronizar com Supabase:', error);
  });

  return currentSync;
};

const saveLocalData = (data: AppData): Promise<void> => {
  const familyIdToSave = currentFamilyId;
  const storageKeyToSave = getStorageKey();
  const pendingKey = getPendingSyncKey(familyIdToSave);
  const normalized = normalizeData(data);
  const serializedSnapshot = JSON.stringify(normalized);

  localStorage.setItem(storageKeyToSave, serializedSnapshot);
  localStorage.setItem(pendingKey, '1');
  cachedData = normalized;

  if (navigator.onLine) {
    // A gravação local já foi concluída. Sincroniza em segundo plano
    // para que a interface não fique esperando a resposta do servidor.
    void enqueueRemoteSave(
      familyIdToSave,
      storageKeyToSave,
      serializedSnapshot
    ).catch((error) => {
      console.error('HomeFin: sincronização pendente para nova tentativa:', error);
    });
  }

  return Promise.resolve();
};

const loadLocalCache = () => {
  // Nunca reutiliza em memória os dados da família anterior.
  cachedData = normalizeData(initialData);

  const raw = localStorage.getItem(getStorageKey());
  if (raw) {
    try {
      cachedData = normalizeData(JSON.parse(raw));
    } catch {
      cachedData = normalizeData(initialData);
    }
  }
};
loadLocalCache();

const loadFromSupabase = async (familyIdToLoad: string) => {
  if (!navigator.onLine) return;

  const data = await homefinProxy.getFamilyData(familyIdToLoad);

  // Uma troca de família ocorreu enquanto a consulta estava pendente.
  if (currentFamilyId !== familyIdToLoad) return;

  // Protege dados locais que ainda aguardam confirmação do servidor.
  if (localStorage.getItem(getPendingSyncKey(familyIdToLoad))) return;

  if (data) {
    const localBeforeSync = getLocalData();
    const normalizedRemote = normalizeData(data);

    if (
      localBeforeSync.settings.logoImage &&
      !normalizedRemote.settings.logoImage
    ) {
      normalizedRemote.settings.logoImage = localBeforeSync.settings.logoImage;
    }

    if (
      localBeforeSync.settings.backgroundImage &&
      !normalizedRemote.settings.backgroundImage
    ) {
      normalizedRemote.settings.backgroundImage = localBeforeSync.settings.backgroundImage;
    }

    cachedData = normalizedRemote;
    localStorage.setItem(`homefin_data_${familyIdToLoad}`, JSON.stringify(cachedData));
  }
};

// --- Notification System ---
const sendNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return;
  
  // Check user preference first
  const data = getLocalData();
  if (!data.settings.notificationsEnabled) return;

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png', // Assuming standard PWA icon exists or fallback
      badge: '/pwa-192x192.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
};

export const db = {
  init: async (familyId: string) => {
    if (familyId) {
      currentFamilyId = familyId;
      localStorage.setItem('homefin_current_family_id', familyId);
      loadLocalCache();
      console.log(`DB Initialized for family: ${familyId}`);
      await db.sync();
    }
  },

  sync: async () => {
    if (!supabase) { console.warn('HomeFin: Supabase não configurado.'); return; }
    if (!navigator.onLine) { console.log('Offline: usando cache local.'); return; }

    const familyIdToSync = currentFamilyId;
    const storageKey = `homefin_data_${familyIdToSync}`;
    const pendingKey = getPendingSyncKey(familyIdToSync);

    await syncPromise.catch(() => undefined);

    if (currentFamilyId !== familyIdToSync) return;

    // Envia primeiro os dados locais que ainda aguardam sincronização.
    if (localStorage.getItem(pendingKey)) {
      const snapshot = localStorage.getItem(storageKey);

      if (!snapshot) {
        localStorage.removeItem(pendingKey);
      } else {
        try {
          await enqueueRemoteSave(familyIdToSync, storageKey, snapshot);
        } catch (error) {
          console.error('HomeFin: dados locais continuam pendentes:', error);
          return;
        }
      }

      if (currentFamilyId !== familyIdToSync) return;
      if (localStorage.getItem(pendingKey)) return;
    }

    try {
      await loadFromSupabase(familyIdToSync);
    } catch (error) {
      console.error('HomeFin: falha ao consultar dados remotos:', error);
      return;
    }

    if (currentFamilyId === familyIdToSync) {
      console.log('HomeFin: sincronização concluída.');
    }
  },

  // --- Settings ---
  requestNotificationPermission: async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  },

  getSettings: async (): Promise<UserSettings> => {
    // Simula delay de rede
    return getLocalData().settings;
  },

  updateSettings: async (settings: UserSettings) => {
    const data = getLocalData();
    data.settings = settings;
    await saveLocalData(data);
  },

  // --- Bills ---
  getBills: async (month: string): Promise<Bill[]> => {
    const data = getLocalData();
    const targetParts = month.split('-').map(Number);
    const targetDate = new Date(targetParts[0], targetParts[1] - 1 + 12, 1);
    const horizon = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    let changed = false;

    // Só contas explicitamente marcadas como recorrentes geram mensalidades.
    const seriesIds = [...new Set(
      data.bills.map(b => b.recurringId).filter((id): id is string => Boolean(id))
    )];

    for (const seriesId of seriesIds) {
      const occurrences = data.bills
        .filter(b => b.recurringId === seriesId)
        .sort((a, b) => a.month.localeCompare(b.month));

      if (!occurrences.length) continue;
      const template = occurrences[0];
      const skipped = new Set(
        occurrences.flatMap(b => b.recurrenceSkippedMonths || [])
      );

      const [startYear, startMonth] = template.month.split('-').map(Number);
      const [endYear, endMonth] = horizon.split('-').map(Number);
      let cursor = new Date(startYear, startMonth - 1, 1);
      const end = new Date(endYear, endMonth - 1, 1);

      while (cursor <= end) {
        const occurrenceMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const exists = data.bills.some(
          b => b.recurringId === seriesId && b.month === occurrenceMonth
        );

        if (!exists && !skipped.has(occurrenceMonth)) {
          const originalDue = Number((template.dueDate || '').slice(8, 10)) || 1;
          const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
          const dueDay = Math.min(originalDue, lastDay);
          const dueDate = `${occurrenceMonth}-${String(dueDay).padStart(2, '0')}`;

          data.bills.push({
            ...template,
            id: crypto.randomUUID(),
            month: occurrenceMonth,
            dueDate,
            status: template.recurrencePaidFromMonth && occurrenceMonth >= template.recurrencePaidFromMonth ? 'paid' : 'pending',
            paidBy: template.recurrencePaidFromMonth && occurrenceMonth >= template.recurrencePaidFromMonth ? 'Quitado antecipadamente' : '',
            paidAmount: template.recurrencePaidFromMonth && occurrenceMonth >= template.recurrencePaidFromMonth ? template.amount : 0,
            attachments: [],
            recurrenceSkippedMonths: [...skipped]
          });
          changed = true;
        }

        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    if (changed) await saveLocalData(data);
    return data.bills.filter(b => b.month === month);
  },

  getAllBills: async (): Promise<Bill[]> => {
    const data = getLocalData();
    return data.bills;
  },

  addBill: async (bill: Bill) => {
    const data = getLocalData();
    data.bills.push(bill);
    await saveLocalData(data);
    sendNotification('Nova Conta', `Conta "${bill.description}" adicionada!`);
  },

  updateBill: async (updatedBill: Bill) => {
    const data = getLocalData();
    const oldBill = data.bills.find(b => b.id === updatedBill.id);
    
    // Check for status change to paid
    if (oldBill && oldBill.status !== 'paid' && updatedBill.status === 'paid') {
        sendNotification('Conta Paga', `A conta "${updatedBill.description}" foi marcada como paga!`);
    }

    data.bills = data.bills.map(b => b.id === updatedBill.id ? updatedBill : b);
    await saveLocalData(data);
  },

  deleteBill: async (id: string) => {
    const data = getLocalData();
    const bill = data.bills.find(b => b.id === id);

    if (bill?.recurringId) {
      // Registra a exclusão deste mês em todas as ocorrências da série.
      const skippedMonth = bill.month;
      data.bills = data.bills.map(b =>
        b.recurringId === bill.recurringId
          ? {
              ...b,
              recurrenceSkippedMonths: [
                ...new Set([...(b.recurrenceSkippedMonths || []), skippedMonth])
              ]
            }
          : b
      );
    }

    data.bills = data.bills.filter(b => b.id !== id);
    await saveLocalData(data);
  },

  deleteBillSeries: async (recurringId: string) => {
    const data = getLocalData();
    data.bills = data.bills.filter(b => b.recurringId !== recurringId);
    await saveLocalData(data);
  },

  payBillSeriesFrom: async (recurringId: string, fromMonth: string, paidBy: string) => {
    const data = getLocalData();
    data.bills = data.bills.map(b => {
      if (b.recurringId !== recurringId) return b;
      const future = b.month >= fromMonth;
      return {
        ...b,
        ...(future ? { status: 'paid' as const, paidBy, paidAmount: b.amount } : {}),
        recurrencePaidFromMonth: fromMonth
      };
    });
    await saveLocalData(data);
  },

  checkDueBills: async () => {
    const data = getLocalData();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Get stored notification state
    const lastCheck = localStorage.getItem('homefin_last_notification_check');
    let notifiedBills: string[] = [];
    
    if (lastCheck === todayStr) {
        const stored = localStorage.getItem('homefin_notified_bills');
        if (stored) {
            try {
                notifiedBills = JSON.parse(stored);
            } catch (e) {
                notifiedBills = [];
            }
        }
    } else {
        // New day, reset notifications
        localStorage.setItem('homefin_last_notification_check', todayStr);
        localStorage.removeItem('homefin_notified_bills');
    }

    const pendingBills = data.bills.filter(b => b.status === 'pending');
    let hasNewNotifications = false;
    const prefs = data.settings.notificationPreferences;

    pendingBills.forEach(bill => {
        // Check if due date matches today or tomorrow and hasn't been notified yet
        if ((bill.dueDate === todayStr || bill.dueDate === tomorrowStr) && !notifiedBills.includes(bill.id)) {
            const amount = (bill.amount + (bill.subCategoryAmount || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const isTomorrow = bill.dueDate === tomorrowStr;
            const title = isTomorrow ? 'Conta Vence Amanhã!' : 'Conta Vencendo Hoje!';
            const message = `A conta "${bill.description}" vence ${isTomorrow ? 'amanhã' : 'hoje'}. Valor: ${amount}`;
            
            // Send Push Notification
            if (prefs?.push !== false) {
                sendNotification(title, message);
            }

            // Simulate WhatsApp
            if (prefs?.whatsapp && prefs?.whatsappNumber) {
                console.log(`[WhatsApp Simulado para ${prefs.whatsappNumber}]: ${title} - ${message}`);
                // In a real app, this would call a backend API to send the WhatsApp message
            }

            // Simulate Email
            if (prefs?.email && prefs?.emailAddress) {
                console.log(`[Email Simulado para ${prefs.emailAddress}]: ${title} - ${message}`);
                // In a real app, this would call a backend API to send the Email
            }

            notifiedBills.push(bill.id);
            hasNewNotifications = true;
        }
    });

    if (hasNewNotifications) {
        localStorage.setItem('homefin_notified_bills', JSON.stringify(notifiedBills));
    }
  },

  // --- Shopping ---
  getShoppingList: async (): Promise<ShoppingItem[]> => {
    const data = getLocalData();
    return data.shoppingList;
  },

  toggleShoppingItem: async (id: string, currentStatus: boolean) => {
    const data = getLocalData();
    const item = data.shoppingList.find(i => i.id === id);
    if (item) item.checked = !item.checked;
    await saveLocalData(data);
  },

  addShoppingItem: async (item: ShoppingItem) => {
    const data = getLocalData();
    data.shoppingList.push(item);
    await saveLocalData(data);
    sendNotification('Lista de Compras', `Item "${item.name}" adicionado à lista!`);
  },

  updateShoppingItem: async (item: ShoppingItem) => {
    const data = getLocalData();
    const idx = data.shoppingList.findIndex(i => i.id === item.id);
    if (idx >= 0) data.shoppingList[idx] = item;
    await saveLocalData(data);
  },

  deleteShoppingItem: async (id: string) => {
    const data = getLocalData();
    data.shoppingList = data.shoppingList.filter(i => i.id !== id);
    await saveLocalData(data);
  },
  
  deleteManyShoppingItems: async (ids: string[]) => {
      const data = getLocalData();
      data.shoppingList = data.shoppingList.filter(i => !ids.includes(i.id));
      await saveLocalData(data);
  },
  
  clearShoppingList: async () => {
    const data = getLocalData();
    data.shoppingList = [];
    await saveLocalData(data);
  },

  // --- Smart Logic / History ---
  updateProductHistory: async (items: ShoppingItem[]) => {
    const data = getLocalData();
    const today = new Date().toISOString();

    items.forEach(item => {
        // Regex para remover emoji do início para normalizar o nome
        let cleanName = item.name.replace(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])\s+/, '').trim();
        
        const emojiMatch = item.name.match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/);
        const emoji = emojiMatch ? emojiMatch[0] : '🛒';

        const existingIdx = data.knownProducts.findIndex(p => p.name.toLowerCase() === cleanName.toLowerCase());

        if (existingIdx >= 0) {
            data.knownProducts[existingIdx].purchaseCount += 1;
            data.knownProducts[existingIdx].lastPurchased = today;
            if (emoji !== '🛒') data.knownProducts[existingIdx].emoji = emoji;
        } else {
            data.knownProducts.push({
                name: cleanName,
                emoji: emoji,
                purchaseCount: 1,
                lastPurchased: today
            });
        }
    });
    await saveLocalData(data);
  },

  getSmartSuggestions: async () => {
    const data = getLocalData();
    const products = data.knownProducts;
    const currentListNames = data.shoppingList.map(i => {
         return i.name.replace(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])\s+/, '').toLowerCase();
    });

    const now = new Date();

    // Strategy 1: Restock (Comprou bastante, mas faz tempo > 7 dias)
    const restock = products.filter(p => {
        if (currentListNames.includes(p.name.toLowerCase())) return false;
        const lastDate = new Date(p.lastPurchased);
        const diffDays = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return p.purchaseCount >= 2 && diffDays > 7;
    }).sort((a, b) => b.purchaseCount - a.purchaseCount).slice(0, 5);

    // Strategy 2: Frequent (Mais comprados no geral)
    const frequent = products.filter(p => {
        if (currentListNames.includes(p.name.toLowerCase())) return false;
        if (restock.find(r => r.name === p.name)) return false; 
        return true;
    }).sort((a, b) => b.purchaseCount - a.purchaseCount).slice(0, 8);

    // Strategy 3: Forgotten (Comprou muito antigamente, > 30 dias sem comprar)
    const forgotten = products.filter(p => {
        if (currentListNames.includes(p.name.toLowerCase())) return false;
        if (restock.find(r => r.name === p.name)) return false;
        const lastDate = new Date(p.lastPurchased);
        const diffDays = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return p.purchaseCount >= 3 && diffDays > 30;
    }).slice(0, 3);

    return { restock, frequent, forgotten };
  },

  // --- Goals ---
  getGoals: async (): Promise<Goal[]> => {
    return getLocalData().goals;
  },

  updateGoal: async (goal: Goal) => {
    const data = getLocalData();
    const idx = data.goals.findIndex(g => g.id === goal.id);
    if (idx >= 0) {
        data.goals[idx] = goal;
    } else {
        data.goals.push(goal);
        sendNotification('Nova Meta', `Meta "${goal.title}" adicionada!`);
    }
    await saveLocalData(data);
  },

  deleteGoal: async (id: string) => {
    const data = getLocalData();
    data.goals = data.goals.filter(g => g.id !== id);
    await saveLocalData(data);
  },

  // --- Assets ---
  getAssets: async (): Promise<Asset[]> => {
    return getLocalData().assets;
  },

  updateAsset: async (asset: Asset) => {
    const data = getLocalData();
    const idx = data.assets.findIndex(a => a.id === asset.id);
    if (idx >= 0) {
        data.assets[idx] = asset;
    } else {
        data.assets.push(asset);
        sendNotification('Novo Bem', `Bem "${asset.name}" adicionado ao patrimônio!`);
    }
    await saveLocalData(data);
  },
  
  deleteAsset: async (id: string) => {
      const data = getLocalData();
      data.assets = data.assets.filter(a => a.id !== id);
      await saveLocalData(data);
  },

  // --- Calendar Events ---
  getEvents: async (): Promise<CalendarEvent[]> => {
    return getLocalData().events || [];
  },

  addEvent: async (event: CalendarEvent) => {
    const data = getLocalData();
    if (!data.events) data.events = [];
    data.events.push(event);
    await saveLocalData(data);
    sendNotification('Nova Agenda', `Evento "${event.title}" adicionado à agenda!`);
  },

  addEvents: async (events: CalendarEvent[]) => {
    const data = getLocalData();
    if (!data.events) data.events = [];
    data.events.push(...events);
    await saveLocalData(data);
    if (events.length > 0) {
      sendNotification('Nova Agenda', `${events.length} eventos adicionados à agenda!`);
    }
  },

  updateEvent: async (event: CalendarEvent) => {
    const data = getLocalData();
    if (!data.events) data.events = [];
    const idx = data.events.findIndex(e => e.id === event.id);
    if (idx >= 0) data.events[idx] = event;
    await saveLocalData(data);
  },

  deleteEvent: async (id: string) => {
    const data = getLocalData();
    if (!data.events) return;
    data.events = data.events.filter(e => e.id !== id);
    await saveLocalData(data);
  },

  deleteEventsByGroupId: async (groupId: string) => {
    const data = getLocalData();
    if (!data.events) return;
    
    const initialCount = data.events.length;
    console.log(`Attempting to delete series with groupId: "${groupId}"`);
    
    // Filter out events with the matching groupId
    // Keep events where groupId DOES NOT match the target groupId
    data.events = data.events.filter(e => {
        // Handle potential undefined/null groupIds in other events
        if (!e.groupId) return true; 
        
        const match = String(e.groupId) === String(groupId);
        if (match) {
            console.log(`Deleting event ${e.id} with groupId ${e.groupId}`);
        }
        return !match;
    });
    
    const finalCount = data.events.length;
    const deletedCount = initialCount - finalCount;
    
    console.log(`Deleted ${deletedCount} events. Saving data...`);
    await saveLocalData(data);
  },

  updateEventsByGroupId: async (groupId: string, updates: Partial<CalendarEvent>) => {
    const data = getLocalData();
    if (!data.events) return;
    // Atualiza apenas campos seguros, mantendo datas e IDs originais
    data.events = data.events.map(e => {
        if (e.groupId === groupId) {
            return { 
                ...e, 
                ...updates, 
                id: e.id, 
                start: e.start, 
                end: e.end 
            };
        }
        return e;
    });
    await saveLocalData(data);
  },

  // --- Debts ---
  getDebts: async (): Promise<Debt[]> => {
    const data = getLocalData();
    return data.debts || [];
  },

  addDebt: async (debt: Debt) => {
    const data = getLocalData();
    if (!data.debts) data.debts = [];
    data.debts.push(debt);
    await saveLocalData(data);
  },

  updateDebt: async (id: string, updates: Partial<Debt>) => {
    const data = getLocalData();
    if (!data.debts) return;
    data.debts = data.debts.map(d => d.id === id ? { ...d, ...updates } : d);
    await saveLocalData(data);
  },

  deleteDebt: async (id: string) => {
    const data = getLocalData();
    if (!data.debts) return;
    data.debts = data.debts.filter(d => d.id !== id);
    await saveLocalData(data);
  },

  // BankAccounts
  getBankAccounts: async () => {
    const data = getLocalData();
    return data.bankAccounts || [];
  },

  addBankAccount: async (account: any) => {
    const data = getLocalData();
    if (!data.bankAccounts) data.bankAccounts = [];
    data.bankAccounts.push(account);
    await saveLocalData(data);
  },

  updateBankAccount: async (id: string, updates: any) => {
    const data = getLocalData();
    if (!data.bankAccounts) return;
    data.bankAccounts = data.bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a);
    await saveLocalData(data);
  },

  deleteBankAccount: async (id: string) => {
    const data = getLocalData();
    if (!data.bankAccounts) return;
    data.bankAccounts = data.bankAccounts.filter(a => a.id !== id);
    await saveLocalData(data);
  }
};

// Listeners de Rede para Sincronização Automática
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('Conexão restaurada. Sincronizando...');
        db.sync();
    });
    
    window.addEventListener('load', () => {
        db.sync();
    });
}
