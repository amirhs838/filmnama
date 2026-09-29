"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  blur?: boolean;
  once?: boolean;
}

/** Scroll-triggered fade-up (with optional blur reveal). Respects reduced motion. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  blur = false,
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y,
        filter: blur ? "blur(8px)" : "blur(0px)",
      }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.75, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — children should use `staggerItem` variants */
export function StaggerGroup({
  children,
  className,
  delay = 0,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT },
  },
};
