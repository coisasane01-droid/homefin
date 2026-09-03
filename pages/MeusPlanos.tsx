import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saasDb, Family, Plan, PaymentConfig } from '../services/saasDb';
import { CheckCircle2, AlertTriangle, CreditCard, QrCode, Copy, Shield, X, Loader2, Info } from 'lucide-react';
import { createPixPayment, createCardPayment, MercadoPagoPaymentResponse } from '../services/mercadoPago';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

const MeusPlanos: React.FC = () => {
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [loading, setLoading] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Mercado Pago State
  const [mercadoPagoPayment, setMercadoPagoPayment] = useState<MercadoPagoPaymentResponse | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);

  useEffect(() => {
    const familyId = localStorage.getItem('homefin_current_family_id');
    if (!familyId) {
      navigate('/login');
      return;
    }

    const families = saasDb.getFamilies();
    const foundFamily = families.find(f => f.id === familyId);
    
    if (foundFamily) {
      setFamily(foundFamily);
      
      const plans = saasDb.getPlans();
      const plan = plans.find(p => p.id === foundFamily.plan);
      setCurrentPlan(plan || null);

      if (foundFamily.expiresAt) {
        const today = new Date();
        const expiry = new Date(foundFamily.expiresAt);
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays);
      }
    }

    const config = saasDb.getPaymentConfig();
    setPaymentConfig(config);

    if (config?.mercadoPagoPublicKey) {
      initMercadoPago(config.mercadoPagoPublicKey, { locale: 'pt-BR' });
    }
  }, [navigate]);

  const handleRenew = () => {
    setMercadoPagoPayment(null); // Reset previous payment
    setIsCheckoutOpen(true);
  };

  const handleGeneratePix = async () => {
    if (!currentPlan || !paymentConfig?.mercadoPagoAccessToken) return;

    setIsGeneratingPix(true);
    try {
      const payment = await createPixPayment(
        Number(currentPlan.price.toFixed(2)),
        `Renovação ${currentPlan.name}`,
        'user@example.com', // In a real app, ask for email
        paymentConfig.mercadoPagoAccessToken
      );
      setMercadoPagoPayment(payment);
    } catch (error) {
      alert('Erro ao gerar PIX. Tente novamente.');
      console.error(error);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleConfirmPayment = () => {
    setLoading(true);
    setTimeout(() => {
      // Simulate renewal logic
      if (family) {
        // Update expiration to +30 days (or whatever period)
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        
        saasDb.updateFamily(family.id, { 
            expiresAt: newExpiry.toISOString(),
            status: 'active'
        });
        
        alert('Pagamento confirmado! Seu plano foi renovado.');
        setLoading(false);
        setIsCheckoutOpen(false);
        // Refresh page or update state to reflect new expiry
        window.location.reload();
      }
    }, 2000);
  };

  const onCardPaymentSubmit = async (formData: any) => {
    if (!currentPlan || !paymentConfig?.mercadoPagoAccessToken) return;
    
    setLoading(true);
    try {
      const payment = await createCardPayment(
        Number(currentPlan.price.toFixed(2)),
        `Renovação ${currentPlan.name}`,
        formData.payer.email,
        formData.token,
        formData.installments,
        formData.payment_method_id,
        formData.issuer_id,
        paymentConfig.mercadoPagoAccessToken
      );

      if (payment.status === 'approved') {
        handleConfirmPayment();
      } else {
        alert(`Pagamento não aprovado: ${payment.status_detail}`);
      }
    } catch (error) {
      alert('Erro ao processar pagamento com cartão. Verifique os dados e tente novamente.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Código PIX copiado!');
  };

  if (!family || !currentPlan) {
    return <div className="p-8 text-center">Carregando informações do plano...</div>;
  }

  // If plan is free, we might redirect or show simple info
  // But the requirement says "se o plano for 100% free não precisa aparecer pagina planos"
  // This page is "Meus Planos" (My Plan), so if they access it, they should see info.
  // The hiding logic will be in the Sidebar.

  const isExpiring = daysRemaining !== null && daysRemaining <= 7;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Meu Plano</h1>
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors"
          title="Como funciona o Meu Plano?"
        >
          <Info size={18} />
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{currentPlan.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {family.plan === 'free' ? 'Plano Gratuito' : `R$ ${currentPlan.price.toFixed(2)} / mês`}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              family.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {family.status === 'active' ? 'Ativo' : 'Inativo'}
            </div>
          </div>

          {family.plan !== 'free' && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vencimento:</span>
                <span className={`text-sm font-bold ${isExpiring || isExpired ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {family.expiresAt ? new Date(family.expiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>
              
              {isExpired ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-700">
                  <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-bold">Seu plano expirou!</p>
                    <p className="text-sm">Renove agora para continuar aproveitando todos os benefícios.</p>
                  </div>
                </div>
              ) : isExpiring ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-700">
                  <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-bold">Seu plano vence em {daysRemaining} dias!</p>
                    <p className="text-sm">Evite interrupções renovando seu plano antecipadamente.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 text-green-700">
                  <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-bold">Tudo certo com sua assinatura!</p>
                    <p className="text-sm">Próxima cobrança apenas em {family.expiresAt ? new Date(family.expiresAt).toLocaleDateString('pt-BR') : ''}.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {family.plan !== 'free' && (
            <button
              onClick={handleRenew}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto"
            >
              {isExpired ? 'Renovar Agora' : 'Antecipar Renovação'}
            </button>
          )}
          
          {family.plan === 'free' && (
             <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg text-center">
                <p className="text-gray-600 dark:text-gray-300">Você está utilizando o plano gratuito.</p>
             </div>
          )}
        </div>
      </div>

      {/* Checkout Modal for Renewal */}
      {isCheckoutOpen && currentPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <X size={24} />
            </button>

            <div className="bg-indigo-600 p-4 text-white text-center">
              <h3 className="text-lg font-bold mb-1">Renovação de Plano</h3>
              <p className="text-indigo-200 text-xs">Renove sua assinatura do {currentPlan.name}</p>
            </div>

            <div className="p-4">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Valor da Renovação</p>
                  <p className="text-2xl font-bold text-gray-900">R$ {currentPlan.price.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Plano</p>
                  <p className="font-medium text-indigo-600 text-sm">{currentPlan.name}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === 'pix' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <QrCode size={20} className="mb-1" />
                    <span className="text-xs font-bold">PIX</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === 'card' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <CreditCard size={20} className="mb-1" />
                    <span className="text-xs font-bold">Cartão</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'pix' ? (
                <div className="bg-gray-50 p-3 rounded-xl text-center mb-4 border border-gray-200">
                  {paymentConfig?.mercadoPagoAccessToken ? (
                    // Mercado Pago Flow
                    <>
                      {!mercadoPagoPayment ? (
                        <div className="py-4">
                          <p className="text-sm text-gray-600 mb-4">Gere um QR Code único para pagamento instantâneo.</p>
                          <button 
                            onClick={handleGeneratePix}
                            disabled={isGeneratingPix}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 mx-auto disabled:opacity-70"
                          >
                            {isGeneratingPix ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
                            Gerar PIX
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-40 h-40 bg-white mx-auto mb-3 p-2 rounded border shadow-sm flex items-center justify-center overflow-hidden">
                            {mercadoPagoPayment.point_of_interaction?.transaction_data?.qr_code_base64 ? (
                              <img 
                                src={`data:image/png;base64,${mercadoPagoPayment.point_of_interaction.transaction_data.qr_code_base64}`} 
                                alt="QR Code PIX" 
                                className="w-full h-full object-contain" 
                              />
                            ) : (
                              <div className="text-xs text-red-500">Erro na imagem</div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-2 font-medium">Escaneie o QR Code acima</p>
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => handleCopyPix(mercadoPagoPayment.point_of_interaction?.transaction_data?.qr_code || '')}
                              className="text-indigo-600 text-xs font-bold hover:underline flex items-center justify-center gap-1 mx-auto bg-indigo-50 px-3 py-2 rounded-lg w-full"
                            >
                              <Copy size={12} /> Copiar Código PIX
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    // Static Flow
                    <>
                      <div className="w-24 h-24 bg-white mx-auto mb-2 p-2 rounded border shadow-sm flex items-center justify-center overflow-hidden">
                        {paymentConfig?.pixQrCodeUrl ? (
                          <img src={paymentConfig.pixQrCodeUrl} alt="QR Code PIX" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white text-[10px]">QR CODE</div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">Escaneie o QR Code para pagar</p>
                      <button 
                        onClick={() => handleCopyPix(paymentConfig?.pixKey || '')}
                        className="text-indigo-600 text-xs font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                      >
                        <Copy size={12} /> Copiar chave PIX
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  {paymentConfig?.mercadoPagoPublicKey ? (
                    <div className="mercado-pago-brick">
                      <CardPayment
                        initialization={{
                          amount: currentPlan.price,
                          payer: {
                            email: 'user@example.com',
                          },
                        }}
                        onSubmit={onCardPaymentSubmit}
                        customization={{
                          visual: {
                            style: {
                              theme: 'flat',
                            },
                          },
                          paymentMethods: {
                            maxInstallments: 1,
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-700 text-xs text-center">
                      Configuração do Mercado Pago incompleta (Chave Pública ausente).
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'pix' && (
                <button 
                  onClick={handleConfirmPayment}
                  disabled={loading || (paymentMethod === 'pix' && paymentConfig?.mercadoPagoAccessToken && !mercadoPagoPayment)}
                  className={`w-full py-3 rounded-xl font-bold text-base transition-colors shadow-lg flex items-center justify-center gap-2 ${
                    loading || (paymentMethod === 'pix' && paymentConfig?.mercadoPagoAccessToken && !mercadoPagoPayment)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-green-500/30'
                  }`}
                >
                  {loading ? (
                    <>Processando...</>
                  ) : (
                    <>Confirmar Renovação <CheckCircle2 size={18} /></>
                  )}
                </button>
              )}
              <p className="text-center text-[10px] text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Shield size={10} /> Pagamento 100% Seguro
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona o Meu Plano?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <p>
                A página <strong>Meu Plano</strong> é onde você gerencia a assinatura do seu aplicativo.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Shield size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Status da Assinatura:</strong>
                    <p className="mt-1 opacity-90">
                      Veja qual é o seu plano atual, se ele está ativo e quantos dias faltam para o vencimento.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Renovação e Pagamento:</strong>
                    <p className="mt-1 opacity-90">
                      Quando seu plano estiver próximo do vencimento, você pode renová-lo diretamente por aqui, pagando com PIX ou Cartão de Crédito de forma segura.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Benefícios:</strong>
                    <p className="mt-1 opacity-90">
                      Confira todos os recursos que estão liberados na sua conta de acordo com o plano contratado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeusPlanos;
