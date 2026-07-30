import { MetadataRoute } from 'next';
import { getEvents } from '@/app/actions/events';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  const baseUrl = "https://maurer-events.com";

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${baseUrl}/de/termine/${event.id}`,
    lastModified: new Date(event.updatedAt || event.createdAt || new Date()),
    changeFrequency: 'weekly',
    priority: 0.8,
    alternates: {
      languages: {
        en: `${baseUrl}/en/termine/${event.id}`,
        de: `${baseUrl}/de/termine/${event.id}`,
      },
    },
  }));

  const staticRoutes: MetadataRoute.Sitemap = ['', '/termine', '/impressum', '/datenschutz'].map((route) => ({
    url: `${baseUrl}/de${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: route === '' ? 1.0 : 0.7,
    alternates: {
      languages: {
        en: `${baseUrl}/en${route}`,
        de: `${baseUrl}/de${route}`,
      },
    },
  }));

  return [...staticRoutes, ...eventEntries];
}
