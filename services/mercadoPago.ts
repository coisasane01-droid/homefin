import { homefinApiUrl } from './nativeApi';
import { getFamilySessionToken } from './familyAuth';
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
  const sessionToken = familyId && familyId !== 'v1'
    ? await getFamilySessionToken(familyId)
    : null;

  if (!familyId || familyId === 'v1' || !sessionToken) {
    throw new Error('Sua sessão expirou. Entre novamente na família para continuar.');
  }

  const response = await fetch(homefinApiUrl('/api/payment'), {
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
