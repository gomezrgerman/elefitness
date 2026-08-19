"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface RevealTextProps {
  lines: string[];
}

export function RevealText({ lines }: RevealTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        gsap.set(".reveal-line-inner", { opacity: 1, y: 0 });
        return;
      }

      gsap.set(".reveal-line-inner", { opacity: 0, y: "100%" });
      gsap.to(".reveal-line-inner", {
        opacity: 1,
        y: "0%",
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top 85%",
          once: true,
        },
      });
    }, rootRef);

    return () => context.revert();
  }, []);

  return (
    <span ref={rootRef} className="block">
      {lines.map((line, index) => (
        <span key={index} className="block overflow-hidden">
          <span className="reveal-line-inner block">{line}</span>
        </span>
      ))}
    </span>
  );
}
