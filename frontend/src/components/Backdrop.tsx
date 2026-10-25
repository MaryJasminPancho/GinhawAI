/** Brand background used behind every citizen screen: a soft green wash with blurred
 * green, teal and warm sun-yellow accents. Render inside a `relative overflow-hidden`
 * container; these pieces sit at -z-10 so normal content doesn't need its own z-index. */
export default function Backdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-100 via-white to-amber-50 dark:from-brand-950/60 dark:via-[#07110c] dark:to-[#0b0f0a]" />
      <div className="pointer-events-none absolute -top-32 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-brand-300/50 blur-3xl dark:bg-brand-600/25" />
      <div className="pointer-events-none absolute top-1/3 -left-40 -z-10 h-[26rem] w-[26rem] rounded-full bg-teal-200/50 blur-3xl dark:bg-teal-700/15" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 -z-10 h-[24rem] w-[24rem] rounded-full bg-amber-200/60 blur-3xl dark:bg-amber-500/10" />
      {/* faint dot grid for texture on large screens */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden opacity-[0.35] [background-image:radial-gradient(circle,rgba(10,112,73,0.18)_1px,transparent_1px)] [background-size:22px_22px] sm:block dark:opacity-20" />
    </>
  );
}
