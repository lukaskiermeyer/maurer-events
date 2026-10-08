import { db } from '../src/db';
import { events, galleries } from '../src/db/schema';
import { like, eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function main() {
  console.log('Starte Aktualisierung der Galerie-Events...');

  // 1. Lösche alte Dummy-Events
  console.log('Lösche alte Dummy-Feste...');
  const oldDummies = await db.select().from(events).where(
    and(
      eq(events.type, 'gallery'),
      like(events.title, '%Dummy%')
    )
  );

  for (const dummy of oldDummies) {
    // Delete associated galleries first
    await db.delete(galleries).where(eq(galleries.eventId, dummy.id));
    // Hard delete or soft delete the event? Let's hard delete to be clean.
    await db.delete(events).where(eq(events.id, dummy.id));
    console.log(`Gelöscht: ${dummy.title}`);
  }

  // 2. Füge neue Events ein
  console.log('Füge neue Feste ein...');
  
  const newEvents = [
    {
      title: 'Stadtfest Stadtbergen',
      date: new Date('2023-05-12'),
      location: 'Stadtbergen',
      description: 'Ein wunderschönes Stadtfest in Stadtbergen mit vielen Attraktionen und bester Stimmung.',
      imageUrl: 'https://images.unsplash.com/photo-1533174000273-e1165fba0b92?w=800&q=80',
      isFeaturedGallery: true,
    },
    {
      title: 'Volksfest Hohenwart',
      date: new Date('2023-06-20'),
      location: 'Hohenwart',
      description: 'Das traditionelle Volksfest in Hohenwart. Zünftig, gemütlich und voller Leben.',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
      isFeaturedGallery: true,
    },
    {
      title: 'Pfingstvolksfest Ingolstadt',
      date: new Date('2023-05-28'),
      location: 'Ingolstadt',
      description: 'Ein Highlight in Ingolstadt: Das große Pfingstvolksfest mit Riesenrad und Festzelt.',
      imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
      isFeaturedGallery: true,
    },
    {
      title: 'Fahenenweihe Unsernherrn',
      date: new Date('2023-07-08'),
      location: 'Unsernherrn',
      description: 'Feierliche Fahnenweihe in Unsernherrn mit festlichem Umzug und Bierzeltbetrieb.',
      imageUrl: 'https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=800&q=80',
      isFeaturedGallery: false,
    },
    {
      title: 'Tanztraum Bühler Halle',
      date: new Date('2023-11-15'),
      location: 'Bühler Halle',
      description: 'Eine unvergessliche Nacht beim Tanztraum in der Bühler Halle.',
      imageUrl: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80',
      isFeaturedGallery: false,
    },
    {
      title: 'Festwochenende SV Eitensheim',
      date: new Date('2023-09-02'),
      location: 'Eitensheim',
      description: 'Sport und Spaß beim großen Festwochenende des SV Eitensheim.',
      imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
      isFeaturedGallery: true,
    }
  ];

  for (const ev of newEvents) {
    const newId = randomUUID();
    await db.insert(events).values({
      id: newId,
      title: ev.title,
      date: ev.date,
      location: ev.location,
      description: ev.description,
      imageUrl: ev.imageUrl,
      type: 'gallery',
      isFeaturedGallery: ev.isFeaturedGallery,
      reservable: false,
      allowTableSelection: false,
      maxCapacity: 1000,
      minimumConsumption: 5000,
      walkInReserve: 0,
    });

    // Add a few dummy images to the gallery so it's not empty
    await db.insert(galleries).values([
      { eventId: newId, imageUrl: ev.imageUrl },
      { eventId: newId, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80' },
      { eventId: newId, imageUrl: 'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=800&q=80' }
    ]);

    console.log(`Eingefügt: ${ev.title}`);
  }

  console.log('Fertig!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
