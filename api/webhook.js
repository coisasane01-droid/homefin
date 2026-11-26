import { fetchMercadoPagoPayment, verifyMercadoPagoWebhook, activateApprovedPayment } from './_mercado-pago-activation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const type = String(req.body?.type || req.query?.type || '');
  const paymentId = String(req.body?.data?.id || req.query?.['data.id'] || req.query?.id || '').trim();
  if (type !== 'payment' || !paymentId) {
    return res.status(200).json({ received: true, ignored: true });
  }

  if (!process.env.MERCADO_PAGO_WEBHOOK_SECRET) {
    console.error('Webhook Mercado Pago sem MERCADO_PAGO_WEBHOOK_SECRET configurado.');
    return res.status(503).json({ received: false, error: 'Webhook não configurado.' });
  }
  if (!verifyMercadoPagoWebhook(req, paymentId)) {
    return res.status(401).json({ received: false, error: 'Assinatura do webhook inválida.' });
  }

  try {
    const payment = await fetchMercadoPagoPayment(paymentId);
    if (payment.status === 'approved') {
      await activateApprovedPayment(payment);
    }
    return res.status(200).json({ received: true, status: payment.status });
  } catch (error) {
    console.error('Erro ao processar webhook do Mercado Pago:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(500).json({ received: false });
  }
}
