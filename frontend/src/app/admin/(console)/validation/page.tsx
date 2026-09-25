"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { Badge, Btn, Card, downloadCsv, EmptyState, ErrorText, Field, fmtNum, fmtPct, inputClass, Loading, Modal, PageTitle, Segmented, StatCard, TIER_META, TierBadge } from "@/components/admin/ui";
import { generateValidationCases, getModelTiers, getRatings, getValidationCases, Rating, resetValidationCases, submitRating, SyntheticCase, Tier, TIERS } from "@/lib/adminApi";

// "Conduct Blind Cross-Validation Testing" → "Evaluate Synthetic Profile Cases" (Fig. 9).
// Per the manuscript's AI Model Validation Framework: 3–5 licensed social workers
// classify 30–50 synthetic household profiles as low / moderate / high without
// seeing the scoring engine's answer. Agreement is measured with a confusion
// matrix, accuracy and Cohen's kappa (target ≥ 0.60). The backend only releases
// the engine's answers after a rater finishes, so the test stays blind.

const KAPPA_TARGET = 0.6;

function cohensKappa(pairs: [Tier, Tier][]) {
  const n = pairs.length;
  const matrix = TIERS.map(() => TIERS.map(() => 0)); // [model][human]
  if (n === 0) return { kappa: 0, accuracy: 0, matrix };
  const idx = (t: Tier) => TIERS.indexOf(t);
  for (const [m, h] of pairs) matrix[idx(m)][idx(h)]++;
  const po = TIERS.reduce((a, _, i) => a + matrix[i][i], 0) / n;
  const pe = TIERS.reduce((a, _, i) => {
    const row = matrix[i].reduce((x, y) => x + y, 0);
    const col = matrix.reduce((x, r) => x + r[i], 0);
    return a + (row / n) * (col / n);
  }, 0);
  return { kappa: pe === 1 ? 1 : (po - pe) / (1 - pe), accuracy: po, matrix };
}

// Landis & Koch agreement bands.
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
  const sorted = [...tiers].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b));
  return sorted[Math.floor(sorted.length / 2)]; // tie → median rating
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const LABEL: Record<string, string> = {
  employed: "regular job", self_employed: "own small business", informal: "daily wage / odd jobs", seasonal: "seasonal work",
  underemployed: "not enough work", unemployed: "no work", displaced: "recently lost job",
  owned: "own house", rented: "renting", with_relatives: "living with relatives", informal_settler: "informal settler",
  medical: "medical emergency", death: "death in the family", fire: "fire", calamity: "flood / typhoon", job_loss: "sudden loss of income",
};

export default function ValidationPage() {
  const { session, group } = useAdmin();
  const [cases, setCases] = useState<SyntheticCase[] | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [model, setModel] = useState<Record<string, Tier> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"rate" | "results">("rate");
  const [index, setIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    Promise.all([getValidationCases(), getRatings()])
      .then(([c, r]) => {
        setCases(c);
        setRatings(r);
        setModel(null);
        const mine = new Set(r.filter((x) => x.rater === session.username).map((x) => x.case_id));
        const first = c.findIndex((x) => !mine.has(x.case_id));
        setIndex(first < 0 ? 0 : first);
      })
      .catch((e) => setError(e.message));
  }, [session.username]);
  useEffect(load, [load]);

  const mine = useMemo(() => new Map(ratings.filter((r) => r.rater === session.username).map((r) => [r.case_id, r.tier])), [ratings, session.username]);
  const done = !!cases && cases.length > 0 && cases.every((c) => mine.has(c.case_id));
  const canSeeResults = done || group === "sysadmin";

  useEffect(() => {
    if (view === "results" && canSeeResults && !model) {
      // After finishing, reload ratings too — the backend now returns every panelist's.
      Promise.all([getModelTiers(), getRatings()])
        .then(([m, r]) => {
          setModel(m);
          setRatings(r);
        })
        .catch((e) => setError(e.message));
    }
  }, [view, canSeeResults, model]);

  const rate = useCallback(
    async (tier: Tier) => {
      if (!cases?.length) return;
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

  useEffect(() => {
    if (view !== "rate" || !cases?.length) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, dialog")) return;
      if (e.key === "1") rate("high");
      else if (e.key === "2") rate("moderate");
      else if (e.key === "3") rate("low");
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(cases!.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, cases, rate]);

  async function reset() {
    if (!confirm("Delete every test case and all panel ratings? This starts the validation over.")) return;
    try {
      await resetValidationCases();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Blind Cross-Validation"
        description="Classify each synthetic household the way you would with your usual risk-assessment matrix. You won't see the scoring engine's answer until you finish — that keeps the comparison fair."
        actions={
          <>
            <Btn variant="secondary" onClick={() => setGenerating(true)}>+ Generate cases</Btn>
            {group === "sysadmin" && cases && cases.length > 0 && <Btn variant="danger" onClick={reset}>Reset</Btn>}
            {cases && cases.length > 0 && (
              <Segmented label="View" value={view} onChange={setView} options={[{ value: "rate", label: "Rate cases" }, { value: "results", label: "Results" }]} />
            )}
          </>
        }
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!cases && !error && <Loading />}

      {cases && cases.length === 0 && (
        <EmptyState title="No test cases yet">
          Generate 30–50 synthetic household profiles to start the panel review (manuscript: Blind Cross-Validation Evaluation Protocol).
        </EmptyState>
      )}

      {cases && cases.length > 0 && view === "rate" && <RateView cases={cases} index={index} setIndex={setIndex} mine={mine} rate={rate} onDone={() => setView("results")} done={done} />}
      {cases && cases.length > 0 && view === "results" &&
        (canSeeResults ? (
          model ? <ResultsView cases={cases} ratings={ratings} model={model} /> : <Loading label="Loading engine results…" />
        ) : (
          <Card className="text-center">
            <p className="text-[15px] font-semibold">Results are locked until you finish rating</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You&apos;ve rated {mine.size} of {cases.length} cases. The engine&apos;s classifications stay hidden so they can&apos;t influence your judgment.
            </p>
            <Btn className="mt-4" onClick={() => setView("rate")}>Continue rating</Btn>
          </Card>
        ))}

      <GenerateModal open={generating} onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); load(); }} />
    </>
  );
}

function GenerateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState("40");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError("Enter a number from 1 to 100.");
      return;
    }
    setBusy(true);
    try {
      await generateValidationCases(n);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate cases");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate synthetic cases" footer={<><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={go} disabled={busy}>{busy ? "Generating…" : "Generate"}</Btn></>}>
      <p className="text-sm text-gray-600 dark:text-gray-300">Creates random but realistic household profiles (income, household size, work, housing, special circumstances). They contain no real person&apos;s data.</p>
      <Field label="How many cases" hint="The protocol calls for 30–50 in total.">{(id) => <input id={id} type="number" min={1} max={100} className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} />}</Field>
      {error && <ErrorText>{error}</ErrorText>}
    </Modal>
  );
}

function RateView({ cases, index, setIndex, mine, rate, onDone, done }: { cases: SyntheticCase[]; index: number; setIndex: (i: number) => void; mine: Map<string, Tier>; rate: (t: Tier) => void; onDone: () => void; done: boolean }) {
  const c = cases[Math.min(index, cases.length - 1)];
  const chosen = mine.get(c.case_id);
  const perCapita = Math.round(c.monthly_income / Math.max(1, c.household_size));
  const specials = [c.has_children_0_18 && "children 0–18 / pregnant", c.has_pwd && "PWD member", c.is_solo_parent && "solo parent"].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Case {index + 1} of {cases.length}</p>
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
            ["Monthly income", peso(c.monthly_income)],
            ["Per person", `${peso(perCapita)} / mo`],
            ["Main earner's work", LABEL[c.employment_status] ?? c.employment_status],
            ["Housing", LABEL[c.housing_type] ?? c.housing_type],
            ["Applicant age", String(c.age)],
            ["Barangay", c.barangay],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04]">
              <dt className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{k}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold text-gray-900 dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.crisis_type !== "none" && <Badge tone="red">Crisis: {LABEL[c.crisis_type] ?? c.crisis_type}</Badge>}
          {specials.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
          {c.crisis_type === "none" && specials.length === 0 && <span className="text-xs text-gray-400">No special circumstances reported.</span>}
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
                <kbd className={`rounded-md px-1.5 font-mono text-[11px] ${active ? "bg-white/20" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>{i + 1}</kbd>
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
  const passed = pairs.length > 0 && overall.kappa >= KAPPA_TARGET;
  const cellMax = Math.max(1, ...overall.matrix.flat());

  function exportCsv() {
    downloadCsv("ginhawai-blind-validation.csv", [
      ["case_id", "engine_tier", "panel_consensus", ...raters],
      ...cases.map((c) => [c.case_id, model[c.case_id], consensus(byCase.get(c.case_id) ?? []), ...raters.map((r) => ratings.find((x) => x.case_id === c.case_id && x.rater === r)?.tier ?? "")]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cohen's kappa (engine vs panel)" value={pairs.length ? overall.kappa.toFixed(2) : "—"} hint={pairs.length ? `${kappaBand(overall.kappa)} agreement` : "No ratings yet"} tone={passed ? "brand" : "red"} />
        <StatCard label="Accuracy" value={pairs.length ? fmtPct(overall.accuracy) : "—"} hint={`${fmtNum(pairs.length)} cases compared`} />
        <StatCard label="Panelists" value={raters.length} hint="Target: 3–5 licensed social workers" tone={raters.length >= 3 ? "brand" : "amber"} />
        <StatCard label="Success criterion" value={passed ? "Met" : "Not met"} hint={`κ ≥ ${KAPPA_TARGET.toFixed(2)} required`} tone={passed ? "brand" : "red"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Confusion matrix" subtitle="Rows: scoring engine · Columns: panel consensus (majority vote)" actions={<Btn variant="secondary" onClick={exportCsv}>Export CSV</Btn>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-separate border-spacing-1 text-center text-[13px]">
              <thead>
                <tr>
                  <th />
                  {TIERS.map((t) => <th key={t} className="pb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Panel: {TIER_META[t].label}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((m, i) => (
                  <tr key={m}>
                    <th className="pr-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400">Engine: {TIER_META[m].label}</th>
                    {TIERS.map((h, j) => {
                      const v = overall.matrix[i][j];
                      const diag = i === j;
                      return (
                        <td
                          key={h}
                          title={`Engine ${TIER_META[m].label} / Panel ${TIER_META[h].label}: ${v}`}
                          className={`h-14 rounded-xl text-base font-bold tabular-nums ${diag ? "text-brand-900 dark:text-brand-100" : "text-gray-700 dark:text-gray-300"}`}
                          style={{ background: diag ? `rgba(63,171,121,${0.15 + (v / cellMax) * 0.6})` : v ? `rgba(148,163,184,${0.1 + (v / cellMax) * 0.4})` : "transparent" }}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Green diagonal = cases where the engine and the panel agree.</p>
        </Card>

        <Card title="Agreement per panelist" subtitle="Each rater's kappa against the engine">
          {perRater.length === 0 ? (
            <p className="text-sm text-gray-500">No ratings yet.</p>
          ) : (
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
          )}
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">The dark tick marks the 0.60 target (substantial agreement).</p>
        </Card>
      </div>
    </div>
  );
}
