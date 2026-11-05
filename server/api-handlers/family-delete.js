import { validateFamilySession } from '../../api/_family-session.js';
import {
  enqueueStorageCleanup,
  getFamilyStorageObjectPaths,
  removeStorageObjects,
  completeStorageCleanupJob,
} from '../../api/_family-storage.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const familyId = typeof req.body?.familyId === 'string' ? req.body.familyId : '';
  let session;
  try {
    session = await validateFamilySession(req, familyId);
  } catch (error) {
    console.error('Falha ao validar sessão para exclusão familiar:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível validar a sessão familiar.' });
  }
  if (!session.valid) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Configuração segura do servidor indisponível.' });

  try {
    let attachmentPaths;
    let cleanupJobId;
    try {
      attachmentPaths = await getFamilyStorageObjectPaths(session.familyId);
      cleanupJobId = await enqueueStorageCleanup(session.familyId, attachmentPaths);
    } catch (error) {
      console.error(
        'Falha ao preparar limpeza de anexos para exclusão familiar:',
        error instanceof Error ? error.message : 'erro desconhecido'
      );
      return res.status(502).json({ error: 'Não foi possível preparar a limpeza de anexos. A família não foi excluída.' });
    }

    const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/homefin_delete_family`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_family_id: session.familyId }),
    });
    if (!response.ok) {
      console.error('Falha ao excluir família no Supabase:', response.status);
      return res.status(502).json({
        error: 'O servidor não confirmou a exclusão familiar. Os anexos não foram removidos; a limpeza pendente só será processada após confirmar que os dados da família foram excluídos.',
      });
    }
    const deleted = await response.json();
    if (deleted !== true) {
      return res.status(409).json({ error: 'A exclusão familiar não foi confirmada pelo servidor.' });
    }

    if (cleanupJobId) {
      try {
        await removeStorageObjects(attachmentPaths);
        await completeStorageCleanupJob(cleanupJobId);
        return res.status(200).json({ success: true, storageCleanupPending: false });
      } catch (error) {
        console.error(
          'Família excluída; a limpeza de anexos ficou pendente:',
          error instanceof Error ? error.message : 'erro desconhecido'
        );
        return res.status(200).json({ success: true, storageCleanupPending: true });
      }
    }

    return res.status(200).json({ success: true, storageCleanupPending: false });
  } catch (error) {
    console.error('Erro ao excluir família:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível concluir a exclusão familiar.' });
  }
}
