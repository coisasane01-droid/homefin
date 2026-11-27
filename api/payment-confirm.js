import { handleCors } from './_cors.js';
import { validateFamilySession } from './_family-session.js';

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!supabaseUrl || !serviceKey || !accessToken) throw new Error('Configuração server-side incompleta.');
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), serviceKey, accessToken };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const body = req.body || {};
  const familyId = typeof body.familyId === 'string' ? body.familyId.trim() : '';
  const paymentId = String(body.paymentId || '').trim();
  if (!familyId || familyId === 'v1' || !/^\d{1,30}$/.test(paymentId)) {
    return res.status(400).json({ error: 'Família ou pagamento inválido.' });
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) return res.status(401).json({ error: 'Sessão familiar inválida ou expirada.' });

    const config = getConfig();
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' } }
    );
    const payment = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) {
      console.error('Falha ao consultar pagamento para confirmação manual:', mpResponse.status);
      return res.status(502).json({ error: 'Não foi possível consultar o pagamento no Mercado Pago.' });
    }

    if (String(payment.external_reference || '') !== familyId ||
        String(payment.metadata?.family_id || '') !== familyId) {
      return res.status(403).json({ error: 'Este pagamento não pertence a esta família.' });
    }

    if (payment.status !== 'approved') {
      return res.status(200).json({ approved: false, status: payment.status || 'unknown' });
    }

    const planId = String(payment.metadata?.plan_id || '').trim();
    const amount = Number(payment.transaction_amount);
    if (!planId || !Number.isFinite(amount) || amount <= 0 ||
        String(payment.currency_id || '').toUpperCase() !== 'BRL') {
      return res.status(400).json({ error: 'Dados do pagamento aprovado são inválidos.' });
    }

    const rpc = await fetch(`${config.supabaseUrl}/rest/v1/rpc/homefin_confirm_mercado_pago_payment`, {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        p_payment_id: String(payment.id),
        p_family_id: familyId,
        p_plan_id: planId,
        p_amount: amount,
      }),
    });
    const rpcText = await rpc.text();
    if (!rpc.ok) {
      console.error('Falha ao ativar assinatura após confirmação manual:', {
        status: rpc.status,
        response: rpcText.slice(0, 500),
      });
      return res.status(503).json({ error: 'Pagamento aprovado, mas não foi possível atualizar a assinatura. Tente novamente.' });
    }

    return res.status(200).json({ approved: true, status: 'approved', activation: rpcText ? JSON.parse(rpcText) : null });
  } catch (error) {
    console.error('Erro na confirmação de pagamento:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível confirmar o pagamento agora.' });
  }
}
