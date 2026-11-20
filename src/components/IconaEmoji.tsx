import React, { useState, useEffect } from 'react';
import {
  CustomEmojiIcon,
  getCustomEmojiIcons,
  isCustomIconValue,
  resolveCustomIconDataUrl,
} from '../utils/emojiIconsArchive';

interface IconaEmojiProps {
  value?: string | null;
  icona?: string | null;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | string;
  className?: string;
  imgClassName?: string;
  title?: string;
}

const SIZE_CLASS_MAP: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

/**
 * Renderizza in modo uniforme sia un'emoji Unicode sia un'icona personalizzata (.ico)
 * proveniente dall'archivio permanente, allineando automaticamente lo sfondo al contenitore.
 */
export const IconaEmoji: React.FC<IconaEmojiProps> = ({
  value,
  icona,
  fallback = '🏷️',
  size,
  className = '',
  imgClassName = '',
  title,
}) => {
  const [customIcons, setCustomIcons] = useState<CustomEmojiIcon[]>(() => getCustomEmojiIcons());

  useEffect(() => {
    const refresh = () => setCustomIcons(getCustomEmojiIcons());
    window.addEventListener('croceoro_custom_icons_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('croceoro_custom_icons_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const sizeCls = size ? (SIZE_CLASS_MAP[size] || '') : '';
  const combinedClassName = `${sizeCls} ${className}`.trim();
  const raw = (value ?? icona ?? '').trim();
  if (isCustomIconValue(raw)) {
    const dataUrl = resolveCustomIconDataUrl(raw, customIcons);
    if (dataUrl) {
      return (
        <img
          src={dataUrl}
          alt={title || 'Icona'}
          title={title}
          className={`inline-block w-[1.25em] h-[1.25em] object-contain align-middle bg-transparent select-none shrink-0 ${imgClassName} ${combinedClassName}`.trim()}
          draggable={false}
        />
      );
    }
    return (
      <span className={`inline-flex items-center justify-center leading-none ${combinedClassName}`.trim()} title={title}>
        {fallback}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center leading-none ${combinedClassName}`.trim()} title={title}>
      {raw || fallback}
    </span>
  );
};
