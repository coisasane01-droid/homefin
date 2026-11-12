import React, { useEffect, useState } from 'react';
import {
  PageAdvertisementConfig,
  saasDb,
} from '../services/saasDb';

interface PageAdvertisementProps {
  pageKey: string;
}

const isHttpUrl = (value?: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const getYouTubeEmbedUrl = (value?: string): string => {
  if (!value) return '';

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') || '';
      } else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0] || '')) {
          videoId = parts[1] || '';
        }
      }
    }

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return '';

    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&controls=1&loop=1&playlist=${videoId}`;
  } catch {
    return '';
  }
};

const PageAdvertisement: React.FC<PageAdvertisementProps> = ({ pageKey }) => {
  const [config, setConfig] = useState<PageAdvertisementConfig>(
    () => saasDb.getPageAdvertisementConfig(pageKey)
  );

  useEffect(() => {
    const refresh = () => {
      setConfig(saasDb.getPageAdvertisementConfig(pageKey));
    };

    refresh();
    window.addEventListener('homefin-saas-synced', refresh);
    return () => window.removeEventListener('homefin-saas-synced', refresh);
  }, [pageKey]);

  if (!config.enabled) return null;

  const isImage = config.mediaType === 'image';
  const isMp4 = config.mediaType === 'mp4';
  const imageIsValid =
    isImage &&
    (!!config.imageUrl?.startsWith('data:image/') || isHttpUrl(config.imageUrl));
  const videoIsValid = isMp4 && isHttpUrl(config.videoUrl);
  const youtubeUrl = config.mediaType === 'youtube'
    ? getYouTubeEmbedUrl(config.videoUrl)
    : '';

  if (!imageIsValid && !videoIsValid && !youtubeUrl) return null;

  const safeLink = isHttpUrl(config.linkUrl) ? config.linkUrl : '';
  const fitClass = config.videoFit === 'contain'
    ? 'object-contain bg-black'
    : 'object-cover';

  const media = isImage ? (
    <img
      src={config.imageUrl}
      alt={config.altText || 'Publicidade'}
      className="h-28 w-full object-cover sm:h-36 md:h-44"
      style={{
        objectPosition: `${config.imagePositionX ?? 50}% ${config.imagePositionY ?? 50}%`,
      }}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : isMp4 ? (
    <video
      src={config.videoUrl}
      aria-label={config.altText || 'Vídeo publicitário'}
      className={`h-28 w-full sm:h-36 md:h-44 ${fitClass}`}
      autoPlay
      muted
      playsInline
      loop
      controls
      preload="metadata"
    />
  ) : (
    <iframe
      src={youtubeUrl}
      title={config.altText || 'Vídeo publicitário'}
      className="h-28 w-full sm:h-36 md:h-44"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );

  return (
    <section
      aria-label="Publicidade"
      className="relative mb-4 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 print:hidden"
    >
      {isImage && safeLink ? (
        <a href={safeLink} target="_blank" rel="noopener noreferrer" className="block">
          {media}
        </a>
      ) : media}

      {!isImage && safeLink && (
        <a
          href={safeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-gray-900 shadow"
        >
          Conhecer parceiro
        </a>
      )}
    </section>
  );
};

export default PageAdvertisement;
