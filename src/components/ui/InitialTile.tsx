import { cn } from "@/lib/utils";

type TileAspect = "square" | "portrait" | "wide";
type TileTone = "light" | "dark";

const ASPECTS: Record<TileAspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  wide: "aspect-[16/10]",
};

/**
 * Brand fallback visual for entities without an image (instructors, albums,
 * works, posts): the first letter on a subtle ink/red gradient so cards never
 * render as empty holes and keep equal heights in grids and carousels.
 */
export function InitialTile({
  name,
  aspect = "wide",
  tone = "light",
  className,
}: {
  name: string;
  aspect?: TileAspect;
  tone?: TileTone;
  className?: string;
}) {
  const initial = name.trim().charAt(0) || "•";
  return (
    <div
      aria-hidden
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 overflow-hidden",
        ASPECTS[aspect],
        tone === "dark"
          ? "bg-[linear-gradient(140deg,rgba(23,23,23,0.96),rgba(23,23,23,0.72)_55%,rgba(215,25,32,0.5))]"
          : "bg-[linear-gradient(140deg,rgba(244,242,237,1),rgba(228,224,214,1)_60%,rgba(215,25,32,0.22))]",
        className,
      )}
    >
      <span
        className={cn(
          "font-extrabold leading-none",
          aspect === "portrait" ? "text-6xl" : "text-5xl",
          tone === "dark" ? "text-ivory/25" : "text-ink/15",
        )}
      >
        {initial}
      </span>
      <span className={cn("h-px w-10", tone === "dark" ? "bg-red/60" : "bg-red/50")} aria-hidden />
    </div>
  );
}
