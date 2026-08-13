"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import ImageWithSkeleton from "./ImageWithSkeleton";

export default function GalleryGrid({ images }: { images: any[] }) {
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  if (!images || images.length === 0) {
    return <div className="text-center py-20 text-base-dark/50">Keine Bilder vorhanden.</div>;
  }

  return (
    <div className="w-full">
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {images.map((img, i) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 5) * 0.1 }}
            className="relative break-inside-avoid overflow-hidden rounded-2xl group cursor-pointer border border-border-light shadow-sm bg-base-light"
            onClick={() => setSelectedImage(img)}
          >
            {/* Masonry image container. Standard img handles natural height inside columns, but to enforce a uniform look we can use aspect ratio padding or let it flow naturally. Since we want a nice masonry look, we let it flow naturally. But wait, if they are different heights, img tag without fixed height works best in CSS columns. */}
            <ImageWithSkeleton 
              src={img.imageUrl} 
              alt="Galerie Bild"
              className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
              wrapperClassName="w-full h-full"
            />
            <div className="absolute inset-0 bg-base-dark/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-base-dark/98 backdrop-blur-xl p-4 md:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 md:top-10 md:right-10 text-white hover:text-accent-green transition-colors p-2 z-50"
            onClick={() => setSelectedImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full max-w-6xl max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <ImageWithSkeleton 
              src={selectedImage.imageUrl} 
              alt="Fullscreen" 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              wrapperClassName="max-w-full max-h-[90vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
