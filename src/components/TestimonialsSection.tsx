"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type Testimonial = { quote: string; role: string };

// Hinweis: Die Stimmen starten als Platzhalter-Beispiele und werden
// vom Kunden durch echte Zitate ersetzt (Inhalt liegt in messages/*.json).
export default function TestimonialsSection() {
  const t = useTranslations("Testimonials");
  const items = t.raw("items") as Testimonial[];

  return (
    <section id="testimonials" className="py-24 md:py-32 bg-wood relative overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="mb-14 md:mb-20 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display font-bold text-4xl md:text-6xl mb-4 text-base-dark"
          >
            {t("title_1")} <span className="text-accent-green italic">{t("title_2")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-sans text-lg text-base-dark/80 font-medium max-w-2xl mx-auto"
          >
            {t("subtitle")}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, index) => (
            <motion.figure
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: index * 0.12 }}
              className="relative bg-base-light/95 border border-base-dark/10 rounded-3xl p-8 md:p-10 flex flex-col shadow-xl"
            >
              <svg className="w-10 h-10 text-accent-green opacity-70 mb-6 -rotate-6" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
              </svg>
              <blockquote className="font-subhead text-xl md:text-2xl text-base-dark leading-snug flex-grow">
                {item.quote}
              </blockquote>
              <figcaption className="mt-8 pt-4 border-t border-base-dark/10 text-sm font-bold uppercase tracking-widest text-accent-green">
                {item.role}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
