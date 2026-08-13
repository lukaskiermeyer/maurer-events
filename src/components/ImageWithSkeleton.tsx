"use client";

import { useState } from "react";

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
}

export default function ImageWithSkeleton({ wrapperClassName, className, ...props }: ImageWithSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${wrapperClassName || ''}`}>
      {/* Skeleton Pulse */}
      <div 
        className={`absolute inset-0 bg-border-light animate-pulse transition-opacity duration-500 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
      />
      
      {/* Actual Image */}
      <img
        {...props}
        className={`${className || ''} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setIsLoaded(true);
          if (props.onLoad) props.onLoad(e);
        }}
      />
    </div>
  );
}
