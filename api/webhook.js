import crypto from 'crypto';

function getServerConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!supabaseUrl || !serviceKey || !accessToken || !webhookSecret) {
    throw new Error('Configuração server-side de pagamento incompleta.');
  }
  return {
    supabaseUrl: supabaseUrl.replace(/\\/+$/, ''),
    serviceKey,
    accessToken,
    webhookSecret,
  };
}

function extractPaymentId(req) {
  const body = req.body || {};
  const query = req.query || {};
  const raw = body?.data?.id ?? body?.id ?? query['data.id'] ?? query.id;
  const id = String(raw || '').trim();
  return /^\\d{1,30}$/.test(id) ? id : '';
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || '');
}

// Valida a assinatura HMAC-SHA256 documentada pelo Mercado Pago.
// O ID usado no manifesto é o data.id da notificação, em minúsculas.
function isValidWebhookSignature(req, paymentId, secret) {
  const signatureHeader = getHeader(req, 'x-signature');
  const requestId = getHeader(req, 'x-request-id');
  if (!signatureHeader || !requestId || !paymentId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => {
      const separator = part.indexOf('=');
      if (separator < 0) return ['', ''];
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }).filter(([key, value]) => key && value)
  );

  const timestamp = parts.ts;
  const receivedSignature = parts.v1;
  if (!/^\\d+$/.test(timestamp || '') || !/^[a-f0-9]{64}$/i.test(receivedSignature || '')) {
    return false;
  }

  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest();
  const received = Buffer.from(receivedSignature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const paymentId = extractPaymentId(req);
  if (!paymentId) {
    // Outros eventos do Mercado Pago não precisam de processamento neste endpoint.
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const config = getServerConfig();

    if (!isValidWebhookSignature(req, paymentId, config.webhookSecret)) {
      console.warn('Webhook do Mercado Pago rejeitado: assinatura inválida.', { paymentId });
      return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
    }

    console.log(`Webhook assinado recebido do Mercado Pago: ${paymentId}`);

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
