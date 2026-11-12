import React, { useState } from 'react';
import { saasDb, APP_ADVERTISEMENT_PAGES, PageAdvertisementConfig } from '../services/saasDb';
import { showNotification } from '../services/utils/notifications';
import { Image, MonitorPlay, Save, RefreshCw } from 'lucide-react';

interface Props {
  saved: boolean;
  onSaved: () => void;
}

const AdminPageAdvertisements: React.FC<Props> = ({ saved, onSaved }) => {
  const [pageKey, setPageKey] = useState('bills');
  const [config, setConfig] = useState<PageAdvertisementConfig>(
    () => saasDb.getPageAdvertisementConfig('bills')
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const validHttp = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch { return false; }
  };

  const changePage = (key: string) => {
    setPageKey(key);
    setConfig(saasDb.getPageAdvertisementConfig(key));
    setError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (config.enabled) {
      if (config.mediaType === 'image') {
        const src = config.imageUrl || '';
        if (!src.startsWith('data:image/') && !validHttp(src)) {
          setError('Informe uma URL válida de imagem ou selecione um arquivo.');
          return;
        }
      } else {
        if (!validHttp(config.videoUrl || '')) {
          setError('Informe uma URL pública válida para o vídeo.');
          return;
        }
        if (config.mediaType === 'youtube') {
          let host = '';
          try {
            host = new URL(config.videoUrl || '').hostname.toLowerCase().replace(/^www\./, '');
          } catch {}
          if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
            setError('Informe um link válido do YouTube.');
            return;
          }
        }
      }
    }

    if (config.linkUrl?.trim() && !validHttp(config.linkUrl.trim())) {
      setError('O link de destino deve começar com http:// ou https://.');
      return;
    }

    setSaving(true);
    try {
      await saasDb.updatePageAdvertisementConfig(pageKey, config);
      onSaved();
      showNotification('Publicidade salva e sincronizada com a nuvem.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar a publicidade.';
      setError(message);
      showNotification(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
        <MonitorPlay className="text-indigo-600" /> Publicidade por página
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Configure anúncios independentes por página. A configuração é global e vale
        para todas as famílias. Somente o Super Admin pode alterá-la.
      </p>
      <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        O anúncio ocupa espaço próprio no conteúdo, sem cobrir menus ou informações.
        A integração com redes de anúncios ainda não está conectada.
      </p>

      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-semibold">Página</label>
          <select value={pageKey} onChange={e => changePage(e.target.value)}
            className="w-full rounded-lg border bg-white p-3">
            {APP_ADVERTISEMENT_PAGES.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
          <span>
            <strong className="block">Publicidade ativada</strong>
            <small className="text-gray-500">Desative sem apagar a configuração.</small>
          </span>
          <input type="checkbox" checked={config.enabled}
            onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
            className="h-5 w-5" />
        </label>

        <div>
          <label className="mb-1 block text-sm font-semibold">Formato do anúncio</label>
          <select value={config.mediaType}
            onChange={e => setConfig(c => ({
              ...c, mediaType: e.target.value as PageAdvertisementConfig['mediaType']
            }))}
            className="w-full rounded-lg border bg-white p-3">
            <option value="image">Imagem</option>
            <option value="mp4">Vídeo MP4</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>

        {config.mediaType === 'image' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              URL da imagem
              <input type="url" value={(config.imageUrl || '').startsWith('data:') ? '' : config.imageUrl || ''}
                onChange={e => setConfig(c => ({ ...c, imageUrl: e.target.value }))}
                placeholder="https://site.com.br/anuncio.jpg"
                className="mt-1 w-full rounded-lg border p-3" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-gray-50 px-4 py-2 text-sm">
              <Image size={18} /> Selecionar imagem (máx. 1,5 MB)
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  if (file.size > 1.5 * 1024 * 1024) {
                    showNotification('Imagem maior que 1,5 MB. Use uma URL pública.', 'error');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string')
                      setConfig(c => ({ ...c, imageUrl: reader.result as string }));
                  };
                  reader.onerror = () => showNotification('Falha ao ler a imagem.', 'error');
                  reader.readAsDataURL(file);
                }} />
            </label>
            {!!config.imageUrl && (
              <div className="overflow-hidden rounded-lg border">
                <img src={config.imageUrl} alt={config.altText || 'Prévia do anúncio'}
                  className="h-40 w-full object-cover"
                  style={{ objectPosition: `${config.imagePositionX ?? 50}% ${config.imagePositionY ?? 50}%` }} />
              </div>
            )}
            <label className="block text-sm">
              Posição horizontal: {config.imagePositionX ?? 50}%
              <input type="range" min="0" max="100" className="w-full"
                value={config.imagePositionX ?? 50}
                onChange={e => setConfig(c => ({ ...c, imagePositionX: Number(e.target.value) }))} />
            </label>
            <label className="block text-sm">
              Posição vertical: {config.imagePositionY ?? 50}%
              <input type="range" min="0" max="100" className="w-full"
                value={config.imagePositionY ?? 50}
                onChange={e => setConfig(c => ({ ...c, imagePositionY: Number(e.target.value) }))} />
            </label>
          </div>
        )}

        {(config.mediaType === 'mp4' || config.mediaType === 'youtube') && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              {config.mediaType === 'mp4' ? 'URL pública do MP4' : 'Link do YouTube'}
              <input type="url" value={config.videoUrl || ''}
                onChange={e => setConfig(c => ({ ...c, videoUrl: e.target.value }))}
                placeholder={config.mediaType === 'mp4' ? 'https://site.com/video.mp4' : 'https://youtube.com/watch?v=...'}
                className="mt-1 w-full rounded-lg border p-3" />
            </label>
            {config.mediaType === 'mp4' && (
              <>
                <label className="block text-sm">Ajuste do vídeo
                  <select value={config.videoFit || 'cover'}
                    onChange={e => setConfig(c => ({ ...c, videoFit: e.target.value as 'cover' | 'contain' }))}
                    className="mt-1 w-full rounded-lg border bg-white p-3">
                    <option value="cover">Preencher espaço</option>
                    <option value="contain">Mostrar vídeo inteiro</option>
                  </select>
                </label>
                {!!config.videoUrl && <video src={config.videoUrl} controls muted playsInline
                  className={`h-40 w-full rounded-lg bg-black ${config.videoFit === 'contain' ? 'object-contain' : 'object-cover'}`} />}
              </>
            )}
          </div>
        )}

        <label className="block text-sm font-semibold">
          Link de destino (opcional)
          <input type="url" value={config.linkUrl || ''}
            onChange={e => setConfig(c => ({ ...c, linkUrl: e.target.value }))}
            placeholder="https://anunciante.com.br"
            className="mt-1 w-full rounded-lg border p-3" />
        </label>

        <label className="block text-sm font-semibold">
          Texto alternativo
          <input type="text" value={config.altText || ''}
            onChange={e => setConfig(c => ({ ...c, altText: e.target.value }))}
            className="mt-1 w-full rounded-lg border p-3" />
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <small className="text-gray-500">A gravação altera somente a página selecionada.</small>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? <><RefreshCw size={18} className="animate-spin" /> Salvando...</> :
              <><Save size={18} /> {saved ? 'Salvo' : 'Salvar publicidade'}</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminPageAdvertisements;
