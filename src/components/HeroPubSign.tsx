import Image from "next/image";

/* Dieselbe Pendelbewegung wie zuvor, aber ohne Hydration oder JS-Animationsframe. */
export default function HeroPubSign() {
    return (
        <div className="hero-sign">
            <div className="hero-sign-frame">
                <Image
                    src="/PubSchild.svg"
                    alt=""
                    fill
                    draggable={false}
                    sizes="(max-aspect-ratio: 1/1) 84vw, 60vh"
                    loading="eager"
                />
            </div>
        </div>
    );
}
