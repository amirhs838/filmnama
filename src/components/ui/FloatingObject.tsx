"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface FloatingObjectProps {
  children: ReactNode;
  className?: string;
  /** vertical drift distance in px */
  distance?: number;
  duration?: number;
  delay?: number;
  /** subtle idle rotation in degrees */
  rotate?: number;
}

/**
 * Absolutely-positioned decorative element with a very slow,
 * barely-visible drift. Hidden from assistive tech, non-interactive,
 * and frozen when the user prefers reduced motion.
 */
export function FloatingObject({
  children,
  className,
  distance = 10,
  duration = 7,
  delay = 0,
  rotate = 0,
}: FloatingObjectProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute select-none ${className ?? ""}`}
      animate={
        reduce
          ? undefined
          : {
              y: [0, -distance, 0],
              rotate: rotate ? [0, rotate, 0] : undefined,
            }
      }
      transition={
        reduce
          ? undefined
          : { duration, delay, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {children}
    </motion.div>
  );
}
