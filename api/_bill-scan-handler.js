import { validateFamilySession } from './_family-session.js';

const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function cleanText(value, max = 180) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

export default async function billScanHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const familyId = String(req.body?.familyId || '').trim();
    const mimeType = String(req.body?.mimeType || '').toLowerCase();
    const imageBase64 = String(req.body?.imageBase64 || '');

    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(familyId)) {
      return res.status(400).json({ success: false, error: 'Família inválida.' });
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType) || !imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return res.status(400).json({ success: false, error: 'Imagem inválida ou muito grande. Tire outra foto com melhor enquadramento.' });
    }

    const session = await validateFamilySession(req, familyId);
    if (!session.valid) {
      return res.status(401).json({ success: false, error: session.error || 'Sessão familiar inválida.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: 'Leitura por IA não configurada no servidor.' });
    }

    const prompt = `Leia a imagem de uma conta, boleto, nota fiscal ou comprovante financeiro brasileiro e extraia somente informações que estejam claramente visíveis. Não invente dados. Responda em JSON. Campos: description (nome curto da conta/estabelecimento/serviço), amount (valor total da cobrança, número decimal), dueDate (vencimento em YYYY-MM-DD; se não houver vencimento, use a data da compra/emissão somente quando estiver claramente indicada), category (fixed para despesas recorrentes como aluguel/condomínio/água/luz; tax para tributos; card para fatura/cartão; variable para demais compras e serviços), subCategory (beneficiário, estabelecimento ou detalhe útil), subCategoryAmount (valor parcial/linha destacada se houver, senão null), paidAmount (valor já pago se comprovante mostrar pagamento, senão null), paidBy (nome de quem pagou se visível, senão vazio), notes (número do documento ou informação útil curta). Para qualquer campo não identificado, retorne null ou string vazia. Nunca confunda valor pago com valor total da cobrança.`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                description: { type: 'STRING', nullable: true },
                amount: { type: 'NUMBER', nullable: true },
                dueDate: { type: 'STRING', nullable: true },
                category: { type: 'STRING', enum: ['fixed', 'variable', 'card', 'tax'], nullable: true },
                subCategory: { type: 'STRING', nullable: true },
                subCategoryAmount: { type: 'NUMBER', nullable: true },
                paidAmount: { type: 'NUMBER', nullable: true },
                paidBy: { type: 'STRING', nullable: true },
                notes: { type: 'STRING', nullable: true }
              }
            }
          }
        })
      }
    );

    const aiPayload = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error('Falha na API Gemini para leitura de conta:', aiPayload?.error?.message || aiResponse.status);
      return res.status(502).json({ success: false, error: 'A IA não conseguiu analisar a imagem. Tente novamente.' });
    }

    const rawText = aiPayload?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();
    if (!rawText) {
      return res.status(422).json({ success: false, error: 'Não encontrei dados legíveis nessa imagem.' });
    }

    let extracted;
    try {
      extracted = JSON.parse(rawText);
    } catch {
      return res.status(422).json({ success: false, error: 'A leitura da imagem não retornou dados válidos. Tente outra foto.' });
    }

    const dueDate = typeof extracted.dueDate === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(extracted.dueDate)
      ? extracted.dueDate
      : '';
    const category = ['fixed', 'variable', 'card', 'tax'].includes(extracted.category)
      ? extracted.category
      : '';

    return res.status(200).json({
      success: true,
      data: {
        description: cleanText(extracted.description),
        amount: cleanAmount(extracted.amount),
        dueDate,
        category,
        subCategory: cleanText(extracted.subCategory, 120),
        subCategoryAmount: cleanAmount(extracted.subCategoryAmount),
        paidAmount: cleanAmount(extracted.paidAmount),
        paidBy: cleanText(extracted.paidBy, 100),
        notes: cleanText(extracted.notes, 500)
      }
    });
  } catch (error) {
    console.error('Erro no endpoint de leitura de conta:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(500).json({ success: false, error: 'Não foi possível processar a imagem agora.' });
  }
}
