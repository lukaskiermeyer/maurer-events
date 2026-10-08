"use client";

import { useState } from "react";
import Image, { type ImageProps } from 'next/image';

interface ImageWithSkeletonProps extends Omit<ImageProps, 'fill' | 'width' | 'height'> {
  wrapperClassName?: string;
  naturalAspectRatio?: boolean;
}

export default function ImageWithSkeleton({ wrapperClassName, className, naturalAspectRatio = false, src, alt, ...props }: ImageWithSkeletonProps) {
  const [loadedImage, setLoadedImage] = useState<{ src: ImageProps['src']; aspectRatio: number } | null>(null);
  const isLoaded = loadedImage?.src === src;

  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName || ''}`}
      // Older gallery records have no dimensions. Reserve space until decoding
      // supplies the natural ratio, then preserve it in the masonry columns.
      style={naturalAspectRatio ? { aspectRatio: isLoaded ? loadedImage.aspectRatio : 3 / 2 } : undefined}
    >
      {/* Skeleton Pulse */}
      <div 
        className={`absolute inset-0 bg-border-light animate-pulse transition-opacity duration-500 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
      />
      
      {/* Actual Image */}
      <Image
        {...props}
        src={src}
        alt={alt}
        fill
        className={`${className || ''} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setLoadedImage({ src, aspectRatio: e.currentTarget.naturalWidth / e.currentTarget.naturalHeight });
          props.onLoad?.(e);
        }}
      />
    </div>
  );
}
