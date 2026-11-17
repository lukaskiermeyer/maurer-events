"use client";


export default function Loading() {
  return (
    <div className="min-h-screen bg-base-light animate-pulse">
      {/* Event Header Skeleton (Zelt-Decke + Poster-Bühne) */}
      <div className="relative overflow-hidden">
        <div className="h-[150px] md:h-[250px] bg-accent-green/15" />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 pt-[280px] md:pt-[400px] lg:pt-[480px] pb-16 md:pb-24">
          <div className="w-48 h-10 bg-base-dark/10 rounded-full" />

          <div className="mt-10 md:mt-12 flex flex-col lg:flex-row gap-12 lg:gap-20 items-center lg:items-start">
            <div className="flex-1 w-full">
              <div className="h-6 w-40 bg-base-dark/10 rounded mb-6 mx-auto lg:mx-0" />
              <div className="h-16 md:h-24 lg:h-28 bg-base-dark/10 rounded-2xl mb-10 w-3/4 mx-auto lg:mx-0" />
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <div className="w-60 h-20 bg-base-dark/5 border border-border-light rounded-2xl" />
                <div className="w-60 h-20 bg-base-dark/5 border border-border-light rounded-2xl" />
              </div>
            </div>

            <div className="w-full sm:w-[420px] lg:w-[480px] shrink-0">
              <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden border border-border-light shadow-xl">
                <div className="h-14 md:h-auto md:w-24 bg-base-dark/15 shrink-0" />
                <div className="flex-1 aspect-[3/4] bg-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-16 md:mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
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
            <div className="bg-canvas-light border border-border-light border-t-4 border-t-accent-green/40 rounded-3xl h-96" />
          </div>
        </div>
      </div>
    </div>
  );
}
