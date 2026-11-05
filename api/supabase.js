export default function handler(req, res) {
  res.setHeader('Allow', 'POST');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'Proxy genérico desativado. Use as APIs específicas e autenticadas do HomeFin.',
  });
}
