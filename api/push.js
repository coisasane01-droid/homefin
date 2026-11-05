import pushSendHandler from '../server/api-handlers/push-send.js';
import pushSubscribeHandler from '../server/api-handlers/push-subscribe.js';
import pushBroadcastHandler from '../server/api-handlers/push-broadcast.js';

export const config = {
  api: { bodyParser: false },
};

function getMode(req, fallback) {
  const value = req.query?.mode;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];

  try {
    return new URL(req.url, 'https://homefin.invalid').searchParams.get('mode') || fallback;
  } catch {
    return fallback;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 1024 * 1024) {
      throw Object.assign(new Error('Corpo da requisição muito grande.'), { statusCode: 413 });
    }

    chunks.push(buffer);
  }

  if (!size) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Corpo JSON inválido.'), { statusCode: 400 });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const mode = getMode(req, 'send');

  const selected = {
    send: pushSendHandler,
    subscribe: pushSubscribeHandler,
    broadcast: pushBroadcastHandler,
  }[mode];

  if (!selected) {
    return res.status(404).json({ error: 'Operação Push não encontrada.' });
  }

  try {
    req.body = await readJsonBody(req);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || 'Corpo da requisição inválido.',
    });
  }

  return selected(req, res);
}
