/**
 * Carousel images must live in pos-app/public/welcome/
 * and use paths starting with /welcome/ (served from /public).
 * Supported formats: JPG, JPEG, PNG, WebP.
 */
export const WELCOME_CAROUSEL_SLIDES = [
  { id: "p1", src: "/welcome/1.webp", alt: "Palm oil operations" },
  { id: "p2", src: "/welcome/2.webp", alt: "Sales and agriculture" },
  { id: "p3", src: "/welcome/3.jpg", alt: "Agricultural landscape" },
  { id: "p4", src: "/welcome/4.jpg", alt: "Palm plantation" },
] as const;
