"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { WELCOME_CAROUSEL_SLIDES } from "@/lib/welcome-carousel-slides";

const SLIDE_COUNT = WELCOME_CAROUSEL_SLIDES.length;
const AUTO_ADVANCE_MS = 5000;

export function WelcomeHeroCarousel() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const goTo = React.useCallback((index: number) => {
    setActiveIndex(((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  const goPrev = React.useCallback(
    () => goTo(activeIndex - 1),
    [activeIndex, goTo],
  );
  const goNext = React.useCallback(
    () => goTo(activeIndex + 1),
    [activeIndex, goTo],
  );

  React.useEffect(() => {
    if (reduceMotion || paused) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % SLIDE_COUNT);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext],
  );

  const activeSlide = WELCOME_CAROUSEL_SLIDES[activeIndex];

  return (
    <div
      className="fixed inset-0 z-0 h-dvh w-full overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Welcome highlights"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {WELCOME_CAROUSEL_SLIDES.map((slide, index) => {
        const isActive = index === activeIndex;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 h-full w-full overflow-hidden transition-opacity duration-700 ease-in-out ${
              isActive ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
            style={{ transition: reduceMotion ? "none" : undefined }}
            aria-hidden={!isActive}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static files from /public */}
            <img
              src={slide.src}
              alt={slide.alt}
              className={`h-full w-full object-cover ${
                isActive && !reduceMotion ? "welcome-carousel-slide-active" : ""
              }`}
              decoding="async"
              loading="eager"
              draggable={false}
            />
          </div>
        );
      })}

      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.28) 100%)",
        }}
        aria-hidden
      />

      <p className="sr-only" aria-live="polite">
        Slide {activeIndex + 1} of {SLIDE_COUNT}: {activeSlide.alt}
      </p>

      <button
        type="button"
        className="pointer-events-auto absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50 sm:left-5"
        onClick={goPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <button
        type="button"
        className="pointer-events-auto absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50 sm:right-5"
        onClick={goNext}
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" aria-hidden />
      </button>

      <div
        className="pointer-events-auto absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2"
        role="tablist"
        aria-label="Choose slide"
      >
        {WELCOME_CAROUSEL_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Go to slide ${index + 1}: ${slide.alt}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? "w-6 bg-white"
                : "w-2.5 bg-white/45 hover:bg-white/70"
            }`}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
