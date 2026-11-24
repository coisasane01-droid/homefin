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

  const { familyId, imageBase64, mimeType, purpose = 'inventory' } = req.body || {};
  if (
    typeof familyId !== 'string' ||
    !FAMILY_PATTERN.test(familyId) ||
    familyId === 'v1'
  ) {
    return res.status(400).json({ error: 'Identificador familiar inválido.' });
  }

  if (!['inventory', 'shopping'].includes(purpose)) {
    return res.status(400).json({ error: 'Finalidade de reconhecimento inválida.' });
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

    const isShopping = purpose === 'shopping';
    const prompt = isShopping
      ? [
          'Você identifica produtos de supermercado e itens domésticos em fotografias para uma lista de compras.',
          'Retorne somente o nome comum e curto do produto, em português do Brasil, por exemplo Arroz, Feijão, Leite integral ou Detergente.',
          'Não descreva a foto, não inclua marca, preço, quantidade, tamanho, embalagem ou frases explicativas.',
          'Se houver vários produtos, escolha o item principal que ocupa mais destaque na imagem.',
          'Não confunda logotipos, textos promocionais ou objetos ao fundo com o produto.',
          'Se não for possível reconhecer com segurança o produto, retorne name vazio. Nunca invente.'
        ].join(' ')
      : [
          'Você é um especialista em leitura visual e cadastro de produtos para estoque de uma loja brasileira, incluindo pneus.',
          'Analise a imagem inteira e leia cuidadosamente etiquetas, rótulos, inscrições gravadas, laterais, flancos e logotipos. Considere que textos podem estar inclinados, de lado ou parcialmente curvados; faça a leitura visual mesmo quando precisar imaginar a rotação da etiqueta.',
          'Identifique a MARCA/FABRICANTE pelo nome ou logotipo realmente visível. Marcas de pneus que podem aparecer incluem HIFLY, SUNNY, QIMA e outras. Não escolha uma dessas marcas por probabilidade: registre somente a que estiver claramente escrita ou representada na imagem.',
          'Em pneus, procure separadamente: marca, modelo/desenho, medida (ex.: 165/70R14), índice de carga e velocidade (ex.: 85T), construção e especificações (XL, tubeless, radial). A medida nunca deve ser confundida com código, preço ou ruído visual.',
          'O campo brand deve conter apenas a marca/fabricante identificada. O campo supplier deve repetir a marca somente quando ela estiver visível; não invente fornecedor.',
          'O campo name deve ser uma descrição curta e útil, incluindo tipo de produto, marca, medida e modelo quando esses dados estiverem legíveis. Exemplo: Pneu HIFLY 165/70R14 85T. Não acrescente dados que não estejam visíveis.',
          'Extraia somente informações visíveis e legíveis. Se houver código de barras legível, retorne todos os dígitos exatamente.',
          'measure deve receber medida/modelo visível (por exemplo 205/55 R16, 1 litro ou 10 metros). unit deve ser uma unidade clara (UN, KG, L, M, CX); se não for possível identificar, retorne string vazia.',
          'Nunca estime preços, custo, preço de venda, quantidade em estoque ou estoque mínimo. Não use informações de outros produtos ao fundo para completar o produto principal.',
          'Retorne campos vazios quando a informação não estiver visível. Se a marca estiver ilegível, deixe brand vazio em vez de adivinhar.'
        ].join(' ');

    const responseSchema = isShopping
      ? {
          type: Type.OBJECT,
          properties: { name: { type: Type.STRING } },
          required: ['name']
        }
      : {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            sku: { type: Type.STRING },
            barcode: { type: Type.STRING },
            category: { type: Type.STRING },
            supplier: { type: Type.STRING },
            measure: { type: Type.STRING },
            unit: { type: Type.STRING },
            ncm: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ['name', 'brand', 'sku', 'barcode', 'category', 'supplier', 'measure', 'unit', 'ncm', 'notes']
        };

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    if (!response.text) {
      return res.status(422).json({
        error: isShopping
          ? 'Não consegui identificar o produto. Tente fotografar mais perto e com boa iluminação.'
          : 'Não foi possível identificar dados suficientes nesta foto. Tente outra imagem mais nítida.'
      });
    }

    const parsed = JSON.parse(response.text);

    if (isShopping) {
      const name = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 120) : '';
      if (!name) {
        return res.status(422).json({
          error: 'Não consegui reconhecer o produto com segurança. Tente outra foto.'
        });
      }
      return res.status(200).json({ product: { name } });
    }

    const limits = {
      name: 160, brand: 100, sku: 80, barcode: 100, category: 100,
      supplier: 160, measure: 120, unit: 30, ncm: 20, notes: 1000
    };
    const product = {};
    for (const [field, maxLength] of Object.entries(limits)) {
      const value = typeof parsed[field] === 'string' ? parsed[field].trim() : '';
      product[field] = value.slice(0, maxLength);
    }

    // A marca explícita tem prioridade sobre o campo genérico de fornecedor.
    if (!product.supplier && product.brand) product.supplier = product.brand;

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
