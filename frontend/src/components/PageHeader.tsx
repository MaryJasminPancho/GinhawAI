import Image from "next/image";

type Props = {
  title: string;
  subtitle?: string;
  /** Current step and total, e.g. step={2} totalSteps={4}. Omit for pages with no progress bar. */
  step?: number;
  totalSteps?: number;
};

/** Small top bar used on every screen after the splash: logo tile, title, and
 * an optional step progress bar for the assessment flow. */
export default function PageHeader({ title, subtitle, step, totalSteps }: Props) {
  const showProgress = !!step && !!totalSteps;

  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5">
            <Image
              src="/logo.png"
              alt="GinhawAI"
              width={243}
              height={313}
              priority
              className="h-7 w-auto"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-800 dark:text-brand-300">{title}</p>
            {subtitle && (
              <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {showProgress && (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-gray-400 dark:text-gray-500">
            Step {step} of {totalSteps}
          </span>
        )}
      </div>

      {showProgress && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500"
            style={{ width: `${(step! / totalSteps!) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}