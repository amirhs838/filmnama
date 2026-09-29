import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carouselActiveIndex, carouselScrollState, clampCarouselIndex } from "./carousel";

test("carousel scroll state mixes rect edges with normalized scrollLeft", () => {
  const base = { trackRight: 1000, trackLeft: 100, trackWidth: 900, scrollWidth: 2700, clientWidth: 900 };
  const start = carouselScrollState({ firstRight: 1000, lastLeft: -800, scrollLeft: 0, ...base });
  assert.equal(start.atStart, true);
  assert.equal(start.atEnd, false);
  assert.equal(start.progress, 0);
  assert.equal(start.scrollable, true);
  const endChrome = carouselScrollState({ firstRight: 2800, lastLeft: 100, scrollLeft: -1800, ...base });
  assert.equal(endChrome.atStart, false);
  assert.equal(endChrome.atEnd, true);
  assert.equal(endChrome.progress, 1);
  const endSafari = carouselScrollState({ firstRight: 2800, lastLeft: 100, scrollLeft: 1800, ...base });
  assert.equal(endSafari.progress, 1);
  const mid = carouselScrollState({ firstRight: 1900, lastLeft: -800, scrollLeft: -900, ...base });
  assert.equal(mid.atStart, false);
  assert.equal(mid.atEnd, false);
  assert.equal(mid.progress, 0.5);
  const single = carouselScrollState({ firstRight: 1000, lastLeft: 200, scrollLeft: 0, trackRight: 1000, trackLeft: 100, trackWidth: 900, scrollWidth: 900, clientWidth: 900 });
  assert.equal(single.scrollable, false);
  assert.equal(single.atStart, true);
  assert.equal(single.atEnd, true);
});

test("carousel active index picks the nearest center and clamps", () => {
  assert.equal(carouselActiveIndex([100, 300, 500], 290), 1);
  assert.equal(carouselActiveIndex([100, 300, 500], 490), 2);
  assert.equal(carouselActiveIndex([], 0), 0);
  assert.equal(clampCarouselIndex(-2, 5), 0);
  assert.equal(clampCarouselIndex(9, 5), 4);
  assert.equal(clampCarouselIndex(2, 5), 2);
  assert.equal(clampCarouselIndex(0, 0), 0);
});

test("home sections use the shared peek carousel on mobile and grid on desktop", () => {
  for (const [file, label, tone] of [
    ["src/components/home/Instructors.tsx", "اساتید فیلم‌نما", 'tone="ink"'],
    ["src/components/home/Gallery.tsx", "آلبوم‌های گالری", 'tone="ivory"'],
    ["src/components/home/StudentWorks.tsx", "نمونه‌کار هنرجویان", 'tone="ink-2"'],
  ]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("SectionCarousel"), file);
    assert.ok(src.includes(`label="${label}"`), file);
    assert.ok(src.includes(tone), file);
    assert.ok(src.includes("w-[") && src.includes("sm:w-["), `${file} peeks next card on mobile`);
    assert.ok(src.includes("spacerClassName") && src.includes("before:w-[calc("), `${file} centers first and last card`);
    assert.ok(src.includes("md:grid-cols"), `${file} keeps desktop grid`);
  }
  const shared = readFileSync("src/components/ui/SectionCarousel.tsx", "utf8");
  assert.ok(shared.includes('aria-roledescription="carousel"'));
  assert.ok(shared.includes('aria-roledescription="slide"'));
  assert.ok(shared.includes("snap-center") && shared.includes("data-carousel-item"));
  assert.ok(shared.includes("useReducedMotion"));
  assert.ok(shared.includes("size-11"));
  assert.equal(shared.includes("bg-gradient"), false, "no edge fades in minimal design");
  assert.ok(shared.includes("justify-center"), "centered minimal controls");
  assert.ok(shared.includes("toFaDigits(active + 1)"), "persian counter digits");
});
