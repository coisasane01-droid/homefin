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

async function requestPayment(payload: Record<string, unknown>): Promise<MercadoPagoPaymentResponse> {
  const familyId = localStorage.getItem('homefin_current_family_id') || '';
  const tokenKey = `homefin_family_session_token_${familyId}`;
  const expiryKey = `homefin_family_session_expires_at_${familyId}`;
  const sessionToken = localStorage.getItem(tokenKey) || '';
  const expiresAt = Number(localStorage.getItem(expiryKey) || 0);

  if (!familyId || familyId === 'v1' || !sessionToken || !expiresAt || expiresAt <= Date.now()) {
    throw new Error('Sua sessão expirou. Entre novamente na família para continuar.');
  }

  const response = await fetch('/api/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ ...payload, familyId })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'Não foi possível iniciar o pagamento.'
    );
  }

  return result as MercadoPagoPaymentResponse;
}

export const createPixPayment = async (
  email: string,
  planId: string
): Promise<MercadoPagoPaymentResponse> => {
  return requestPayment({
    paymentMethod: 'pix',
    email,
    planId
  });
};

export const createCardPayment = async (
  email: string,
  token: string,
  installments: number,
  paymentMethodId: string,
  planId: string,
  issuerId?: string
): Promise<MercadoPagoPaymentResponse> => {
  return requestPayment({
    paymentMethod: 'card',
    email,
    token,
    installments,
    paymentMethodId,
    planId,
    issuerId
  });
};
