import { UserSettings } from '../types';

export interface AccessCode {
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt?: string; // ISO Date
  status: 'active' | 'inactive';
  usedBy: string[]; // Family IDs
  discountPercent?: number; // 0-100
}

export interface Family {
  id: string;
  name: string;
  plan: 'free' | 'premium';
  status: 'active' | 'inactive';
  createdAt: string;
  expiresAt?: string;
  settings?: UserSettings;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
  cta: string;
  image?: string;
}

export interface LandingConfig {
  title: string;
  subtitle: string;
  buttonText: string;
  bannerImage?: string;
  logoImage?: string;
  pwaIcon?: string;
  pwaName?: string;
  bgColorStart?: string;
  bgColorEnd?: string;
  textColor?: string;
  titleColor?: string;
  accentColorStart?: string;
  accentColorEnd?: string;
  logoWidth?: string;
  logoRadius?: string;
}

export interface PaymentConfig {
  pixKey: string;
  pixQrCodeUrl?: string;
  mercadoPagoAccessToken?: string;
  mercadoPagoPublicKey?: string;
}

export interface AdminConfig {
  password?: string;
  recoveryKeyword?: string;
}

export interface AppBannerConfig {
  enabled: boolean;
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const SAAS_STORAGE_KEY = 'homefin_saas_data_v1';

const initialSaasData = {
  codes: [] as AccessCode[],
  families: [] as Family[],
  plans: [
    { 
      id: 'free', 
      name: 'Básico', 
      price: 0, 
      period: '/mês',
      features: ['Gestão de Contas', 'Lista de Compras', '1 Usuário', 'Relatórios Simples'],
      cta: 'Começar Grátis',
      popular: false
    },
    { 
      id: 'premium', 
      name: 'Família Pro', 
      price: 29.90, 
      period: '/mês',
      features: ['Tudo do Básico', 'Metas e Sonhos', 'Patrimônio', 'Multi-usuários', 'Relatórios Avançados', 'Suporte Prioritário'],
      cta: 'Assinar Agora',
      popular: true
    }
  ] as Plan[],
  landingConfig: {
    title: 'Suas Finanças,\nSimplificadas.',
    subtitle: 'Gerencie contas, metas e sonhos da sua família em um só lugar. Simples, seguro e feito para você.',
    buttonText: 'Criar Conta Grátis',
    bannerImage: '',
    logoImage: '',
    pwaIcon: '',
    pwaName: 'HomeFin',
    bgColorStart: '#312e81', // indigo-900
    bgColorEnd: '#3730a3',   // indigo-800
    textColor: '#ffffff',
    titleColor: '#ffffff',
    accentColorStart: '#818cf8', // indigo-400
    accentColorEnd: '#c084fc',   // purple-400
    logoWidth: '128', // Default width in pixels (or tailwind class if we decide) - let's use pixels for finer control or just a number
    logoRadius: '16'  // Default radius in pixels
  } as LandingConfig,
  paymentConfig: {
    pixKey: 'chave-pix-exemplo',
    pixQrCodeUrl: ''
  } as PaymentConfig,
  adminConfig: {
    password: 'admin123',
    recoveryKeyword: 'admin'
  } as AdminConfig,
  appBannerConfig: {
    enabled: true,
    imageUrl: "https://picsum.photos/seed/ads/800/100",
    linkUrl: "https://google.com",
    altText: "Banner Publicitário"
  } as AppBannerConfig
};

const getSaasData = () => {
  const data = localStorage.getItem(SAAS_STORAGE_KEY);
  if (!data) return initialSaasData;
  
  const parsed = JSON.parse(data);
  // Merge with initial to ensure new fields exist if storage is old
  return { 
    ...initialSaasData, 
    ...parsed, 
    landingConfig: { ...initialSaasData.landingConfig, ...parsed.landingConfig },
    paymentConfig: { ...initialSaasData.paymentConfig, ...parsed.paymentConfig },
    adminConfig: { ...initialSaasData.adminConfig, ...parsed.adminConfig },
    appBannerConfig: { ...initialSaasData.appBannerConfig, ...parsed.appBannerConfig }
  };
};

const saveSaasData = (data: any) => {
  localStorage.setItem(SAAS_STORAGE_KEY, JSON.stringify(data));
};

export const saasDb = {
  // --- Codes ---
  createCode: (code: string, maxUses: number = 1, expiresAt?: string, discountPercent?: number) => {
    const data = getSaasData();
    const newCode: AccessCode = {
      code,
      maxUses,
      usedCount: 0,
      expiresAt,
      status: 'active',
      usedBy: [],
      discountPercent
    };
    data.codes.push(newCode);
    saveSaasData(data);
    return newCode;
  },

  validateCode: (code: string): { valid: boolean; message?: string; discountPercent?: number } => {
    const data = getSaasData();
    const found = data.codes.find((c: AccessCode) => c.code === code);
    
    if (!found) return { valid: false, message: 'Código inválido.' };
    if (found.status !== 'active') return { valid: false, message: 'Código inativo.' };
    
    // Check usage limit (skip if -1)
    if (found.maxUses !== -1 && found.usedCount >= found.maxUses) {
        return { valid: false, message: 'Código esgotado.' };
    }
    
    if (found.expiresAt && new Date() > new Date(found.expiresAt)) return { valid: false, message: 'Código expirado.' };

    return { valid: true, discountPercent: found.discountPercent };
  },

  useCode: (code: string, familyId: string) => {
    const data = getSaasData();
    const idx = data.codes.findIndex((c: AccessCode) => c.code === code);
    if (idx >= 0) {
      data.codes[idx].usedCount += 1;
      data.codes[idx].usedBy.push(familyId);
      saveSaasData(data);
    }
  },

  getCodes: () => getSaasData().codes,
  
  updateCodeStatus: (code: string, status: 'active' | 'inactive') => {
    const data = getSaasData();
    const idx = data.codes.findIndex((c: AccessCode) => c.code === code);
    if (idx >= 0) {
      data.codes[idx].status = status;
      saveSaasData(data);
    }
  },

  deleteCode: (code: string) => {
    const data = getSaasData();
    data.codes = data.codes.filter((c: AccessCode) => c.code !== code);
    saveSaasData(data);
  },

  // --- Families ---
  createFamily: (name: string, plan: 'free' | 'premium', settings: any) => {
    const data = getSaasData();
    const baseId = name.toLowerCase().replace(/\s+/g, '-');
    let id = baseId;
    let counter = 1;
    
    // Ensure unique ID
    while (data.families.some((f: Family) => f.id === id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    const newFamily: Family = {
      id,
      name,
      plan,
      status: 'active',
      createdAt: new Date().toISOString(),
      settings
    };
    data.families.push(newFamily);
    saveSaasData(data);
    return newFamily;
  },

  updateFamily: (id: string, updates: Partial<Family>) => {
    const data = getSaasData();
    const idx = data.families.findIndex((f: Family) => f.id === id);
    if (idx >= 0) {
      data.families[idx] = { ...data.families[idx], ...updates };
      saveSaasData(data);
    }
  },

  deleteFamily: (id: string) => {
    const data = getSaasData();
    data.families = data.families.filter((f: Family) => f.id !== id);
    saveSaasData(data);
  },

  getFamilies: () => getSaasData().families,

  // --- Plans ---
  getPlans: () => getSaasData().plans,
  
  createPlan: (plan: Plan) => {
    const data = getSaasData();
    data.plans.push(plan);
    saveSaasData(data);
  },

  savePlan: (plan: Plan) => {
    const data = getSaasData();
    const idx = data.plans.findIndex((p: Plan) => p.id === plan.id);
    if (idx >= 0) {
      data.plans[idx] = plan;
    } else {
      data.plans.push(plan);
    }
    saveSaasData(data);
  },

  deletePlan: (id: string) => {
    const data = getSaasData();
    data.plans = data.plans.filter((p: Plan) => p.id !== id);
    saveSaasData(data);
  },

  // --- Landing Config ---
  getLandingConfig: () => getSaasData().landingConfig,

  updateLandingConfig: (config: LandingConfig) => {
    const data = getSaasData();
    data.landingConfig = config;
    saveSaasData(data);
  },

  // --- Payment Config ---
  getPaymentConfig: () => getSaasData().paymentConfig,

  updatePaymentConfig: (config: PaymentConfig) => {
    const data = getSaasData();
    data.paymentConfig = config;
    saveSaasData(data);
  },

  // --- Admin Config ---
  getAdminConfig: () => getSaasData().adminConfig,

  updateAdminConfig: (config: AdminConfig) => {
    const data = getSaasData();
    data.adminConfig = { ...data.adminConfig, ...config };
    saveSaasData(data);
  },

  // --- App Banner Config ---
  getAppBannerConfig: () => getSaasData().appBannerConfig,

  updateAppBannerConfig: (config: AppBannerConfig) => {
    const data = getSaasData();
    data.appBannerConfig = config;
    saveSaasData(data);
  }
};
