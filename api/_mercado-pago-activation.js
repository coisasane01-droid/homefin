import crypto from 'crypto';

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : 0;
}

export async function fetchMercadoPagoPayment(paymentId) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.');

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Falha ao consultar pagamento no Mercado Pago (HTTP ${response.status}).`);
  }
  return payment;
}

export function verifyMercadoPagoWebhook(req, paymentId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature = String(req.headers?.['x-signature'] || '');
  const requestId = String(req.headers?.['x-request-id'] || '');
  const ts = signature.match(/(?:^|,)\s*ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)\s*v1=([^,]+)/)?.[1];
  if (!ts || !v1 || !requestId || !paymentId) return false;

  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const suppliedBuffer = Buffer.from(v1, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function activateApprovedPayment(payment) {
  if (!payment || String(payment.status) !== 'approved') {
    return { activated: false, status: String(payment?.status || 'unknown') };
  }

  const familyId = String(payment.external_reference || payment.metadata?.family_id || '').trim();
  const planId = String(payment.metadata?.plan_id || '').trim();
  const paymentId = String(payment.id || '').trim();
  const currency = String(payment.currency_id || 'BRL');
  const gross = amount(payment.transaction_amount);
  if (!paymentId || !familyId || familyId === 'v1' || !planId || !gross || currency !== 'BRL' ||
      (payment.metadata?.family_id && String(payment.metadata.family_id) !== familyId)) {
    throw new Error('Pagamento aprovado sem identificação válida de família, plano ou valor.');
  }

  const feeDetails = Array.isArray(payment.fee_details)
    ? payment.fee_details.map(item => ({
        type: String(item?.type || ''),
        amount: amount(item?.amount),
        fee_payer: String(item?.fee_payer || ''),
      }))
    : [];
  const reportedNetRaw = payment.transaction_details?.net_received_amount;
  const reportedNet = Number(reportedNetRaw);
  const hasReportedNet = reportedNetRaw !== null && reportedNetRaw !== undefined &&
    Number.isFinite(reportedNet) && reportedNet >= 0;
  const reportedFee = amount(feeDetails.reduce((sum, item) => sum + item.amount, 0));
  const fee = feeDetails.length
    ? reportedFee
    : hasReportedNet
      ? amount(Math.max(0, gross - reportedNet))
      : 0;
  const net = hasReportedNet
    ? amount(reportedNet)
    : amount(Math.max(0, gross - fee));

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Configuração segura do Supabase indisponível.');

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/homefin_activate_paid_plan`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_payment_id: paymentId,
      p_family_id: familyId,
      p_plan_id: planId,
      p_amount: gross,
      p_currency: currency,
    }),
  });
  const rpcResult = await rpcResponse.json().catch(() => ({}));
  if (!rpcResponse.ok) {
    console.error('Falha na ativação segura do plano:', { status: rpcResponse.status, message: rpcResult?.message });
    throw new Error('O pagamento foi aprovado, mas não foi possível ativar o plano no banco.');
  }

  const updateUrl = new URL(`${supabaseUrl}/rest/v1/homefin_payments`);
  updateUrl.searchParams.set('payment_id', `eq.${paymentId}`);
  const patchResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      fee_amount: fee,
      net_amount: net,
      payment_method: String(payment.payment_method_id || ''),
      provider_status: String(payment.status || ''),
      provider_status_detail: String(payment.status_detail || ''),
      provider_fee_details: feeDetails,
      approved_at: payment.date_approved || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!patchResponse.ok) {
    console.error('Plano ativado, mas falhou ao registrar detalhamento financeiro:', patchResponse.status);
    throw new Error('Plano ativado, mas o detalhamento da taxa não foi salvo. Verifique a migração de pagamentos.');
  }

  return {
    activated: true,
    alreadyProcessed: Boolean(rpcResult?.already_processed),
    familyId,
    planId,
    grossAmount: gross,
    feeAmount: fee,
    netAmount: net,
    status: 'approved',
  };
}
