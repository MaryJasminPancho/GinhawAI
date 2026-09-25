/** Soft brand-tinted background wash + two blurred accent blobs, used behind
 * every screen. Render inside a `relative overflow-hidden` container; these
 * pieces sit at -z-10 so normal content doesn't need its own z-index. */
export default function Backdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white dark:from-brand-950/30 dark:via-[#0a0f0c] dark:to-[#0a0f0c]" />
      <div className="pointer-events-none absolute -top-24 -right-16 -z-10 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-700/20" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 -z-10 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-800/10" />
    </>
  );
}