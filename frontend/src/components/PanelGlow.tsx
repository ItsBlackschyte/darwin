import { useEffect } from "react";
import { gsap } from "gsap";

/**
 * MagicBento-style effect layer for the existing console panels:
 * a soft spotlight follows the cursor, and each .panel's border
 * glows where the cursor is near it. No grid of its own — it
 * decorates whatever `selector` matches.
 */

interface Props {
  selector?: string;
  spotlightRadius?: number;
  glowColor?: string; // "r, g, b"
}

export default function PanelGlow({
  selector = ".panel",
  spotlightRadius = 280,
  glowColor = "124, 227, 168",
}: Props) {
  useEffect(() => {
    if (window.innerWidth <= 768) return; // skip on mobile

    const spotlight = document.createElement("div");
    spotlight.style.cssText = `
      position: fixed;
      width: 700px;
      height: 700px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.10) 0%,
        rgba(${glowColor}, 0.05) 20%,
        rgba(${glowColor}, 0.02) 40%,
        transparent 70%
      );
      z-index: 40;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;
    document.body.appendChild(spotlight);

    const proximity = spotlightRadius * 0.5;
    const fadeDistance = spotlightRadius * 0.75;

    const onMove = (e: MouseEvent) => {
      const cards = document.querySelectorAll<HTMLElement>(selector);
      let minDistance = Infinity;

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance =
          Math.hypot(e.clientX - centerX, e.clientY - centerY) -
          Math.max(rect.width, rect.height) / 2;
        const d = Math.max(0, distance);
        minDistance = Math.min(minDistance, d);

        let intensity = 0;
        if (d <= proximity) intensity = 1;
        else if (d <= fadeDistance) intensity = (fadeDistance - d) / (fadeDistance - proximity);

        card.style.setProperty("--glow-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty("--glow-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
        card.style.setProperty("--glow-intensity", String(intensity));
        card.style.setProperty("--glow-radius", `${spotlightRadius}px`);
      });

      gsap.to(spotlight, { left: e.clientX, top: e.clientY, duration: 0.1, ease: "power2.out" });

      const targetOpacity =
        minDistance <= proximity
          ? 0.7
          : minDistance <= fadeDistance
          ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.7
          : 0;
      gsap.to(spotlight, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.2 : 0.5,
        ease: "power2.out",
      });
    };

    const onLeave = () => {
      document
        .querySelectorAll<HTMLElement>(selector)
        .forEach((c) => c.style.setProperty("--glow-intensity", "0"));
      gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: "power2.out" });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      spotlight.parentNode?.removeChild(spotlight);
    };
  }, [selector, spotlightRadius, glowColor]);

  return null;
}