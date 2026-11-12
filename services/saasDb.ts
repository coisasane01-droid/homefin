import { UserSettings } from '../types';
import { supabaseService } from './supabaseService';

export interface AccessCode {
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  status: 'active' | 'inactive';
  usedBy: string[];
  discountPercent?: number;
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
  mercadoPagoPublicKey?: string;
}

function removeLegacyMercadoPagoToken(paymentConfig: PaymentConfig): PaymentConfig {
  const safePaymentConfig: PaymentConfig & { mercadoPagoAccessToken?: unknown } = {
    ...paymentConfig,
  };
  delete safePaymentConfig.mercadoPagoAccessToken;
  return safePaymentConfig;
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
  imagePositionX?: number;
  imagePositionY?: number;
  partnerEnabled?: boolean;
  partnerImageUrl?: string;
  partnerLinkUrl?: string;
  partnerAltText?: string;
  partnerImagePositionX?: number;
  partnerImagePositionY?: number;
  partnerMediaType?: 'image' | 'mp4' | 'youtube';
  partnerVideoUrl?: string;
  partnerVideoFit?: 'cover' | 'contain';
  pages?: Record<string, PageAdvertisementConfig>;
}

export type AdvertisementMediaType = 'image' | 'mp4' | 'youtube';

export interface PageAdvertisementConfig {
  enabled: boolean;
  mediaType: AdvertisementMediaType;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  altText?: string;
  imagePositionX?: number;
  imagePositionY?: number;
  videoFit?: 'cover' | 'contain';
}

export const APP_ADVERTISEMENT_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bills', label: 'Contas do Mês' },
  { key: 'shopping', label: 'Compras' },
  { key: 'calendar', label: 'Calendário' },
  { key: 'wallets', label: 'Contas Bancárias' },
  { key: 'goals', label: 'Metas' },
  { key: 'assets', label: 'Patrimônio' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'inventory', label: 'Estoque' },
  { key: 'spreadsheets', label: 'Planilhas' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'debts', label: 'Dívidas' },
  { key: 'settings', label: 'Configurações' },
  { key: 'my-plan', label: 'Meu Plano' },
  { key: 'share', label: 'Compartilhar' },
  { key: 'support', label: 'Suporte' },
] as const;

export interface SaasData {
  codes: AccessCode[];
  families: Family[];
  plans: Plan[];
  landingConfig: LandingConfig;
  paymentConfig: PaymentConfig;
  adminConfig: AdminConfig;
  appBannerConfig: AppBannerConfig;
}

const SAAS_STORAGE_KEY = 'homefin_saas_data_v1';

const initialSaasData: SaasData = {
  codes: [],

  families: [],

  plans: [
    {
      id: 'free',
      name: 'Básico',
      price: 0,
      period: '/mês',
      features: [
        'Gestão de Contas',
        'Lista de Compras',
        '1 Usuário',
        'Relatórios Simples'
      ],
      cta: 'Começar Grátis',
      popular: false
    },
    {
      id: 'premium',
      name: 'Família Pro',
      price: 29.90,
      period: '/mês',
      features: [
        'Tudo do Básico',
        'Metas e Sonhos',
        'Patrimônio',
        'Multi-usuários',
        'Relatórios Avançados',
        'Suporte Prioritário'
      ],
      cta: 'Assinar Agora',
      popular: true
    }
  ],

  landingConfig: {
    title: 'Suas Finanças,\nSimplificadas.',
    subtitle:
      'Gerencie contas, metas e sonhos da sua família em um só lugar. Simples, seguro e feito para você.',
    buttonText: 'Criar Conta Grátis',
    bannerImage: '',
    logoImage: '',
    pwaIcon: '',
    pwaName: 'HomeFin',
    bgColorStart: '#312e81',
    bgColorEnd: '#3730a3',
    textColor: '#ffffff',
    titleColor: '#ffffff',
    accentColorStart: '#818cf8',
    accentColorEnd: '#c084fc',
    logoWidth: '128',
    logoRadius: '16'
  },

  paymentConfig: {
    pixKey: 'chave-pix-exemplo',
    pixQrCodeUrl: ''
  },

  adminConfig: {
    password: 'admin123',
    recoveryKeyword: 'admin'
  },

  appBannerConfig: {
    enabled: true,
    imageUrl: 'https://picsum.photos/seed/ads/800/100',
    linkUrl: 'https://google.com',
    altText: 'Banner Publicitário',
    partnerEnabled: false,
    partnerImageUrl: '',
    partnerLinkUrl: '',
    partnerAltText: 'Publicidade de parceiro',
    partnerImagePositionX: 50,
    partnerImagePositionY: 50,
    partnerMediaType: 'image',
    partnerVideoUrl: '',
    partnerVideoFit: 'cover'
  }
};

