"use client";

import { FormEvent, useEffect, useState } from "react";
import { ColumnChart } from "@/components/admin/charts";
import { Badge, Btn, Card, EmptyState, ErrorText, Field, fmtDate, fmtDateTime, fmtMonth, fmtNum, fmtPct, inputClass, Loading, Modal, PageTitle, StatCard, Table, td, th, Toggle } from "@/components/admin/ui";
import { getSmsGateway, getSmsStats, sendTestSms, shortProgramName, SmsGatewayConfig, SmsLog, SmsMonth, updateSmsGateway } from "@/lib/adminApi";

// "Provision SMS Gateway Access Tokens" (Fig. 11) + Semaphore SMS Gateway
// Pipeline module "Monitor SMS Notification Center Dashboard".
// The SMS channel is one-way: citizens receive checklists but can't reply.

export default function SmsGatewayPage() {
  const [cfg, setCfg] = useState<SmsGatewayConfig | null>(null);
  const [stats, setStats] = useState<{ months: SmsMonth[]; recent: SmsLog[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sender, setSender] = useState("");
  const [rotating, setRotating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    Promise.all([getSmsGateway(), getSmsStats(12)])
      .then(([c, s]) => {
        setCfg(c);
        setSender(c.sender_name);
        setStats(s);
        setNow(Date.now());
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9 ]{1,11}$/.test(sender)) {
      setError("Sender name must be 1–11 letters or numbers (carrier limit).");
      return;
    }
    try {
      setCfg(await updateSmsGateway({ sender_name: sender }));
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleEnabled(v: boolean) {
    if (!v && !confirm("Pause all outgoing SMS? Citizens won't receive checklists until you turn it back on.")) return;
    try {
      setCfg(await updateSmsGateway({ enabled: v }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const last = stats?.months[stats.months.length - 1];
  const lastTotal = last ? last.sent + last.failed : 0;
  const rate = lastTotal ? last!.sent / lastTotal : null;
  const keyAgeDays = cfg?.key_updated_at ? Math.floor((now - new Date(cfg.key_updated_at).getTime()) / 864e5) : null;
  const anySms = stats?.months.some((m) => m.sent + m.failed > 0);

  return (
    <>
      <PageTitle title="SMS Gateway" description="Semaphore API credentials and delivery monitoring for the document checklist and office directory messages sent to citizens." />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!cfg && !error && <Loading />}

      {cfg && stats && (
        <div className="space-y-4">
          {!cfg.configured && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
              <strong>No Semaphore API key yet.</strong> Citizens can still see and save their checklist, but “Send via SMS” will fail until you add a key with <em>Set API key</em> below.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gateway" value={!cfg.configured ? "Not set up" : cfg.enabled ? "Sending" : "Paused"} hint="Semaphore · one-way" tone={cfg.configured && cfg.enabled ? "brand" : "red"} />
            <StatCard label={last ? `Success rate · ${fmtMonth(last.month)}` : "Success rate"} value={rate === null ? "—" : fmtPct(rate)} hint={lastTotal ? `${fmtNum(last!.failed)} failed of ${fmtNum(lastTotal)}` : "No messages this month"} tone={rate === null || rate >= 0.95 ? "brand" : "amber"} />
            <StatCard label="Credits remaining" value={cfg.credits_remaining == null ? "—" : fmtNum(cfg.credits_remaining)} hint={cfg.configured ? (cfg.credits_remaining == null ? "Couldn't reach Semaphore" : "Live from Semaphore") : "Add an API key first"} tone={cfg.credits_remaining != null && cfg.credits_remaining < 500 ? "red" : "gray"} />
            <StatCard label="API key age" value={keyAgeDays === null ? "—" : `${keyAgeDays} days`} hint={cfg.key_source === "environment variable" ? "Set via SEMAPHORE_API_KEY" : keyAgeDays !== null && keyAgeDays > 90 ? "Rotation recommended (> 90 days)" : cfg.key_updated_at ? `Set ${fmtDate(cfg.key_updated_at)}` : undefined} tone={keyAgeDays !== null && keyAgeDays > 90 ? "amber" : "gray"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Gateway configuration" actions={<Toggle checked={cfg.enabled} onChange={toggleEnabled} label="SMS sending enabled" />}>
              <form onSubmit={save} className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">API key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-xl bg-gray-100 px-3 py-2 font-mono text-[13px] dark:bg-white/10">{cfg.api_key_masked ?? "Not set"}</code>
                    <Btn variant="secondary" onClick={() => setRotating(true)}>{cfg.configured ? "Rotate key" : "Set API key"}</Btn>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Only the last 4 characters are ever shown.{cfg.key_source ? ` Source: ${cfg.key_source}.` : ""}</p>
                </div>
                <Field label="Sender name" hint="Up to 11 characters; must be registered with Semaphore.">
                  {(id) => <input id={id} className={`${inputClass} font-mono uppercase`} maxLength={11} value={sender} onChange={(e) => setSender(e.target.value.toUpperCase())} />}
                </Field>
                <div className="flex items-center justify-end gap-3">
                  {saved && <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Saved ✓</span>}
                  <Btn type="submit" disabled={sender === cfg.sender_name}>Save sender name</Btn>
                </div>
              </form>
              <TestSms disabled={!cfg.configured} />
            </Card>

            <Card title="Success rate per month" subtitle="Share of checklist messages the gateway accepted">
              {anySms ? (
                <ColumnChart ariaLabel="SMS success rate per month" data={stats.months.map((m) => ({ label: fmtMonth(m.month), value: m.sent + m.failed ? m.sent / (m.sent + m.failed) : 0, sub: `${fmtNum(m.sent + m.failed)} attempts` }))} format={(v) => fmtPct(v, 0)} />
              ) : (
                <EmptyState title="No messages yet">Citizens&apos; checklist SMS will show up here.</EmptyState>
              )}
            </Card>
          </div>

          <Card title="Recent messages" subtitle="Recipient numbers are masked before they're logged (RA 10173)">
            {stats.recent.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Sent</th>
                    <th className={th}>Recipient</th>
                    <th className={th}>Checklist</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((s) => (
                    <tr key={s.sms_id}>
                      <td className={`${td} tabular-nums`}>{fmtDateTime(s.sent_at)}</td>
                      <td className={`${td} font-mono`}>{s.masked_recipient}</td>
                      <td className={td}>{shortProgramName(s.program_name)}</td>
                      <td className={td}><Badge tone={s.delivery_status === "FAILED" ? "red" : "green"} dot>{s.delivery_status.toLowerCase()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      <RotateKeyModal open={rotating} onClose={() => setRotating(false)} onRotated={(c) => { setCfg(c); setRotating(false); }} />
    </>
  );
}

function TestSms({ disabled }: { disabled: boolean }) {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await sendTestSms(number);
      setResult({ ok: true, text: "Test message accepted by Semaphore. It should arrive within a minute." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Send a test message (uses 1 credit)</p>
      <div className="flex gap-2">
        <input aria-label="Mobile number" inputMode="tel" placeholder="09XX XXX XXXX" className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} disabled={disabled} />
        <Btn type="submit" variant="secondary" disabled={disabled || busy || !number}>{busy ? "Sending…" : "Send"}</Btn>
      </div>
      {result && <p className={`mt-2 text-xs font-medium ${result.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>{result.text}</p>}
    </form>
  );
}

function RotateKeyModal({ open, onClose, onRotated }: { open: boolean; onClose: () => void; onRotated: (c: SmsGatewayConfig) => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (key.trim().length < 16) {
      setError("That doesn't look like a Semaphore API key.");
      return;
    }
    setBusy(true);
    try {
      onRotated(await updateSmsGateway({ api_key: key.trim() }));
      setKey("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Semaphore API key"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="rotate-form" disabled={busy}>{busy ? "Saving…" : "Save key"}</Btn>
        </>
      }
    >
      <form id="rotate-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">Copy the API key from your Semaphore account (semaphore.co → Account → API). If you&apos;re replacing an old key, revoke it in Semaphore afterwards.</p>
        <Field label="API key">{(id) => <input id={id} type="password" autoComplete="off" className={`${inputClass} font-mono`} value={key} onChange={(e) => setKey(e.target.value)} />}</Field>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
