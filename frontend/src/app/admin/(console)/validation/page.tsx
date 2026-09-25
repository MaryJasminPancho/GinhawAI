"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { Badge, Btn, Card, downloadCsv, ErrorText, fmtNum, fmtPct, Loading, PageTitle, SampleDataNotice, Segmented, StatCard, TIER_META, TierBadge } from "@/components/admin/ui";
import { getModelTiers, getRatings, getValidationCases, LIVE, Rating, submitRating, SyntheticCase, Tier, TIERS } from "@/lib/adminApi";

// "Conduct Blind Cross-Validation Testing" → "Evaluate Synthetic Profile Cases" (Fig. 9).
// Per the manuscript's AI Model Validation Framework: 3–5 licensed social workers
// classify 30–50 synthetic household profiles as low / moderate / high without
// seeing the model's answer. Agreement with the XGBoost engine is measured with
// a confusion matrix, accuracy and Cohen's kappa (target ≥ 0.60).

const KAPPA_TARGET = 0.6;

function cohensKappa(pairs: [Tier, Tier][]) {
  const n = pairs.length;
  if (n === 0) return { kappa: 0, accuracy: 0, matrix: TIERS.map(() => TIERS.map(() => 0)) };
  const idx = (t: Tier) => TIERS.indexOf(t);
  const matrix = TIERS.map(() => TIERS.map(() => 0)); // [model][human]
  for (const [m, h] of pairs) matrix[idx(m)][idx(h)]++;
  const po = TIERS.reduce((a, _, i) => a + matrix[i][i], 0) / n;
  const pe = TIERS.reduce((a, _, i) => {
    const row = matrix[i].reduce((x, y) => x + y, 0);
    const col = matrix.reduce((x, r) => x + r[i], 0);
    return a + (row / n) * (col / n);
  }, 0);
  return { kappa: pe === 1 ? 1 : (po - pe) / (1 - pe), accuracy: po, matrix };
}

// Landis & Koch bands, used in the manuscript's success criteria.
function kappaBand(k: number) {
  if (k >= 0.81) return "Almost perfect";
  if (k >= 0.61) return "Substantial";
  if (k >= 0.41) return "Moderate";
  if (k >= 0.21) return "Fair";
  return "Slight";
}

function consensus(tiers: Tier[]): Tier | null {
  if (tiers.length === 0) return null;
  const counts = TIERS.map((t) => tiers.filter((x) => x === t).length);
  const max = Math.max(...counts);
  const winners = TIERS.filter((_, i) => counts[i] === max);
  if (winners.length === 1) return winners[0];
  // Tie: take the median rating.
  const sorted = [...tiers].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b));
  return sorted[Math.floor(sorted.length / 2)];
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export default function ValidationPage() {
  const { session, group } = useAdmin();
  const [cases, setCases] = useState<SyntheticCase[] | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [model, setModel] = useState<Record<string, Tier> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"rate" | "results">("rate");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    Promise.all([getValidationCases(), getRatings()])
      .then(([c, r]) => {
        setCases(c);
        setRatings(r);
        // Start at the first case this rater hasn't done yet.
        const mine = new Set(r.filter((x) => x.rater === session.username).map((x) => x.case_id));
        const first = c.findIndex((x) => !mine.has(x.case_id));
        setIndex(first < 0 ? 0 : first);
      })
      .catch((e) => setError(e.message));
  }, [session.username]);

  const mine = useMemo(() => new Map(ratings.filter((r) => r.rater === session.username).map((r) => [r.case_id, r.tier])), [ratings, session.username]);
  const done = cases ? cases.every((c) => mine.has(c.case_id)) : false;
  // Keep the test blind: raters only see the model after finishing their own set.
  const canSeeResults = done || group === "sysadmin";

  useEffect(() => {
    if (view === "results" && canSeeResults && !model) getModelTiers().then(setModel).catch((e) => setError(e.message));
  }, [view, canSeeResults, model]);

  const rate = useCallback(
    async (tier: Tier) => {
      if (!cases) return;
      const c = cases[index];
      setRatings((rs) => [...rs.filter((r) => !(r.case_id === c.case_id && r.rater === session.username)), { case_id: c.case_id, rater: session.username, tier }]);
      if (index < cases.length - 1) setIndex(index + 1);
      try {
        await submitRating(c.case_id, tier);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save rating");
      }
    },
    [cases, index, session.username]
  );

  // Keyboard: 1 = high, 2 = moderate, 3 = low, ←/→ to move.
  useEffect(() => {
    if (view !== "rate" || !cases) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "1") rate("high");
      else if (e.key === "2") rate("moderate");
      else if (e.key === "3") rate("low");
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(cases!.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, cases, rate]);

  return (
    <>
      <PageTitle
        title="Blind Cross-Validation"
        description="Classify each synthetic household the way you would with your usual risk-assessment matrix. You won't see the AI's answer until you finish — that keeps the comparison fair."
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "rate", label: "Rate cases" },
              { value: "results", label: "Results" },
            ]}
          />
        }
      />
      {!LIVE.validation && <SampleDataNotice what="The validation panel" />}
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!cases && !error && <Loading />}

      {cases && view === "rate" && <RateView cases={cases} index={index} setIndex={setIndex} mine={mine} rate={rate} onDone={() => setView("results")} done={done} />}
      {cases && view === "results" && (canSeeResults ? model ? <ResultsView cases={cases} ratings={ratings} model={model} /> : <Loading label="Loading model results…" /> : (
        <Card className="text-center">
          <p className="text-[15px] font-semibold">Results are locked until you finish rating</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You&apos;ve rated {mine.size} of {cases.length} cases. The model&apos;s classifications stay hidden so they can&apos;t influence your judgment.
          </p>
          <Btn className="mt-4" onClick={() => setView("rate")}>Continue rating</Btn>
        </Card>
      ))}
    </>
  );
}