// ============================================================
// LEITURA LOCAL
// ============================================================

const getSaasData = (): SaasData => {
  try {
    const data = localStorage.getItem(SAAS_STORAGE_KEY);

    if (!data) {
      return structuredClone(initialSaasData);
    }

    const parsed = JSON.parse(data);
    if (parsed.paymentConfig) {
      parsed.paymentConfig = removeLegacyMercadoPagoToken(parsed.paymentConfig);
    }

    return {
      ...initialSaasData,
      ...parsed,

      landingConfig: {
        ...initialSaasData.landingConfig,
        ...(parsed.landingConfig || {})
      },

      paymentConfig: {
        ...initialSaasData.paymentConfig,
        ...(parsed.paymentConfig || {})
      },

      adminConfig: {
        ...initialSaasData.adminConfig,
        ...(parsed.adminConfig || {})
      },

      appBannerConfig: {
        ...initialSaasData.appBannerConfig,
        ...(parsed.appBannerConfig || {})
      },

      codes: Array.isArray(parsed.codes)
        ? parsed.codes
        : initialSaasData.codes,

      families: Array.isArray(parsed.families)
        ? parsed.families
        : initialSaasData.families,

      plans: Array.isArray(parsed.plans)
        ? parsed.plans
        : initialSaasData.plans
    };
  } catch (error) {
    console.error('Erro ao ler dados SaaS locais:', error);
    return structuredClone(initialSaasData);
  }
};

// ============================================================
// SALVAMENTO LOCAL + SUPABASE
// ============================================================

const saveSaasData = (data: SaasData) => {
  const safeData = structuredClone(data);
  safeData.paymentConfig = removeLegacyMercadoPagoToken(safeData.paymentConfig);

  try {
    localStorage.setItem(
      SAAS_STORAGE_KEY,
      JSON.stringify(safeData)
    );
  } catch (error) {
    console.error('Erro ao salvar dados SaaS localmente:', error);
  }

  // Salva também no Supabase sem bloquear a interface.
  void supabaseService
    .saveSaasData(safeData)
    .then(() => {
      console.log('=== HOMEFIN SaaS ===');
      console.log('Dados SaaS sincronizados com Supabase.');
    })
    .catch((error) => {
      console.error(
        'Erro ao sincronizar dados SaaS com Supabase:',
        error
      );
    });
};

// ============================================================
// SINCRONIZAÇÃO SUPABASE → LOCAL
// ============================================================

