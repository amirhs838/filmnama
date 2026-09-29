export interface CarouselRects {
  firstRight: number;
  lastLeft: number;
  trackRight: number;
  trackLeft: number;
  trackWidth: number;
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface CarouselScrollState {
  atStart: boolean;
  atEnd: boolean;
  progress: number;
  scrollable: boolean;
}

export function carouselScrollState(rects: CarouselRects): CarouselScrollState {
  const max = Math.max(1, rects.scrollWidth - rects.clientWidth);
  const raw = rects.scrollLeft <= 0 ? -rects.scrollLeft / max : rects.scrollLeft / max;
  const progress = Math.min(1, Math.max(0, raw)) + 0;
  return {
    atStart: rects.firstRight <= rects.trackRight + 2,
    atEnd: rects.lastLeft >= rects.trackLeft - 2,
    progress,
    scrollable: rects.firstRight - rects.lastLeft > rects.trackWidth + 2,
  };
}

export function carouselActiveIndex(childCenters: number[], trackCenter: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (const [index, center] of childCenters.entries()) {
    const dist = Math.abs(center - trackCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

export function clampCarouselIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index));
}
