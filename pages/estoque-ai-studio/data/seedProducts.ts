import { Product } from '../types';

// Helper to create clean SVG data URIs for realistic auto parts/tire visuals
const createTireSvg = (model: string, size: string, brand: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1e242b"/>
        <stop offset="60%" stop-color="#14171b"/>
        <stop offset="85%" stop-color="#0a0c0e"/>
        <stop offset="100%" stop-color="#020304"/>
      </radialGradient>
      <radialGradient id="rimGrad" cx="45%" cy="45%" r="50%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#d4d8dd"/>
        <stop offset="70%" stop-color="#7a828e"/>
        <stop offset="100%" stop-color="#3b424d"/>
      </radialGradient>
      <linearGradient id="treadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2a3038"/>
        <stop offset="50%" stop-color="#121518"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="#f1f5f9"/>
    <!-- Outer Tire Shadow -->
    <circle cx="200" cy="208" r="160" fill="rgba(0,0,0,0.25)"/>
    <!-- Outer Tire Rubber -->
    <circle cx="200" cy="200" r="160" fill="url(#tireGrad)"/>
    <!-- Tire Grooves and Treads -->
    <circle cx="200" cy="200" r="148" fill="none" stroke="#2c333a" stroke-width="4" stroke-dasharray="10 8"/>
    <circle cx="200" cy="200" r="138" fill="none" stroke="#0f1215" stroke-width="6" stroke-dasharray="14 10"/>
    <circle cx="200" cy="200" r="128" fill="none" stroke="#222830" stroke-width="2"/>
    <circle cx="200" cy="200" r="105" fill="#181d22"/>
    <!-- Inner Rim -->
    <circle cx="200" cy="200" r="95" fill="url(#rimGrad)"/>
    <circle cx="200" cy="200" r="88" fill="#1e293b"/>
    <!-- Rim Spokes -->
    <g stroke="#94a3b8" stroke-width="12" stroke-linecap="round">
      <line x1="200" y1="200" x2="200" y2="120"/>
      <line x1="200" y1="200" x2="276" y2="175"/>
      <line x1="200" y1="200" x2="247" y2="265"/>
      <line x1="200" y1="200" x2="153" y2="265"/>
      <line x1="200" y1="200" x2="124" y2="175"/>
    </g>
    <!-- Center Hub -->
    <circle cx="200" cy="200" r="32" fill="#0f172a"/>
    <circle cx="200" cy="200" r="28" fill="#e2e8f0"/>
    <circle cx="200" cy="200" r="12" fill="#003816"/>
    <!-- Brand and Size Stamped on sidewall -->
    <text x="200" y="78" fill="#cbd5e1" font-family="sans-serif" font-weight="900" font-size="14" letter-spacing="3" text-anchor="middle">${brand.toUpperCase()}</text>
    <text x="200" y="340" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="13" letter-spacing="2" text-anchor="middle">${size}</text>
    <text x="200" y="360" fill="#64748b" font-family="sans-serif" font-size="10" text-anchor="middle">${model}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const createPartSvg = (title: string, subtitle: string, iconType: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="400" height="400" fill="#f8fafc"/>
    <circle cx="200" cy="200" r="150" fill="#003816" opacity="0.08"/>
    <rect x="70" y="70" width="260" height="260" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M140 130 H260 V270 H140 Z" fill="#003816" opacity="0.15"/>
    <circle cx="200" cy="180" r="45" fill="#003816"/>
    <text x="200" y="190" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="28" text-anchor="middle">${iconType}</text>
    <text x="200" y="270" fill="#003816" font-family="sans-serif" font-weight="bold" font-size="15" text-anchor="middle">${title}</text>
    <text x="200" y="292" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    codigoInterno: '548',
    codigoBarras: '207315005',
    descricao: 'PNEU SUNNY 195/55R15 85V NP226',
    medida: '195/55R15 85V',
    unidade: 'UN',
    marcaRefer: 'SUNNY',
    estoqueAtual: 8.0,
    vendaMediaMensal: 10,
    estoqueMinimo: 6,
    precoVarejo: 319.00,
    precoAtacado: 299.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 8.5,
    pesoLiquido: 8.2,
    observacao: 'Pneu radial de alta performance, índice 85V',
    fotoUrl: createTireSvg('NP226', '195/55R15 85V', 'SUNNY'),
    favorito: true
  },
  {
    id: 'prod-2',
    codigoInterno: '798',
    codigoBarras: '6924064120396',
    descricao: 'PNEU LANVIGATOR 195/55 R15 85V COMFORT II (IP)',
    medida: '195/55 R15 85V',
    unidade: 'UN',
    marcaRefer: 'LANVIGATOR',
    estoqueAtual: 2.0,
    vendaMediaMensal: 10,
    estoqueMinimo: 8,
    precoVarejo: 319.90,
    precoAtacado: 299.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 8.4,
    pesoLiquido: 8.1,
    observacao: 'Linha Comfort II - Silencioso e aderente',
    fotoUrl: createTireSvg('COMFORT II', '195/55 R15 85V', 'LANVIGATOR'),
    favorito: true
  },
  {
    id: 'prod-3',
    codigoInterno: '320',
    codigoBarras: '59493',
    descricao: 'PNEU 185/65R14 FERENTINO VERSO 86H TL',
    medida: '185/65R14 86H',
    unidade: 'UN',
    marcaRefer: 'FERENTINO',
    estoqueAtual: 7.0,
    vendaMediaMensal: 12,
    estoqueMinimo: 8,
    precoVarejo: 345.00,
    precoAtacado: 320.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 7.9,
    pesoLiquido: 7.6,
    observacao: 'Tubeless, composto com sílica',
    fotoUrl: createTireSvg('VERSO TL', '185/65R14 86H', 'FERENTINO'),
    favorito: true
  },
  {
    id: 'prod-4',
    codigoInterno: '691',
    codigoBarras: '7898403653830',
    descricao: 'PNEU HIFLY 265/70R16 112T VIGOROUS AT601',
    medida: '265/70R16 112T',
    unidade: 'UN',
    marcaRefer: 'HIFLY',
    estoqueAtual: 4.0,
    vendaMediaMensal: 8,
    estoqueMinimo: 6,
    precoVarejo: 698.00,
    precoAtacado: 650.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 16.5,
    pesoLiquido: 16.0,
    observacao: 'Pneu todo terreno All-Terrain AT601 caminhonete/SUV',
    fotoUrl: createTireSvg('AT601', '265/70R16 112T', 'HIFLY'),
    favorito: false
  },
  {
    id: 'prod-5',
    codigoInterno: '796',
    codigoBarras: '7908249330007',
    descricao: 'PNEU SUNNY 235/50R19 103W NU306 EV',
    medida: '235/50R19 103W',
    unidade: 'UN',
    marcaRefer: 'SUNNY',
    estoqueAtual: -2.0,
    vendaMediaMensal: 6,
    estoqueMinimo: 4,
    precoVarejo: 820.00,
    precoAtacado: 780.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 13.0,
    pesoLiquido: 12.6,
    observacao: 'Compatível com veículos elétricos e híbridos',
    fotoUrl: createTireSvg('NU306 EV', '235/50R19 103W', 'SUNNY'),
    favorito: false
  },
  {
    id: 'prod-6',
    codigoInterno: '324',
    codigoBarras: '61000',
    descricao: 'PNEU 205/60R15 DYNAMO STREET-H MH01 95H XL',
    medida: '205/60R15 95H XL',
    unidade: 'UN',
    marcaRefer: 'DYNAMO',
    estoqueAtual: 5.0,
    precoVarejo: 439.40,
    precoAtacado: 410.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 9.8,
    pesoLiquido: 9.4,
    observacao: 'Carga extra (Extra Load)',
    fotoUrl: createTireSvg('MH01 XL', '205/60R15 95H', 'DYNAMO'),
    favorito: false
  },
  {
    id: 'prod-7',
    codigoInterno: '512',
    codigoBarras: '201031401',
    descricao: 'PNEU IRONHEAD 185/70R14 88H REFLEX RH01',
    medida: '185/70R14 88H',
    unidade: 'UN',
    marcaRefer: 'IRONHEAD',
    estoqueAtual: 4.0,
    precoVarejo: 355.00,
    precoAtacado: 330.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 8.2,
    pesoLiquido: 7.9,
    observacao: 'Reflex RH01 durabilidade estendida',
    fotoUrl: createTireSvg('RH01', '185/70R14 88H', 'IRONHEAD'),
    favorito: false
  },
  {
    id: 'prod-8',
    codigoInterno: '523',
    codigoBarras: '204813007',
    descricao: 'PNEU HIFLY 175/70R13 82H HF-261',
    medida: '175/70R13 82H',
    unidade: 'UN',
    marcaRefer: 'HIFLY',
    estoqueAtual: 12.0,
    precoVarejo: 299.00,
    precoAtacado: 279.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 6.8,
    pesoLiquido: 6.5,
    observacao: 'Aro 13 linha popular econômica',
    fotoUrl: createTireSvg('HF-261', '175/70R13 82H', 'HIFLY'),
    favorito: true
  },
  {
    id: 'prod-9',
    codigoInterno: '703',
    codigoBarras: '7908249311297',
    descricao: 'PNEU HIFLY 185/60R14 82H HF261',
    medida: '185/60R14 82H',
    unidade: 'UN',
    marcaRefer: 'HIFLY',
    estoqueAtual: 1.0,
    precoVarejo: 264.00,
    precoAtacado: 245.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 7.5,
    pesoLiquido: 7.2,
    observacao: 'Excelente custo benefício',
    fotoUrl: createTireSvg('HF261', '185/60R14 82H', 'HIFLY'),
    favorito: false
  },
  {
    id: 'prod-10',
    codigoInterno: '572',
    codigoBarras: '207318002',
    descricao: 'PNEU SUNNY 225/60R18 104V NU025 H/T',
    medida: '225/60R18 104V',
    unidade: 'UN',
    marcaRefer: 'SUNNY',
    estoqueAtual: 1.0,
    precoVarejo: 635.00,
    precoAtacado: 599.00,
    valorProm: 0.00,
    ncm: '40111000',
    pesoBruto: 12.8,
    pesoLiquido: 12.3,
    observacao: 'Highway Terrain para SUV e crossover',
    fotoUrl: createTireSvg('NU025 H/T', '225/60R18 104V', 'SUNNY'),
    favorito: false
  },
  {
    id: 'prod-11',
    codigoInterno: '17',
    codigoBarras: '87',
    descricao: 'RODA AUTOMOTIVA ARO 15 ESPORTIVA',
    medida: 'ARO 15 - 4x100 ET38',
    unidade: 'UN',
    marcaRefer: 'SCORRO',
    estoqueAtual: 12.0,
    precoVarejo: 669.50,
    precoAtacado: 620.00,
    valorProm: 0.00,
    ncm: '87087090',
    pesoBruto: 7.8,
    pesoLiquido: 7.5,
    observacao: 'Liga leve acabamento diamantado grafite',
    fotoUrl: createPartSvg('RODA ESPORTIVA', 'ARO 15 - 4x100', '⚙️'),
    favorito: true
  },
  {
    id: 'prod-12',
    codigoInterno: '226',
    codigoBarras: '25094',
    descricao: 'KJH1614-JUNTA HOMOCINETICA FIAT NOVO UNO/PALIO 1.0 2012/17',
    medida: '20 dentes int / 22 ext',
    unidade: 'UN',
    marcaRefer: 'NAKATA',
    estoqueAtual: 3.0,
    precoVarejo: 148.58,
    precoAtacado: 135.00,
    valorProm: 0.00,
    ncm: '87085099',
    pesoBruto: 2.1,
    pesoLiquido: 2.0,
    observacao: 'Com coifa, graxa e abraçadeiras',
    fotoUrl: createPartSvg('JUNTA HOMOCINÉTICA', 'NAKATA KJH1614', '🔩'),
    favorito: false
  },
  {
    id: 'prod-13',
    codigoInterno: '221',
    codigoBarras: '24046',
    descricao: 'AMORTECEDOR VW GOL G5 G6 G7 G8 1.0 2008/2022 TRAS',
    medida: 'Traseiro Pressurizado Gás',
    unidade: 'UN',
    marcaRefer: 'MONROE',
    estoqueAtual: 6.0,
    precoVarejo: 170.77,
    precoAtacado: 155.00,
    valorProm: 0.00,
    ncm: '87088000',
    pesoBruto: 2.3,
    pesoLiquido: 2.2,
    observacao: 'Oespectrum garantia 2 anos',
    fotoUrl: createPartSvg('AMORTECEDOR TRAS', 'GOL G5-G8 MONROE', '🚘'),
    favorito: true
  },
  {
    id: 'prod-14',
    codigoInterno: '167',
    codigoBarras: '16195',
    descricao: 'FILTRO OLEO HB20 1.0 12V 12ED PICANTO 1.0 09E',
    medida: 'Rosca M20x1.5 blindado',
    unidade: 'UN',
    marcaRefer: 'TECFIL',
    estoqueAtual: 14.0,
    precoVarejo: 30.60,
    precoAtacado: 27.00,
    valorProm: 0.00,
    ncm: '84212300',
    pesoBruto: 0.35,
    pesoLiquido: 0.32,
    observacao: 'Filtro lubrificante de alta eficiência',
    fotoUrl: createPartSvg('FILTRO DE ÓLEO', 'TECFIL PSL146', '🛢️'),
    favorito: false
  },
  {
    id: 'prod-15',
    codigoInterno: '761',
    codigoBarras: '1616631480',
    descricao: 'LAMOAT0046-OLEO MOTOR 20W50 MINERAL',
    medida: '1 Litro 20W50 SL',
    unidade: 'UN',
    marcaRefer: 'LUBRAX',
    estoqueAtual: 20.0,
    precoVarejo: 30.99,
    precoAtacado: 27.50,
    valorProm: 0.00,
    ncm: '27101932',
    pesoBruto: 0.95,
    pesoLiquido: 0.90,
    observacao: 'Lubrax Essencial 20W-50 multiviscoso',
    fotoUrl: createPartSvg('ÓLEO MOTOR 20W50', 'LUBRAX ESSENCIAL 1L', '💧'),
    favorito: true
  },
  {
    id: 'prod-16',
    codigoInterno: '764',
    codigoBarras: '1616631510',
    descricao: 'VALVULA PNEU S/ CAMARA TR 414 COMPRIMENTO 49,1MM P/ FURO 115MM',
    medida: 'TR 414 - 49.1mm',
    unidade: 'PC',
    marcaRefer: 'VILUZ',
    estoqueAtual: 235.0,
    precoVarejo: 10.00,
    precoAtacado: 8.50,
    valorProm: 0.00,
    ncm: '84814000',
    pesoBruto: 0.02,
    pesoLiquido: 0.02,
    observacao: 'Bico de borracha com núcleo e tampa',
    fotoUrl: createPartSvg('BICO VÁLVULA TR414', 'VILUZ 49.1MM', '📍'),
    favorito: false
  },
  {
    id: 'prod-17',
    codigoInterno: '283',
    codigoBarras: '37777',
    descricao: 'BDJ0703-BANDEJA SUSP.TOYOTA ETIOS 2012/.. LE',
    medida: 'Lado Esquerdo C/ Pivô',
    unidade: 'UN',
    marcaRefer: 'COFAP',
    estoqueAtual: 2.0,
    precoVarejo: 266.66,
    precoAtacado: 245.00,
    valorProm: 0.00,
    ncm: '87088000',
    pesoBruto: 3.8,
    pesoLiquido: 3.6,
    observacao: 'Bandeja completa com buchas e pivô',
    fotoUrl: createPartSvg('BANDEJA SUSPENSÃO', 'COFAP BDJ0703 ETIOS', '🛠️'),
    favorito: false
  },
  {
    id: 'prod-18',
    codigoInterno: '80',
    codigoBarras: '4040',
    descricao: 'DULUB SUPREME 20W50 SL 24X1',
    medida: 'Frasco 1 Litro SL',
    unidade: 'UN',
    marcaRefer: 'DULUB',
    estoqueAtual: 8.0,
    precoVarejo: 21.59,
    precoAtacado: 19.00,
    valorProm: 0.00,
    ncm: '27101932',
    pesoBruto: 0.92,
    pesoLiquido: 0.88,
    observacao: 'Óleo mineral para motores a gasolina/etanol/GNV',
    fotoUrl: createPartSvg('DULUB SUPREME 20W50', 'LUBRIFICANTE 1L', '💧'),
    favorito: false
  }
];
