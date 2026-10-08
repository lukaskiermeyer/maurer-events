"use client";


export default function Loading() {
  return (
    <div className="min-h-screen bg-base-light animate-pulse">
      {/* Event Header Banner Skeleton */}
      <div className="bg-canvas-light border-b border-border-light pt-32 pb-20 relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10 flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          
          <div className="flex-1 w-full text-center lg:text-left">
            <div className="w-32 h-10 bg-white/50 backdrop-blur-md rounded-full mb-8 inline-block" />
            
            <div className="h-20 md:h-24 lg:h-32 bg-base-dark/10 rounded-2xl mb-10 w-3/4 mx-auto lg:mx-0" />
            
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
              <div className="w-48 h-24 bg-white/60 backdrop-blur-md rounded-2xl" />
              <div className="w-48 h-24 bg-white/60 backdrop-blur-md rounded-2xl" />
            </div>
          </div>

          <div className="w-full sm:w-[500px] lg:w-[600px] flex-shrink-0 mt-8 lg:mt-0">
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-white/80 border-8 border-white/90" />
          </div>
          
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <div className="h-10 w-64 bg-base-dark/10 rounded-xl mb-6" />
            <div className="space-y-4">
              <div className="h-4 bg-base-dark/5 rounded-full w-full" />
              <div className="h-4 bg-base-dark/5 rounded-full w-11/12" />
              <div className="h-4 bg-base-dark/5 rounded-full w-10/12" />
              <div className="h-4 bg-base-dark/5 rounded-full w-full" />
              <div className="h-4 bg-base-dark/5 rounded-full w-3/4" />
            </div>
          </div>
          
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <div className="bg-canvas-light p-8 rounded-3xl border border-border-light h-96" />
          </div>
        </div>
      </div>
    </div>
  );
}
