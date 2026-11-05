import crypto from 'crypto';
import { validateFamilySession } from './_family-session.js';

async function getConfiguredPlan(planId) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Configuração do servidor incompleta.');
  }

  const url = new URL('/rest/v1/homefin_saas', supabaseUrl);
  url.searchParams.set('select', 'data');
  url.searchParams.set('id', 'eq.global');

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar configuração SaaS: HTTP ${response.status}`);
  }

  const rows = await response.json();
  const plans = rows?.[0]?.data?.plans;
  if (!Array.isArray(plans)) {
    throw new Error('Lista de planos não encontrada na configuração SaaS.');
  }

  const plan = plans.find(item => item && item.id === planId);
  if (!plan || typeof plan.name !== 'string') return null;

  const price = Number(plan.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  return { id: plan.id, name: plan.name, price };
}

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonError(res, 405, 'Método não permitido.');
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return jsonError(res, 503, 'Pagamento indisponível: integração do servidor não configurada.');
  }

  const body = req.body || {};
  const familyId = typeof body.familyId === 'string' ? body.familyId.trim() : '';
  const method = body.paymentMethod;
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!familyId || familyId === 'v1') {
    return jsonError(res, 400, 'Família inválida para pagamento.');
  }

  let session;
  try {
    session = await validateFamilySession(req, familyId);
  } catch (error) {
    console.error('Falha ao validar sessão de pagamento:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonError(res, 503, 'Não foi possível validar a sessão familiar. Tente novamente.');
  }
  if (!session.valid) {
    return jsonError(res, 401, 'Sessão inválida ou expirada. Entre novamente.');
  }

  if (!['pix', 'card'].includes(method)) {
    return jsonError(res, 400, 'Forma de pagamento inválida.');
  }

  if (!planId || planId === 'free' || planId.length > 100) {
    return jsonError(res, 400, 'Plano inválido para pagamento.');
  }

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(res, 400, 'Informe um e-mail válido para o pagamento.');
  }

  // O preço oficial é consultado no servidor, na configuração global do SuperAdmin.
  let plan;
  try {
    plan = await getConfiguredPlan(planId);
  } catch (error) {
    console.error('Não foi possível consultar o plano configurado:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonError(res, 503, 'Não foi possível validar o preço do plano. Tente novamente.');
  }

  if (!plan) {
    return jsonError(res, 400, 'Plano não encontrado ou sem preço válido no SuperAdmin.');
  }

  const paymentBody = {
    transaction_amount: plan.price,
    description: `Assinatura HomeFin ${plan.name}`,
    payment_method_id: method === 'pix' ? 'pix' : body.paymentMethodId,
    payer: { email },
    external_reference: familyId,
    metadata: {
      family_id: familyId,
      plan_id: plan.id,
      plan_name: plan.name
    }
  };

  if (method === 'card') {
    const token = typeof body.token === 'string' ? body.token : '';
    const installments = Number(body.installments);
    const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId : '';
    const issuerId = body.issuerId == null ? undefined : String(body.issuerId);

    if (!token || token.length > 4096 || !paymentMethodId ||
        !Number.isInteger(installments) || installments < 1 || installments > 24) {
      return jsonError(res, 400, 'Dados do cartão incompletos ou inválidos.');
    }

    paymentBody.token = token;
    paymentBody.installments = installments;
    paymentBody.payment_method_id = paymentMethodId;
    if (issuerId) paymentBody.issuer_id = issuerId;
  }

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(paymentBody)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Falha ao criar pagamento no Mercado Pago:', response.status);
      return jsonError(res, 502, 'O Mercado Pago não conseguiu criar o pagamento. Confira os dados e tente novamente.');
    }

    // Não libera nem altera o plano aqui. A aprovação precisa ser verificada
    // de forma independente antes de conceder qualquer assinatura.
    return res.status(200).json({
      id: result.id,
      status: result.status,
      status_detail: result.status_detail,
      point_of_interaction: result.point_of_interaction
    });
  } catch (error) {
    console.error('Erro de comunicação com o Mercado Pago:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonError(res, 502, 'Não foi possível comunicar com o Mercado Pago.');
  }
}
