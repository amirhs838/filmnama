import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  /** zero-padded index, e.g. "01" */
  index: string;
  /** small latin label, e.g. "COURSES" */
  label: string;
  title: string;
  description?: string;
  dark?: boolean;
  align?: "start" | "center";
  className?: string;
  /** Heading level: page headers render h1 (exactly one per page), sections h2. */
  level?: "h1" | "h2";
}

/** Editorial section header: index + latin label + Persian title. */
export function SectionHeading({
  index,
  label,
  title,
  description,
  dark = false,
  align = "start",
  className,
  level = "h2",
}: SectionHeadingProps) {
  const TitleTag = level === "h1" ? "h1" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <Reveal>
        <span
          className={cn(
            "flex items-center gap-3 text-label-latin",
            dark ? "text-fog" : "text-smoke",
            align === "center" && "justify-center"
          )}
          dir="ltr"
        >
          <span className="inline-block size-1.5 bg-red" aria-hidden />
          {index}
          <span
            className={cn("h-px w-8", dark ? "bg-line-light" : "bg-line")}
            aria-hidden
          />
          {label}
        </span>
      </Reveal>
      <Reveal delay={0.08}>
        <TitleTag className={cn(level === "h1" ? "text-h1" : "text-h2", dark ? "text-ivory" : "text-ink")}>
          {title}
        </TitleTag>
      </Reveal>
      {description && (
        <Reveal delay={0.16}>
          <p
            className={cn(
              "text-lead max-w-xl",
              dark ? "text-fog" : "text-smoke"
            )}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
