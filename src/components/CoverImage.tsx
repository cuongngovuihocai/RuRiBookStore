import {useEffect, useMemo, useState} from 'react';
import {
  extractGoogleDriveFileId,
  getOptimizedCoverBlobUrl,
  normalizeCoverImageUrl,
} from '../utils/format';

interface CoverImageProps {
  src?: string;
  alt: string;
  targetWidth?: number;
  className?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export function CoverImage({
  src,
  alt,
  targetWidth = 520,
  className = 'h-full w-full object-cover',
  onError,
  onLoad,
}: CoverImageProps) {
  const normalizedWithSize = useMemo(
    () => normalizeCoverImageUrl(src || '', targetWidth),
    [src, targetWidth]
  );

  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  const [stripDriveResize, setStripDriveResize] = useState(false);

  useEffect(() => {
    setOptimizedUrl(null);
    setStripDriveResize(false);

    if (!normalizedWithSize) return;

    let active = true;
    getOptimizedCoverBlobUrl(normalizedWithSize, targetWidth).then((blobUrl) => {
      if (active && blobUrl) {
        setOptimizedUrl(blobUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [normalizedWithSize, targetWidth]);

  const effectiveSrc = useMemo(() => {
    if (optimizedUrl) return optimizedUrl;
    if (stripDriveResize && src) {
      const driveId = extractGoogleDriveFileId(src);
      if (driveId) {
        return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}`;
      }
    }
    return normalizedWithSize;
  }, [optimizedUrl, stripDriveResize, src, normalizedWithSize]);

  if (!effectiveSrc) return null;

  const handleError = () => {
    if (!stripDriveResize && normalizedWithSize.includes('=w')) {
      setStripDriveResize(true);
      return;
    }
    onError?.();
  };

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={handleError}
      onLoad={onLoad}
      className={className}
    />
  );
}