const syncFromSupabase = async (): Promise<SaasData> => {
  try {
    console.log('=== HOMEFIN SaaS SYNC ===');
    console.log('Buscando dados SaaS no Supabase...');

    const remoteData = await supabaseService.getSaasData();

    // --------------------------------------------------------
    // PRIMEIRO ACESSO / MIGRAÇÃO
    // --------------------------------------------------------

    if (!remoteData) {
      const localData = getSaasData();

      console.log(
        'Nenhum dado SaaS encontrado no Supabase.'
      );

      console.log(
        'Enviando dados locais atuais para o Supabase...'
      );

      await supabaseService.saveSaasData(localData);

      console.log(
        'Dados locais migrados para o Supabase.'
      );

      return localData;
    }

    // --------------------------------------------------------
    // SUPABASE É A FONTE PRINCIPAL
    // --------------------------------------------------------

    const parsed = remoteData as Partial<SaasData>;
    if (parsed.paymentConfig) {
      parsed.paymentConfig = removeLegacyMercadoPagoToken(parsed.paymentConfig);
    }

    const mergedData: SaasData = {
      ...initialSaasData,
      ...parsed,

      landingConfig: {
        ...initialSaasData.landingConfig,
        ...(parsed.landingConfig || {})
      },

      paymentConfig: {
        ...initialSaasData.paymentConfig,
        ...(parsed.paymentConfig || {})
      },

      adminConfig: {
        ...initialSaasData.adminConfig,
        ...(parsed.adminConfig || {})
      },

      appBannerConfig: {
        ...initialSaasData.appBannerConfig,
        ...(parsed.appBannerConfig || {})
      },

      codes: Array.isArray(parsed.codes)
        ? parsed.codes
        : [],

      families: Array.isArray(parsed.families)
        ? parsed.families
        : [],

      plans: Array.isArray(parsed.plans)
        ? parsed.plans
        : initialSaasData.plans
    };

    localStorage.setItem(
      SAAS_STORAGE_KEY,
      JSON.stringify(mergedData)
    );

    console.log(
      'Dados SaaS carregados do Supabase.'
    );

    console.log(
      'Famílias:',
      mergedData.families.length
    );

    console.log(
      'Planos:',
      mergedData.plans.length
    );

    return mergedData;
  } catch (error) {
    console.error(
      'Erro na sincronização SaaS com Supabase:',
      error
    );

    // Se o Supabase estiver indisponível,
    // mantém o funcionamento pelo cache local.
    return getSaasData();
  }
};

// ============================================================
// BANCO SaaS
// ============================================================

