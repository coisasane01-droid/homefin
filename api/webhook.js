import crypto from 'crypto';

function getServerConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!supabaseUrl || !serviceKey || !accessToken) {
    throw new Error('Configuração server-side de pagamento incompleta.');
  }
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), serviceKey, accessToken };
}

function extractPaymentId(req) {
  const body = req.body || {};
  const query = req.query || {};
  const raw = body?.data?.id ?? body?.id ?? query['data.id'] ?? query.id;
  const id = String(raw || '').trim();
  return /^\d{1,30}$/.test(id) ? id : '';
}

async function activateApprovedPayment(payment, config) {
  if (payment.status !== 'approved') {
    return { activated: false, status: payment.status || 'unknown' };
  }

  const familyId = String(payment.external_reference || '').trim();
  const metadataFamilyId = String(payment.metadata?.family_id || '').trim();
  const planId = String(payment.metadata?.plan_id || '').trim();
  const amount = Number(payment.transaction_amount);
  const currency = String(payment.currency_id || '').toUpperCase();

  if (!familyId || familyId !== metadataFamilyId || !planId ||
      !Number.isFinite(amount) || amount <= 0 || currency !== 'BRL') {
    throw new Error('Pagamento aprovado sem referência, plano, valor ou moeda válidos.');
  }

  const rpcResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/homefin_confirm_mercado_pago_payment`,
    {
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
    }
  );

  const resultText = await rpcResponse.text();
  if (!rpcResponse.ok) {
    console.error('Falha ao registrar pagamento aprovado no Supabase:', {
      httpStatus: rpcResponse.status,
      response: resultText.slice(0, 500),
      paymentId: String(payment.id),
    });
    throw new Error('Não foi possível confirmar a assinatura no banco de dados.');
  }

  let result = null;
  try { result = resultText ? JSON.parse(resultText) : null; } catch { result = null; }
  return { activated: true, result };
}

export default async function handler(req, res) {
  if (!['POST', 'GET'].includes(req.method)) {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const paymentId = extractPaymentId(req);
  if (!paymentId) {
    // Outros eventos do Mercado Pago não precisam de processamento neste endpoint.
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const config = getServerConfig();
    console.log(`Recebido webhook de pagamento: ${paymentId}`);

    // Nunca confiar no status enviado pelo webhook: consultar a API oficial.
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' } }
    );

    const payment = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) {
      console.error('Não foi possível consultar pagamento no Mercado Pago:', {
        httpStatus: mpResponse.status,
        paymentId,
        message: payment?.message,
      });
      return res.status(502).json({ error: 'Não foi possível verificar o pagamento no Mercado Pago.' });
    }

    const outcome = await activateApprovedPayment(payment, config);
    console.log('Verificação de pagamento concluída:', {
      paymentId,
      status: payment.status,
      activated: outcome.activated,
    });

    return res.status(200).json({
      received: true,
      status: payment.status,
      activated: outcome.activated,
    });
  } catch (error) {
    console.error('Erro ao processar webhook do Mercado Pago:', error instanceof Error ? error.message : 'erro desconhecido');
    // 500 faz o Mercado Pago tentar entregar a notificação novamente.
    return res.status(500).json({ error: 'Não foi possível processar a confirmação do pagamento.' });
  }
}
