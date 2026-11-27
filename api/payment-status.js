import { handleCors } from './_cors.js';
import { validateFamilySession } from './_family-session.js';
import { fetchMercadoPagoPayment, activateApprovedPayment } from './_mercado-pago-activation.js';

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonError(res, 405, 'Método não permitido.');
  }

  const familyId = String(req.body?.familyId || '').trim();
  const paymentId = String(req.body?.paymentId || '').trim();
  if (!familyId || familyId === 'v1' || !paymentId || paymentId.length > 100) {
    return jsonError(res, 400, 'Família ou pagamento inválido.');
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) return jsonError(res, 401, 'Sessão inválida ou expirada.');
    const payment = await fetchMercadoPagoPayment(paymentId);
    const paymentFamily = String(payment.external_reference || payment.metadata?.family_id || '');
    if (paymentFamily !== familyId || String(payment.metadata?.family_id || familyId) !== familyId) {
      return jsonError(res, 403, 'Este pagamento não pertence a esta família.');
    }

    if (payment.status === 'approved') {
      const activation = await activateApprovedPayment(payment);
      return res.status(200).json({ ...activation, statusDetail: payment.status_detail });
    }

    return res.status(200).json({
      activated: false,
      status: String(payment.status || 'unknown'),
      statusDetail: String(payment.status_detail || ''),
    });
  } catch (error) {
    console.error('Falha ao verificar pagamento:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonError(res, 502, error instanceof Error ? error.message : 'Não foi possível verificar o pagamento.');
  }
}
