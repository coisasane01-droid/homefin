import { verifyAdminSession } from './admin-auth.js';
import {
  completeStorageCleanupJob,
  isFamilyDeleted,
  listStorageCleanupJobs,
  normalizeStorageObjectPath,
  removeStorageObjects,
} from './_family-storage.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Sessão administrativa inválida.' });
  }

  try {
    const jobs = await listStorageCleanupJobs();
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs) {
      if (
        typeof job.id !== 'string' ||
        typeof job.family_id !== 'string' ||
        !FAMILY_ID_PATTERN.test(job.family_id) ||
        !Array.isArray(job.object_paths)
      ) {
        failed += 1;
        continue;
      }

      try {
        if (!await isFamilyDeleted(job.family_id)) {
          skipped += 1;
          continue;
        }

        const paths = job.object_paths.map(normalizeStorageObjectPath);
        if (paths.some((path) =>
          !path || (!path.startsWith(`${job.family_id}/`) && path.includes('/'))
        )) {
          failed += 1;
          continue;
        }

        await removeStorageObjects(paths);
        await completeStorageCleanupJob(job.id);
        processed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          'Falha ao processar limpeza pendente de anexos:',
          error instanceof Error ? error.message : 'erro desconhecido'
        );
      }
    }

    return res.status(failed ? 502 : 200).json({
      success: failed === 0,
      processed,
      skipped,
      failed,
    });
  } catch (error) {
    console.error(
      'Não foi possível carregar a fila de limpeza de anexos:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(503).json({ error: 'Não foi possível processar a limpeza pendente de anexos.' });
  }
}