function RateView({ cases, index, setIndex, mine, rate, onDone, done }: { cases: SyntheticCase[]; index: number; setIndex: (i: number) => void; mine: Map<string, Tier>; rate: (t: Tier) => void; onDone: () => void; done: boolean }) {
  const c = cases[index];
  const chosen = mine.get(c.case_id);
  const perCapita = Math.round(c.monthly_income / Math.max(1, c.household_size));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              Case {index + 1} of {cases.length}
            </p>
            <h2 className="font-mono text-lg font-bold text-gray-900 dark:text-white">{c.case_id}</h2>
          </div>
          {chosen && <TierBadge tier={chosen} />}
        </div>

        <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500" style={{ width: `${(mine.size / cases.length) * 100}%` }} />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Household size", `${c.household_size} ${c.household_size === 1 ? "person" : "people"}`],
            ["Children (0–18)", String(c.children_0_18)],
            ["Monthly income", peso(c.monthly_income)],
            ["Per person", `${peso(perCapita)} / mo`],
            ["Employment", c.employment_status],
            ["Housing", c.housing_type],
            ["Barangay", c.barangay],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04]">
              <dt className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{k}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold capitalize text-gray-900 dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.crisis && <Badge tone="red">Crisis: {c.crisis}</Badge>}
          {c.special.map((s) => (
            <Badge key={s} tone="blue">{s}</Badge>
          ))}
          {!c.crisis && c.special.length === 0 && <span className="text-xs text-gray-400">No special circumstances reported.</span>}
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold text-gray-600 dark:text-gray-300">Your classification</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TIERS.map((t, i) => {
            const m = TIER_META[t];
            const active = chosen === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => rate(t)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active ? "text-white shadow-sm ring-transparent" : "bg-white text-gray-800 ring-gray-200 hover:bg-gray-50 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10 dark:hover:bg-white/10"
                }`}
                style={active ? { background: m.color } : undefined}
              >
                <span className="flex items-center gap-2">
                  {!active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />}
                  {m.label}
                </span>
                <kbd className={`rounded-md px-1.5 text-[11px] font-mono ${active ? "bg-white/20" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>{i + 1}</kbd>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Btn variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</Btn>
          {done ? <Btn onClick={onDone}>See results →</Btn> : <Btn variant="secondary" disabled={index === cases.length - 1} onClick={() => setIndex(index + 1)}>Skip →</Btn>}
        </div>
      </Card>

      <Card title="Your progress" subtitle={`${mine.size} of ${cases.length} rated`} className="h-fit">
        <div className="grid grid-cols-6 gap-1.5">
          {cases.map((x, i) => {
            const t = mine.get(x.case_id);
            return (
              <button
                key={x.case_id}
                type="button"
                onClick={() => setIndex(i)}
                title={`${x.case_id}${t ? ` · ${TIER_META[t].label}` : " · not rated"}`}
                aria-label={`${x.case_id}${t ? `, rated ${TIER_META[t].label}` : ", not rated"}`}
                className={`aspect-square rounded-lg text-[10px] font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${i === index ? "ring-2 ring-brand-600 ring-offset-1 dark:ring-offset-[#0a0f0c]" : ""} ${t ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"}`}
                style={t ? { background: TIER_META[t].color } : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">Shortcuts: 1 High · 2 Moderate · 3 Low · ← → to move between cases.</p>
      </Card>
    </div>
  );
}

function ResultsView({ cases, ratings, model }: { cases: SyntheticCase[]; ratings: Rating[]; model: Record<string, Tier> }) {
  const raters = [...new Set(ratings.map((r) => r.rater))];
  const byCase = new Map<string, Tier[]>();
  for (const r of ratings) byCase.set(r.case_id, [...(byCase.get(r.case_id) ?? []), r.tier]);

  const pairs: [Tier, Tier][] = [];
  for (const c of cases) {
    const h = consensus(byCase.get(c.case_id) ?? []);
    if (h && model[c.case_id]) pairs.push([model[c.case_id], h]);
  }
  const overall = cohensKappa(pairs);
  const perRater = raters.map((rater) => {
    const p: [Tier, Tier][] = ratings.filter((r) => r.rater === rater && model[r.case_id]).map((r) => [model[r.case_id], r.tier]);
    return { rater, n: p.length, ...cohensKappa(p) };
  });
  const passed = overall.kappa >= KAPPA_TARGET;

  function exportCsv() {
    downloadCsv("ginhawai-blind-validation.csv", [
      ["case_id", "model_tier", "panel_consensus", ...raters],
      ...cases.map((c) => [c.case_id, model[c.case_id], consensus(byCase.get(c.case_id) ?? []), ...raters.map((r) => ratings.find((x) => x.case_id === c.case_id && x.rater === r)?.tier ?? "")]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cohen's kappa (model vs panel)" value={overall.kappa.toFixed(2)} hint={`${kappaBand(overall.kappa)} agreement`} tone={passed ? "brand" : "red"} />
        <StatCard label="Accuracy" value={fmtPct(overall.accuracy)} hint={`${fmtNum(pairs.length)} cases compared`} />
        <StatCard label="Panelists" value={raters.length} hint="Target: 3–5 licensed social workers" tone={raters.length >= 3 ? "brand" : "amber"} />
        <StatCard label="Success criterion" value={passed ? "Met" : "Not met"} hint={`κ ≥ ${KAPPA_TARGET.toFixed(2)} required`} tone={passed ? "brand" : "red"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Confusion matrix" subtitle="Rows: XGBoost model · Columns: panel consensus (majority vote)" actions={<Btn variant="secondary" onClick={exportCsv}>Export CSV</Btn>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-separate border-spacing-1 text-center text-[13px]">
              <thead>
                <tr>
                  <th />
                  {TIERS.map((t) => (
                    <th key={t} className="pb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      Panel: {TIER_META[t].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((m, i) => {
                  const rowMax = Math.max(1, ...overall.matrix.flat());
                  return (
                    <tr key={m}>
                      <th className="pr-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400">Model: {TIER_META[m].label}</th>
                      {TIERS.map((h, j) => {
                        const v = overall.matrix[i][j];
                        const diag = i === j;
                        return (
                          <td
                            key={h}
                            title={`Model ${TIER_META[m].label} / Panel ${TIER_META[h].label}: ${v}`}
                            className={`h-14 rounded-xl text-base font-bold tabular-nums ${diag ? "text-brand-900 dark:text-brand-100" : "text-gray-700 dark:text-gray-300"}`}
                            style={{ background: diag ? `rgba(63,171,121,${0.15 + (v / rowMax) * 0.6})` : v ? `rgba(148,163,184,${0.1 + (v / rowMax) * 0.4})` : "transparent" }}
                          >
                            {v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Green diagonal = cases where the model and the panel agree.</p>
        </Card>

        <Card title="Agreement per panelist" subtitle="Each rater's kappa against the model">
          <ul className="space-y-3">
            {perRater.map((r) => (
              <li key={r.rater}>
                <div className="mb-1 flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{r.rater}</span>
                  <span className="tabular-nums">
                    <strong className="text-gray-900 dark:text-white">κ {r.kappa.toFixed(2)}</strong>
                    <span className="ml-2 text-gray-400">{r.n} cases · {kappaBand(r.kappa)}</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-gray-100 dark:bg-white/5">
                  <div className={`h-full rounded-full ${r.kappa >= KAPPA_TARGET ? "bg-brand-500" : "bg-amber-500"}`} style={{ width: `${Math.max(0, r.kappa) * 100}%` }} />
                  <div className="absolute inset-y-[-3px] w-0.5 bg-gray-900 dark:bg-white" style={{ left: `${KAPPA_TARGET * 100}%` }} title="Target 0.60" />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Black tick marks the 0.60 target (substantial agreement).</p>
        </Card>
      </div>
    </div>
  );
}
