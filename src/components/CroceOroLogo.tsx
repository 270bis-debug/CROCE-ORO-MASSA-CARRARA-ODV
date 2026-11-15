import React from 'react';
import { APP_VERSION } from '../version';

interface CroceOroLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  imgClassName?: string;
}

export const CroceOroLogo: React.FC<CroceOroLogoProps> = ({
  size = 'md',
  className = '',
  imgClassName = ''
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 min-w-[28px]',
    sm: 'w-10 h-10 min-w-[40px]',
    md: 'w-12 h-12 min-w-[48px]',
    lg: 'w-16 h-16 min-w-[64px]',
    xl: 'w-24 h-24 min-w-[96px]',
    custom: ''
  };

  return (
    <img
      src={`/logo_croce_oro_v2.png?v=${APP_VERSION}`}
      alt="Stemma Ufficiale Croce Oro Massa Carrara"
      className={`shrink-0 object-contain select-none pointer-events-none drop-shadow-md ${sizeClasses[size]} ${className} ${imgClassName}`}
    />
  );
};
