import React from 'react';

const getInitialBackground = (): React.CSSProperties => {
  try {
    const hash = window.location.hash || '';
    const query = hash.includes('?') ? hash.split('?').slice(1).join('?') : '';
    const params = new URLSearchParams(query);
    const familyId =
      params.get('family') ||
      window.localStorage.getItem('homefin_current_family_id') ||
      'v1';

    const isLoginRoute = hash.split('?')[0].includes('/login');

    const isFamilyRedirect =
      Boolean(familyId) &&
      familyId !== 'v1' &&
      (hash.split('?')[0] === '#' || hash.split('?')[0] === '#/');

    if (isLoginRoute || isFamilyRedirect) {
      const familyRaw = window.localStorage.getItem(`homefin_data_${familyId}`);
      if (familyRaw) {
        const familyData = JSON.parse(familyRaw);
        const settings = familyData?.settings;

        if (settings?.backgroundImage) {
          return {
            backgroundColor: '#111827',
            backgroundImage: `url("${settings.backgroundImage}")`,
            backgroundSize:
              settings.backgroundFit === 'contain'
                ? 'contain'
                : `${settings.backgroundZoom || 100}%`,
            backgroundPosition: settings.backgroundPosition || 'center',
            backgroundRepeat: 'no-repeat',
          };
        }
      }
    }

    const raw = window.localStorage.getItem('homefin_saas_data_v1');
    if (raw) {
      const data = JSON.parse(raw);
      const config = data.landingConfig || {};

      if (config.bannerImage) {
        return {
          backgroundColor: config.bgColorStart || '#312e81',
          backgroundImage: `url("${config.bannerImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar o fundo inicial:', error);
  }

  return { backgroundColor: '#ffffff' };
};

const LoadingScreen: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...getInitialBackground(),
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '5px solid #dbeafe',
        borderTopColor: '#3b82f6',
        borderRightColor: '#60a5fa',
        animation: 'homefin-spin 0.8s linear infinite',
      }}
    />
    <style>
      {`
        @keyframes homefin-spin {
          to { transform: rotate(360deg); }
        }
      `}
    </style>
  </div>
);

export default LoadingScreen;
