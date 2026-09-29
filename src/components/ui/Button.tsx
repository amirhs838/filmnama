import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "dark" | "light";
type Size = "md" | "lg" | "sm";

interface ButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  children: ReactNode;
}

const base =
  "group/btn relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-medium transition-colors duration-300 focus-visible:outline-red";

const variants: Record<Variant, string> = {
  primary: "bg-red text-ivory hover:bg-red-deep",
  ghost:
    "border border-line-strong text-ink hover:border-red hover:text-red bg-transparent",
  dark: "bg-ink text-ivory hover:bg-red",
  light:
    "border border-ivory/25 text-ivory hover:border-red hover:text-red bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.8rem]",
  md: "h-11 px-6 text-sm",
  lg: "h-[3.25rem] px-8 text-[0.95rem]",
};

/** Brand button — red accent, subtle arrow slide on hover. */
export function Button({
  variant = "primary",
  size = "md",
  withArrow = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      <span>{children}</span>
      {withArrow && (
        <ArrowLeft
          className="size-4 transition-transform duration-300 ease-(--ease-out-expo) group-hover/btn:-translate-x-1"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </Link>
  );
}
