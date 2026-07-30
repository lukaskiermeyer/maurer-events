import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MAURER EVENTS',
    short_name: 'Maurer Events',
    description: 'Erlebe modernste Events mit bayerischem Herz.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F2EE',
    theme_color: '#4B5320',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
