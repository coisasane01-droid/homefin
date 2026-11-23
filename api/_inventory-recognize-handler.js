import { GoogleGenAI, Type } from '@google/genai';
import { validateFamilySession } from './_family-session.js';

const FAMILY_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { familyId, imageBase64, mimeType } = req.body || {};
  if (
    typeof familyId !== 'string' ||
    !FAMILY_PATTERN.test(familyId) ||
    familyId === 'v1'
  ) {
    return res.status(400).json({ error: 'Identificador familiar inválido.' });
  }

  if (
    typeof imageBase64 !== 'string' ||
    imageBase64.length > 4_200_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) ||
    imageBase64.length % 4 !== 0 ||
    !ALLOWED_MIME.has(mimeType)
  ) {
    return res.status(400).json({ error: 'Foto inválida. Use JPG, PNG ou WEBP de até 3 MB.' });
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) {
      return res.status(401).json({
        error: session.error || 'Sessão familiar inválida.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'O reconhecimento por foto ainda não está configurado no servidor. Cadastre GEMINI_API_KEY nas variáveis da Vercel.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          {
            text: [
              'Você é um assistente de cadastro de estoque. Analise a foto da embalagem, etiqueta ou produto.',
              'Extraia somente informações que estejam visíveis e legíveis na imagem.',
              'Não invente marca, modelo, código, categoria, NCM ou unidade.',
              'Se houver código de barras legível, retorne todos os dígitos exatamente.',
              'O campo name deve ser uma descrição curta e clara do produto; supplier pode receber a marca/fabricante quando visível.',
              'measure deve receber medida/modelo visível (por exemplo 205/55 R16, 1 litro ou 10 metros).',
              'unit deve ser uma unidade clara (UN, KG, L, M, CX); se não for possível identificar, retorne string vazia.',
              'Nunca estime preços, custo, preço de venda, quantidade em estoque ou estoque mínimo.',
              'Retorne campos vazios quando a informação não estiver visível.'
            ].join(' ')
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            sku: { type: Type.STRING },
            barcode: { type: Type.STRING },
            category: { type: Type.STRING },
            supplier: { type: Type.STRING },
            measure: { type: Type.STRING },
            unit: { type: Type.STRING },
            ncm: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ['name', 'sku', 'barcode', 'category', 'supplier', 'measure', 'unit', 'ncm', 'notes']
        }
      }
    });

    if (!response.text) {
      return res.status(422).json({ error: 'Não foi possível identificar dados suficientes nesta foto. Tente outra imagem mais nítida.' });
    }

    const parsed = JSON.parse(response.text);
    const limits = {
      name: 160, sku: 80, barcode: 100, category: 100,
      supplier: 160, measure: 120, unit: 30, ncm: 20, notes: 1000
    };
    const product = {};
    for (const [field, maxLength] of Object.entries(limits)) {
      const value = typeof parsed[field] === 'string' ? parsed[field].trim() : '';
      product[field] = value.slice(0, maxLength);
    }

    if (!product.name && !product.barcode && !product.sku) {
      return res.status(422).json({
        error: 'A foto não mostrou nome ou código legível. Tente aproximar a câmera e fotografar com boa iluminação.',
      });
    }

    return res.status(200).json({ product });
  } catch (error) {
    console.error('Falha no reconhecimento de produto por foto:', error instanceof Error ? error.message : 'Erro desconhecido');
    return res.status(503).json({
      error: 'Não foi possível analisar a foto agora. Confira sua conexão e tente novamente.',
    });
  }
}
