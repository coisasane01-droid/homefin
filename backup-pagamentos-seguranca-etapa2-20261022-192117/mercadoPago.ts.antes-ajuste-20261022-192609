import { PaymentConfig } from './saasDb';

export interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code: string;
      qr_code_base64: string;
      ticket_url: string;
    };
  };
}

export const createPixPayment = async (
  amount: number,
  description: string,
  email: string,
  accessToken: string
): Promise<MercadoPagoPaymentResponse> => {
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: email,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao criar pagamento no Mercado Pago');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro Mercado Pago:', error);
    throw error;
  }
};

export const createCardPayment = async (
  amount: number,
  description: string,
  email: string,
  token: string,
  installments: number,
  paymentMethodId: string,
  issuerId: string,
  accessToken: string
): Promise<MercadoPagoPaymentResponse> => {
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: paymentMethodId,
        token: token,
        installments: installments,
        issuer_id: issuerId,
        payer: {
          email: email,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao processar pagamento com cartão');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro Mercado Pago Card:', error);
    throw error;
  }
};

export const checkPaymentStatus = async (
  paymentId: number,
  accessToken: string
): Promise<string> => {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao verificar status do pagamento');
    }

    const data = await response.json();
    return data.status; // approved, pending, etc.
  } catch (error) {
    console.error('Erro Status Mercado Pago:', error);
    return 'unknown';
  }
};
