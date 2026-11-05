import crypto from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Configure as variáveis do servidor antes de continuar.');
  process.exit(1);
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askHidden(question) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Execute pelo terminal interativo do Codespaces.');
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    const onData = (buffer) => {
      for (const char of buffer.toString()) {
        if (char === '\u0003') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          reject(new Error('Operação cancelada.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }

        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        if (/^\d$/.test(char) && value.length < 4) {
          value += char;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  try {
    const familyId = (await rl.question('ID exato da família: ')).trim();

    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(familyId)) {
      throw new Error('ID inválido.');
    }

    const pin = await askHidden('PIN atual de 4 dígitos: ');

    if (!/^\d{4}$/.test(pin)) {
      throw new Error('O PIN precisa ter exatamente 4 dígitos.');
    }

    const base = `${url.replace(/\/+$/, '')}/rest/v1/`;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    const check = await fetch(
      `${base}homefin_family_credentials?family_id=eq.${encodeURIComponent(familyId)}&select=family_id`,
      { headers }
    );

    if (!check.ok) {
      throw new Error(`Não foi possível verificar o cadastro (HTTP ${check.status}).`);
    }

    const existing = await check.json();

    if (existing.length) {
      throw new Error('Esta família já possui credencial. Nenhuma alteração foi feita.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = crypto.scryptSync(pin, salt, 64).toString('hex');

    const response = await fetch(`${base}homefin_family_credentials`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        family_id: familyId,
        pin_salt: salt,
        pin_hash: pinHash,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cadastro não concluído (HTTP ${response.status}).`);
    }

    console.log('Credencial cadastrada com hash. O PIN não foi armazenado em texto puro.');
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
