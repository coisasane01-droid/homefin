import { homefinApiUrl } from './nativeApi';
import { getFamilySessionToken } from './familyAuth';
export interface MercadoPagoPaymentStatusResponse {\n  activated: boolean;\n  status: string;\n  statusDetail?: string;\n  grossAmount?: number;\n  feeAmount?: number;\n  netAmount?: number;\n}\n\nexport interface MercadoPagoPaymentResponse {
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

export const checkMercadoPagoPayment = async (paymentId: number | string): Promise<MercadoPagoPaymentStatusResponse> => {\n  const familyId = localStorage.getItem('homefin_current_family_id') || '';\n  const sessionToken = familyId && familyId !== 'v1' ? await getFamilySessionToken(familyId) : null;\n  if (!familyId || familyId === 'v1' || !sessionToken) throw new Error('Sua sessão expirou. Entre novamente na família.');\n\n  const response = await fetch(homefinApiUrl('/api/payment-status'), {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },\n    body: JSON.stringify({ familyId, paymentId: String(paymentId) }),\n  });\n  const result = await response.json().catch(() => ({}));\n  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Não foi possível consultar o pagamento.');\n  return result as MercadoPagoPaymentStatusResponse;\n};\n\nexport const createPixPayment = async (
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
