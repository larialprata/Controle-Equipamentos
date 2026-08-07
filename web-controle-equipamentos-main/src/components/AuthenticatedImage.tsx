import React, { useEffect, useState } from 'react';
import { authApi } from '../api/auth';

interface AuthenticatedImageProps {
  filename: string | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  filename,
  alt,
  className,
  fallbackIcon,
  onError,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!filename) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    let blobUrl: string | null = null;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        const url = await authApi.getDocumentPhotoBlobUrl(filename);
        blobUrl = url;
        setImageUrl(url);
      } catch (error) {
        console.error('Failed to load authenticated image:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup: revoke blob URL when component unmounts or filename changes
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [filename]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  if (!filename || hasError) {
    return fallbackIcon ? <>{fallbackIcon}</> : null;
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        onError={handleError}
      />
    );
  }

  return fallbackIcon ? <>{fallbackIcon}</> : null;
};

export default AuthenticatedImage;
