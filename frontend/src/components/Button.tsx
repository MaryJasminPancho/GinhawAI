import { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-[15px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a0f0c] disabled:pointer-events-none disabled:opacity-50";

// NOTE: secondary/ghost use a solid `dark:bg-*` (not a translucent `dark:bg-white/N`)
// on purpose — on a real <button> element, mixing a plain `bg-white` with a
// translucent `dark:bg-white/N` override was observed to sometimes lose the
// dark-mode override depending on the exact class list (ring/hover/transition
// combos). A solid dark background sidesteps it entirely. Cards, links and
// <details> elements don't have this issue — see PageHeader/Card usage.
const variants: Record<ButtonVariant, string> = {
  primary:
    "font-semibold bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm hover:shadow-lg hover:from-brand-500 hover:to-brand-600",
  secondary:
    "font-medium bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-gray-800",
  ghost:
    "font-medium bg-transparent text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5",
};

export function buttonClasses(variant: ButtonVariant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

/** Use for real <button> elements. For a link styled as a button, apply
 * `buttonClasses(variant)` directly to a Next <Link> instead. */
export default function Button({ variant = "primary", className, ...props }: Props) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}