export const saasDb = {

  // ==========================================================
  // SINCRONIZAÇÃO
  // ==========================================================

  /**
   * Sincroniza os dados SaaS com o Supabase.
   *
   * Deve ser chamado quando o aplicativo iniciar,
   * antes de consultar famílias, landing, planos etc.
   */
  syncFromSupabase,

  // ==========================================================
  // CÓDIGOS
  // ==========================================================

  createCode: (
    code: string,
    maxUses: number = 1,
    expiresAt?: string,
    discountPercent?: number
  ) => {
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

  validateCode: (
    code: string
  ): {
    valid: boolean;
    message?: string;
    discountPercent?: number;
  } => {
    const data = getSaasData();

    const found = data.codes.find(
      (c: AccessCode) => c.code === code
    );

    if (!found) {
      return {
        valid: false,
        message: 'Código inválido.'
      };
    }

    if (found.status !== 'active') {
      return {
        valid: false,
        message: 'Código inativo.'
      };
    }

    if (
      found.maxUses !== -1 &&
      found.usedCount >= found.maxUses
    ) {
      return {
        valid: false,
        message: 'Código esgotado.'
      };
    }

    if (
      found.expiresAt &&
      new Date() > new Date(found.expiresAt)
    ) {
      return {
        valid: false,
        message: 'Código expirado.'
      };
    }

    return {
      valid: true,
      discountPercent: found.discountPercent
    };
  },

  useCode: (
    code: string,
    familyId: string
  ) => {
    const data = getSaasData();

    const idx = data.codes.findIndex(
      (c: AccessCode) => c.code === code
    );

    if (idx >= 0) {
      data.codes[idx].usedCount += 1;
      data.codes[idx].usedBy.push(familyId);

      saveSaasData(data);
    }
  },

  getCodes: () => {
    return getSaasData().codes;
  },

  updateCodeStatus: (
    code: string,
    status: 'active' | 'inactive'
  ) => {
    const data = getSaasData();

    const idx = data.codes.findIndex(
      (c: AccessCode) => c.code === code
    );

    if (idx >= 0) {
      data.codes[idx].status = status;

      saveSaasData(data);
    }
  },

  deleteCode: (code: string) => {
    const data = getSaasData();

    data.codes = data.codes.filter(
      (c: AccessCode) => c.code !== code
    );

    saveSaasData(data);
  },

  // ==========================================================
  // FAMÍLIAS
  // ==========================================================

  createFamily: (
    name: string,
    plan: 'free' | 'premium',
    settings: any
  ) => {
    const data = getSaasData();

    const baseId = name
      .toLowerCase()
      .replace(/\s+/g, '-');

    let id = baseId;
    let counter = 1;

    while (
      data.families.some(
        (f: Family) => f.id === id
      )
    ) {
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

    console.log(
      'Família criada e enviada ao Supabase:',
      newFamily
    );

    return newFamily;
  },

  updateFamily: (
    id: string,
    updates: Partial<Family>
  ) => {
    const data = getSaasData();

    const idx = data.families.findIndex(
      (f: Family) => f.id === id
    );

    if (idx >= 0) {
      data.families[idx] = {
        ...data.families[idx],
        ...updates
      };

      saveSaasData(data);
    }
  },

  deleteFamily: async (id: string): Promise<void> => {
    const data = getSaasData();

    data.families = data.families.filter(
      (f: Family) => f.id !== id
    );

    // Salva localmente e aguarda a sincronização remota.
    localStorage.setItem(
      SAAS_STORAGE_KEY,
      JSON.stringify(data)
    );

    await supabaseService.saveSaasData(data);
  },

  getFamilies: () => {
    return getSaasData().families;
  },

  // ==========================================================
  // PLANOS
  // ==========================================================

  getPlans: () => {
    return getSaasData().plans;
  },

  createPlan: (plan: Plan) => {
    const data = getSaasData();

    data.plans.push(plan);

    saveSaasData(data);
  },

  savePlan: (plan: Plan) => {
    const data = getSaasData();

    const idx = data.plans.findIndex(
      (p: Plan) => p.id === plan.id
    );

    if (idx >= 0) {
      data.plans[idx] = plan;
    } else {
      data.plans.push(plan);
    }

    saveSaasData(data);
  },

  deletePlan: (id: string) => {
    const data = getSaasData();

    data.plans = data.plans.filter(
      (p: Plan) => p.id !== id
    );

    saveSaasData(data);
  },

  // ==========================================================
  // LANDING CONFIG
  // ==========================================================

  getLandingConfig: () => {
    return getSaasData().landingConfig;
  },

  updateLandingConfig: (
    config: LandingConfig
  ) => {
    const data = getSaasData();

    data.landingConfig = {
      ...data.landingConfig,
      ...config
    };

    saveSaasData(data);
  },

  // ==========================================================
  // PAYMENT CONFIG
  // ==========================================================

  getPaymentConfig: () => {
    return getSaasData().paymentConfig;
  },

  updatePaymentConfig: (
    config: PaymentConfig
  ) => {
    const data = getSaasData();

    data.paymentConfig = {
      ...data.paymentConfig,
      ...config
    };

    saveSaasData(data);
  },

  // ==========================================================
  // ADMIN CONFIG
  // ==========================================================

  getAdminConfig: () => {
    return getSaasData().adminConfig;
  },

  updateAdminConfig: (
    config: AdminConfig
  ) => {
    const data = getSaasData();

    data.adminConfig = {
      ...data.adminConfig,
      ...config
    };

    saveSaasData(data);
  },

  // ==========================================================
  // APP BANNER
  // ==========================================================

  getAppBannerConfig: () => {
    return getSaasData().appBannerConfig;
  },

  updateAppBannerConfig: (
    config: AppBannerConfig
  ) => {
    const data = getSaasData();

    data.appBannerConfig = {
      ...data.appBannerConfig,
      ...config
    };

    saveSaasData(data);
  },

  getPageAdvertisementConfig: (pageKey: string): PageAdvertisementConfig => {
    const banner = getSaasData().appBannerConfig;
    const saved = banner.pages?.[pageKey];

    if (saved) {
      return {
        enabled: false,
        mediaType: 'image',
        videoFit: 'cover',
        imagePositionX: 50,
        imagePositionY: 50,
        ...saved,
      };
    }

    // Compatibilidade com as campanhas antigas na página Contas do Mês.
    if (pageKey === 'bills') {
      const mediaType = banner.partnerMediaType || 'image';

      if (banner.enabled && banner.partnerEnabled) {
        const mediaUrl = mediaType === 'image'
          ? banner.partnerImageUrl
          : banner.partnerVideoUrl;

        if (mediaUrl?.trim()) {
          return {
            enabled: true,
            mediaType,
            imageUrl: mediaType === 'image' ? mediaUrl : '',
            videoUrl: mediaType !== 'image' ? mediaUrl : '',
            linkUrl: banner.partnerLinkUrl || '',
            altText: banner.partnerAltText || 'Publicidade de parceiro',
            imagePositionX: banner.partnerImagePositionX ?? 50,
            imagePositionY: banner.partnerImagePositionY ?? 50,
            videoFit: banner.partnerVideoFit || 'cover',
          };
        }
      }

      const legacyImage = banner.imageUrl?.trim() || '';
      const isDemoImage = legacyImage === 'https://picsum.photos/seed/ads/800/100';

      if (banner.enabled && legacyImage && !isDemoImage) {
        return {
          enabled: true,
          mediaType: 'image',
          imageUrl: legacyImage,
          linkUrl: banner.linkUrl || '',
          altText: banner.altText || 'Publicidade',
          imagePositionX: banner.imagePositionX ?? 50,
          imagePositionY: banner.imagePositionY ?? 50,
          videoFit: 'cover',
        };
      }
    }

    return {
      enabled: false,
      mediaType: 'image',
      imageUrl: '',
      videoUrl: '',
      linkUrl: '',
      altText: '',
      imagePositionX: 50,
      imagePositionY: 50,
      videoFit: 'cover',
    };
  },

  updatePageAdvertisementConfig: async (
    pageKey: string,
    config: PageAdvertisementConfig
  ): Promise<void> => {
    if (!APP_ADVERTISEMENT_PAGES.some(page => page.key === pageKey)) {
      throw new Error('Página de publicidade inválida.');
    }

    // Supabase é a fonte principal; lê a versão atual antes de alterar.
    const remoteData = await supabaseService.getSaasData();
    const localData = getSaasData();

    const baseData: SaasData = remoteData
      ? {
          ...localData,
          ...remoteData,
          appBannerConfig: {
            ...localData.appBannerConfig,
            ...(remoteData.appBannerConfig || {}),
            pages: {
              ...(localData.appBannerConfig?.pages || {}),
              ...(remoteData.appBannerConfig?.pages || {}),
            },
          },
        }
      : localData;

    const safeData = structuredClone(baseData);
    safeData.appBannerConfig = {
      ...safeData.appBannerConfig,
      pages: {
        ...(safeData.appBannerConfig.pages || {}),
        [pageKey]: { ...config },
      },
    };
    safeData.paymentConfig = removeLegacyMercadoPagoToken(safeData.paymentConfig);

    // Só altera o cache local depois da confirmação do servidor.
    await supabaseService.saveSaasData(safeData);

    localStorage.setItem(SAAS_STORAGE_KEY, JSON.stringify(safeData));
    window.dispatchEvent(new Event('homefin-saas-synced'));
  }

};