import { getGalleryAlbums } from "@/app/actions/gallery";
import GallerySection from "@/components/GallerySection";

export const revalidate = 60; // Optional: revalidate every minute if not using on-demand revalidation

export default async function GaleriePage() {
  const galleryAlbums = await getGalleryAlbums();

  return (
    <div className="bg-white min-h-screen flex flex-col pt-10">
      <GallerySection albums={galleryAlbums} sneakPeek={false} />
    </div>
  );
}
