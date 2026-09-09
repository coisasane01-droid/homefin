export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export const showNotification = (
  message: string,
  type: NotificationType = 'info'
) => {
  window.dispatchEvent(
    new CustomEvent('homefin-notification', {
      detail: {
        message,
        type,
      },
    })
  );
};