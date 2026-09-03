// Este arquivo deve ser implantado como uma Serverless Function na Vercel
// Caminho: /api/webhook.js

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { type, data } = req.body;

      // Verifica se é uma notificação de pagamento
      if (type === 'payment') {
        const paymentId = data.id;
        
        console.log(`Recebido webhook de pagamento: ${paymentId}`);

        // AQUI VOCÊ DEVE:
        // 1. Consultar a API do Mercado Pago usando o paymentId para confirmar o status
        // 2. Se status === 'approved', buscar o usuário no Supabase
        // 3. Atualizar o plano do usuário para 'premium'
        
        /* Exemplo de código para consultar Mercado Pago:
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
          }
        });
        const paymentData = await response.json();
        
        if (paymentData.status === 'approved') {
           // Atualizar banco de dados
        }
        */
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
