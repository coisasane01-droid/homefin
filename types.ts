export type TransactionStatus = 'pending' | 'paid';
export type TransactionType = 'fixed' | 'variable' | 'card' | 'tax';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'link';
}

export interface Bill {
  id: string;
  month: string; // Format: "YYYY-MM"
  description: string;
  amount: number;
  dueDate: string; // ISO Date
  category: TransactionType;
  subCategory?: string; // e.g., "Nubank Pedro"
  subCategoryAmount?: number; // Added for partial payments or specific sub-amounts
  status: TransactionStatus;
  createdBy?: string;
  paidBy?: string;
  assignedTo?: string; // New field for family member attribution
  paidAmount?: number; // Amount already paid
  isBold: boolean;
  notes?: string;
  attachments: Attachment[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  estimatedValue: number;
  checked: boolean;
  dueDate?: string;
}

export interface KnownProduct {
  name: string;
  emoji?: string;
  purchaseCount: number;
  lastPurchased: string; // ISO Date
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  photoUrl?: string;
  notes?: string;
}

export interface Asset {
  id: string;
  name: string;
  purchaseValue: number;
  purchaseDate: string;
  photoUrl?: string;
  notes?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  houseName: string;
  primaryColor: string;
  backgroundImage?: string;
  backgroundPosition?: string;
  backgroundZoom?: number; // percentage, default 100
  backgroundOpacity?: number; // 0-100, default 100 (fully opaque)
  backgroundFit?: 'cover' | 'contain';
  cardOpacity?: number; // 0-100, default 40
  cardFullScreen?: boolean; // default false
  logoImage?: string;
  logoPosition?: string;
  logoShape?: 'circle' | 'square';
  logoZoom?: number; // percentage, default 100
  logoSize?: number; // percentage, default 100
  customCategories?: string[];
  categories?: string[]; // New field for all editable categories
  members?: string[]; // New field for family members
  notificationsEnabled?: boolean; // New field for notification preference
  notificationPreferences?: {
    push: boolean;
    whatsapp: boolean;
    email: boolean;
    whatsappNumber?: string;
    emailAddress?: string;
  };
  currentBalance?: number; // New field for current balance
  integrations: {
    openBanking: boolean;
    saneago: boolean;
    equatorial: boolean;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO Date
  end: string; // ISO Date
  allDay: boolean;
  location?: string;
  description?: string;
  color?: string;
  groupId?: string;
}

export interface Debt {
  id: string;
  person: string;
  totalAmount: number;
  paidAmount: number;
  notes?: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'corrente' | 'poupanca' | 'carteira';
  balance: number;
  color?: string;
  icon?: string;
}

export interface AppData {
  bills: Bill[];
  shoppingList: ShoppingItem[];
  knownProducts: KnownProduct[]; // Added for smart suggestions
  goals: Goal[];
  assets: Asset[];
  events: CalendarEvent[];
  debts: Debt[]; // Added for debts system
  bankAccounts: BankAccount[]; // Added for bank accounts
  settings: UserSettings;
}