"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { WELCOME_CAROUSEL_SLIDES } from "@/lib/welcome-carousel-slides";

const SLIDES = [...WELCOME_CAROUSEL_SLIDES];
const SLIDE_COUNT = SLIDES.length;
const AUTO_ADVANCE_MS = 20000;

export function WelcomeHeroCarousel() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);

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

  const goPrev = React.useCallback(() => {
    setActiveIndex((i) => (i - 1 + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  const goNext = React.useCallback(() => {
    setActiveIndex((i) => (i + 1) % SLIDE_COUNT);
  }, []);

  // Always auto-advance; reduced-motion only disables zoom/crossfade styling.
  React.useEffect(() => {
    if (SLIDE_COUNT <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % SLIDE_COUNT);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, []);

  const onControlsKeyDown = React.useCallback(
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

  const safeActiveIndex =
    SLIDE_COUNT <= 1
      ? 0
      : ((activeIndex % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;

  React.useEffect(() => {
    if (activeIndex !== safeActiveIndex) {
      setActiveIndex(safeActiveIndex);
    }
  }, [activeIndex, safeActiveIndex]);

  const activeSlide = SLIDES[safeActiveIndex];
  const slideStepPct = 100 / SLIDE_COUNT;
  const trackOffsetPct = safeActiveIndex * slideStepPct;

  return (
    <>
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="welcome-carousel-track flex h-full"
          style={{
            width: `${SLIDE_COUNT * 100}%`,
            transform: `translate3d(-${trackOffsetPct}%, 0, 0)`,
          }}
        >
          {SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className="relative h-full shrink-0 overflow-hidden"
              style={{ width: `${slideStepPct}%` }}
              aria-hidden={index !== safeActiveIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static files from /public */}
              <img
                src={slide.src}
                alt={index === safeActiveIndex ? slide.alt : ""}
                className={`h-full w-full object-cover ${
                  index === safeActiveIndex && !reduceMotion
                    ? "welcome-carousel-slide-active"
                    : ""
                }`}
                decoding="async"
                loading="eager"
                draggable={false}
              />
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.28) 100%)",
          }}
          aria-hidden
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-20"
        role="region"
        aria-roledescription="carousel"
        aria-label="Welcome highlights"
        onKeyDown={onControlsKeyDown}
      >
        <p className="sr-only" aria-live="polite">
          Slide {safeActiveIndex + 1} of {SLIDE_COUNT}: {activeSlide.alt}
        </p>

        <button
          type="button"
          className="pointer-events-auto absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50 sm:left-5"
          onClick={goPrev}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <button
          type="button"
          className="pointer-events-auto absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50 sm:right-5"
          onClick={goNext}
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>

        <div
          className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2"
          role="tablist"
          aria-label="Choose slide"
        >
          {SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === safeActiveIndex}
              aria-label={`Go to slide ${index + 1}: ${slide.alt}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === safeActiveIndex
                  ? "w-6 bg-white"
                  : "w-2.5 bg-white/45 hover:bg-white/70"
              }`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
