import React, { useEffect, useState } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

type NotificationData = {
  message: string;
  type: NotificationType;
};

const NotificationModal: React.FC = () => {
  const [notification, setNotification] =
    useState<NotificationData | null>(null);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationData>;
      setNotification(customEvent.detail);
    };

    window.addEventListener('homefin-notification', handleNotification);

    return () => {
      window.removeEventListener(
        'homefin-notification',
        handleNotification
      );
    };
  }, []);

  if (!notification) return null;

  const config = {
    success: {
      icon: '✓',
      title: 'Sucesso',
    },
    error: {
      icon: '!',
      title: 'Erro',
    },
    warning: {
      icon: '!',
      title: 'Atenção',
    },
    info: {
      icon: 'i',
      title: 'Informação',
    },
  }[notification.type];

  const close = () => setNotification(null);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
            {config.icon}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">
              {config.title}
            </h3>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {notification.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;