import type { HeroLight } from "@/components/heroLightPoints";

/* Sanftes Funkeln ueber den gezeichneten Gluehbirnen einer Stage-Box.
   Die Punkte liegen prozentgenau auf den Birnen des SVGs und blenden nur in der
   Helligkeit - deshalb bleibt das zentrierende CSS-Transform unangetastet.
   Dauer, Staffelung und Reduced-Motion-Verhalten steuert CSS compositor-seitig. */
export default function HeroLights({ lights }: { lights: HeroLight[] }) {
    return (
        <>
            {lights.map((light, i) => {
                const duration = 2.6 + (i % 4) * 0.55;
                const delay = (i * 0.37) % 2.3;
                return (
                    <span
                        key={`${light.x}-${light.y}`}
                        className="hero-light"
                        style={{
                            left: `${light.x}%`,
                            top: `${light.y}%`,
                            width: `${(light.r * 2.4).toFixed(3)}%`,
                            animationDuration: `${duration}s`,
                            animationDelay: `${delay}s`,
                        }}
                    />
                );
            })}
        </>
    );
}