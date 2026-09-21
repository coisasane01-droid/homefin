import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
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
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen;
