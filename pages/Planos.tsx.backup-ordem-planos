import { showNotification } from '../services/utils/notifications';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Star, Shield, Zap, X, CreditCard, QrCode, ArrowLeft, Copy, Tag, Loader2 } from 'lucide-react';
import { saasDb, Plan, PaymentConfig } from '../services/saasDb';
import { createPixPayment, createCardPayment, MercadoPagoPaymentResponse } from '../services/mercadoPago';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

const Planos: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [loading, setLoading] = useState(false);
  
  // Mercado Pago State
  const [mercadoPagoPayment, setMercadoPagoPayment] = useState<MercadoPagoPaymentResponse | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  
  // Discount Code State
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number | null>(null);
  const [discountMessage, setDiscountMessage] = useState('');

  useEffect(() => {
    const config = saasDb.getPaymentConfig();
    setPlans(saasDb.getPlans());
    setPaymentConfig(config);

    if (config?.mercadoPagoPublicKey) {
      initMercadoPago(config.mercadoPagoPublicKey, { locale: 'pt-BR' });
    }
    
    // Check for code passed from Landing Page
    if (location.state?.code && location.state?.discountPercent) {
      setDiscountCode(location.state.code);
      setAppliedDiscount(location.state.discountPercent);
      setDiscountMessage(`Desconto de ${location.state.discountPercent}% aplicado!`);
    }
  }, [location.state]);

  const handleSelectPlan = (plan: Plan) => {
    if (plan.price === 0) {
      // Free flow
      navigate('/setup', { state: { plan: 'free' } });
    } else {
      // Open checkout modal
      setSelectedPlan(plan);
      setMercadoPagoPayment(null); // Reset previous payment
      setIsCheckoutOpen(true);
    }
  };

  const handleApplyDiscount = () => {
    if (!discountCode) return;
    
    const validation = saasDb.validateCode(discountCode);
    if (validation.valid && validation.discountPercent !== undefined) {
      setAppliedDiscount(validation.discountPercent);
      setDiscountMessage(`Desconto de ${validation.discountPercent}% aplicado!`);
    } else {
      setAppliedDiscount(null);
      setDiscountMessage(validation.message || 'Código inválido ou sem desconto.');
    }
  };

  const handleGeneratePix = async () => {
    if (!selectedPlan || !paymentConfig?.mercadoPagoAccessToken) return;

    setIsGeneratingPix(true);
    try {
      const price = appliedDiscount 
        ? selectedPlan.price * (1 - appliedDiscount / 100)
        : selectedPlan.price;

      const payment = await createPixPayment(
        Number(price.toFixed(2)),
        `Assinatura ${selectedPlan.name}`,
        'user@example.com', // In a real app, ask for email
        paymentConfig.mercadoPagoAccessToken
      );
      setMercadoPagoPayment(payment);
    } catch (error) {
      showNotification('Erro ao gerar PIX. Tente novamente.', 'error');
      console.error(error);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleConfirmPayment = () => {
    setLoading(true);
    // Simulate processing delay
    setTimeout(() => {
      setLoading(false);
      setIsCheckoutOpen(false);
      navigate('/setup', { 
        state: { 
          plan: 'premium', 
          paid: true,
          code: appliedDiscount ? discountCode : undefined
        } 
      });
    }, 2000);
  };

  const onCardPaymentSubmit = async (formData: any) => {
    if (!selectedPlan || !paymentConfig?.mercadoPagoAccessToken) return;
    
    setLoading(true);
    try {
      const price = appliedDiscount 
        ? selectedPlan.price * (1 - appliedDiscount / 100)
        : selectedPlan.price;

      const payment = await createCardPayment(
        Number(price.toFixed(2)),
        `Assinatura ${selectedPlan.name}`,
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
        showNotification(`Pagamento não aprovado: ${payment.status_detail}`, 'error');
      }
    } catch (error) {
      showNotification('Erro ao processar pagamento com cartão. Verifique os dados e tente novamente.', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Código PIX copiado!', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-20 px-4 relative">
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors"
        title="Voltar para Início"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Escolha o plano ideal para sua família</h2>
        <p className="text-xl text-gray-500 mb-16">Comece a organizar suas finanças hoje mesmo.</p>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative bg-white rounded-3xl shadow-xl overflow-hidden border-2 transition-transform hover:scale-105 ${plan.popular ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-transparent'}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider z-10">
                  Mais Popular
                </div>
              )}
              
              {plan.image && (
                <div className="h-48 w-full overflow-hidden">
                  <img src={plan.image} alt={plan.name} className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" />
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-6">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-4 mb-8 text-left">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className={`w-5 h-5 ${plan.popular ? 'text-indigo-500' : 'text-gray-400'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    plan.popular 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30' 
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left max-w-4xl mx-auto">
          <div className="flex gap-4">
            <div className="bg-green-100 p-3 rounded-xl h-fit text-green-600"><Shield /></div>
            <div>
              <h4 className="font-bold text-gray-900">Seguro e Privado</h4>
              <p className="text-sm text-gray-500">Seus dados são criptografados e armazenados localmente no seu dispositivo.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-amber-100 p-3 rounded-xl h-fit text-amber-600"><Star /></div>
            <div>
              <h4 className="font-bold text-gray-900">Sem Compromisso</h4>
              <p className="text-sm text-gray-500">Cancele a qualquer momento. Sem taxas escondidas.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-blue-100 p-3 rounded-xl h-fit text-blue-600"><Zap /></div>
            <div>
              <h4 className="font-bold text-gray-900">Configuração Rápida</h4>
              <p className="text-sm text-gray-500">Comece a usar em menos de 2 minutos.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <X size={24} />
            </button>

            <div className="bg-indigo-600 p-4 text-white text-center">
              <h3 className="text-lg font-bold mb-1">Checkout Seguro</h3>
              <p className="text-indigo-200 text-xs">Finalize sua assinatura do {selectedPlan.name}</p>
            </div>

            <div className="p-4">
              {/* Discount Code Input */}
              <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Tag size={12} /> Cupom de Desconto
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO"
                    className="flex-1 p-2 border rounded-lg text-sm uppercase font-mono"
                  />
                  <button 
                    onClick={handleApplyDiscount}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700"
                  >
                    Aplicar
                  </button>
                </div>
                {discountMessage && (
                  <p className={`text-xs mt-2 ${appliedDiscount ? 'text-green-600 font-bold' : 'text-red-500'}`}>
                    {discountMessage}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Total a pagar</p>
                  <div className="flex items-baseline gap-2">
                    {appliedDiscount ? (
                      <>
                        <span className="text-sm text-gray-400 line-through">R$ {selectedPlan.price.toFixed(2).replace('.', ',')}</span>
                        <span className="text-2xl font-bold text-green-600">
                          R$ {(selectedPlan.price * (1 - appliedDiscount / 100)).toFixed(2).replace('.', ',')}
                        </span>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900">R$ {selectedPlan.price.toFixed(2).replace('.', ',')}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Plano</p>
                  <p className="font-medium text-indigo-600 text-sm">{selectedPlan.name}</p>
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
                          amount: appliedDiscount 
                            ? selectedPlan.price * (1 - appliedDiscount / 100)
                            : selectedPlan.price,
                          payer: {
                            email: 'user@example.com', // Idealmente pegar do input ou perfil
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
                    <>
                      {appliedDiscount === 100 ? 'Confirmar (Grátis)' : 'Confirmar Pagamento'} 
                      <CheckCircle2 size={18} />
                    </>
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
    </div>
  );
};

export default Planos;
