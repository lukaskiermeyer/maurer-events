"use client";


export default function Loading() {
  return (
    <div className="bg-base-light min-h-screen pt-24 pb-32 animate-pulse">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
        
        {/* Back Button Skeleton */}
        <div className="w-40 h-6 bg-base-dark/10 rounded-full mb-12" />

        {/* Album Header Skeleton */}
        <div className="max-w-3xl mb-16">
          <div className="w-3/4 h-16 md:h-20 bg-base-dark/10 rounded-2xl mb-6" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-24 h-5 bg-base-dark/10 rounded-full" />
            <span className="text-base-dark/20">•</span>
            <div className="w-32 h-5 bg-base-dark/10 rounded-full" />
          </div>
          <div className="space-y-4">
            <div className="h-5 bg-base-dark/5 rounded-full w-full" />
            <div className="h-5 bg-base-dark/5 rounded-full w-11/12" />
            <div className="h-5 bg-base-dark/5 rounded-full w-4/5" />
          </div>
        </div>

        {/* Masonry Grid Skeleton */}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="bg-base-dark/5 rounded-2xl w-full"
              style={{
                height: `${240 + (i * 53) % 160}px`
              }}
            />
          ))}
        </div>
        
      </div>
    </div>
  );
}
