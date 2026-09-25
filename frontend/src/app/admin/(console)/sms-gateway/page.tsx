"use client";

import { FormEvent, useEffect, useState } from "react";
import { ColumnChart } from "@/components/admin/charts";
import { Badge, Btn, Card, ErrorText, Field, fmtDate, fmtDateTime, fmtMonth, fmtNum, fmtPct, inputClass, Loading, Modal, PageTitle, SampleDataNotice, StatCard, Table, td, th, Toggle } from "@/components/admin/ui";
import { getSmsGateway, getSmsStats, LIVE, sendTestSms, SmsGatewayConfig, SmsLog, SmsMonth, updateSmsGateway } from "@/lib/adminApi";
import { programShort } from "@/lib/adminAnalytics";

// "Provision SMS Gateway Access Tokens" (Fig. 11) + Semaphore SMS Gateway
// Pipeline module "Monitor SMS Notification Center Dashboard".
// The SMS channel is one-way: citizens receive checklists but can't reply.

export default function SmsGatewayPage() {
  const [cfg, setCfg] = useState<SmsGatewayConfig | null>(null);
  const [stats, setStats] = useState<{ months: SmsMonth[]; recent: SmsLog[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ sender_name: "", webhook_url: "" });
  const [rotating, setRotating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    Promise.all([getSmsGateway(), getSmsStats()])
      .then(([c, s]) => {
        setCfg(c);
        setForm({ sender_name: c.sender_name, webhook_url: c.webhook_url });
        setStats(s);
        setNow(Date.now());
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9 ]{1,11}$/.test(form.sender_name)) {
      setError("Sender name must be 1–11 letters or numbers (carrier limit).");
      return;
    }
    try {
      setCfg(await updateSmsGateway(form));
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleEnabled(v: boolean) {
    if (!v && !confirm("Pause all outgoing SMS? Citizens won't receive checklists until you turn it back on.")) return;
    setCfg(await updateSmsGateway({ enabled: v }));
  }

  const last = stats?.months[stats.months.length - 1];
  const rate = last ? last.delivered / (last.delivered + last.failed) : 0;
  const keyAgeDays = cfg ? Math.floor((now - new Date(cfg.key_created_at).getTime()) / 864e5) : 0;

  return (
    <>
      <PageTitle title="SMS Gateway" description="Semaphore API credentials and delivery monitoring for the document checklist and office directory messages sent to citizens." />
      {!LIVE.smsGateway && <SampleDataNotice what="The SMS gateway settings" />}
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!cfg && !error && <Loading />}

      {cfg && stats && last && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gateway" value={cfg.enabled ? "Sending" : "Paused"} hint="Semaphore · one-way" tone={cfg.enabled ? "brand" : "red"} />
            <StatCard label={`Delivery rate · ${fmtMonth(last.month)}`} value={fmtPct(rate)} hint={`${fmtNum(last.failed)} failed`} tone={rate >= 0.95 ? "brand" : "amber"} />
            <StatCard label="Credits remaining" value={fmtNum(cfg.credits_remaining)} hint={`≈ ${Math.floor(cfg.credits_remaining / Math.max(1, (last.delivered + last.failed) / 30))} days at current volume`} tone={cfg.credits_remaining < 1000 ? "red" : "gray"} />
            <StatCard label="API key age" value={`${keyAgeDays} days`} hint={keyAgeDays > 90 ? "Rotation recommended (> 90 days)" : `Rotated ${fmtDate(cfg.key_created_at)}`} tone={keyAgeDays > 90 ? "amber" : "gray"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Gateway configuration" actions={<Toggle checked={cfg.enabled} onChange={toggleEnabled} label="SMS sending enabled" />}>
              <form onSubmit={save} className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">API key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-xl bg-gray-100 px-3 py-2 font-mono text-[13px] dark:bg-white/10">{cfg.api_key_masked}</code>
                    <Btn variant="secondary" onClick={() => setRotating(true)}>Rotate key</Btn>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Stored encrypted on the server. The full key is never shown again.</p>
                </div>
                <Field label="Sender name" hint="Up to 11 characters; must be registered with Semaphore.">
                  {(id) => <input id={id} className={`${inputClass} font-mono uppercase`} maxLength={11} value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value.toUpperCase() })} />}
                </Field>
                <Field label="Delivery status webhook">{(id) => <input id={id} type="url" className={`${inputClass} font-mono text-xs`} value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} />}</Field>
                <div className="flex items-center justify-end gap-3">
                  {saved && <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Saved ✓</span>}
                  <Btn type="submit">Save changes</Btn>
                </div>
              </form>
              <TestSms />
            </Card>

            <Card title="Delivery success per month" subtitle="Share of messages the carrier confirmed as delivered">
              <ColumnChart ariaLabel="SMS delivery success rate per month" data={stats.months.map((m) => ({ label: fmtMonth(m.month), value: m.delivered / (m.delivered + m.failed), sub: `${fmtNum(m.delivered + m.failed)} sent` }))} format={(v) => fmtPct(v, 0)} />
            </Card>
          </div>

          <Card title="Recent messages" subtitle="Recipient numbers are masked before they're logged (RA 10173)">
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
                    <td className={td}>{programShort(s.program_id)}</td>
                    <td className={td}>
                      <Badge tone={s.delivery_status === "DELIVERED" ? "green" : s.delivery_status === "FAILED" ? "red" : "amber"} dot>{s.delivery_status.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      <RotateKeyModal open={rotating} onClose={() => setRotating(false)} onRotated={(c) => { setCfg(c); setRotating(false); }} />
    </>
  );
}

function TestSms() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await sendTestSms(number);
      setResult({ ok: true, text: `Test message ${r.status.toLowerCase()}.` });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Send a test message</p>
      <div className="flex gap-2">
        <input aria-label="Mobile number" inputMode="tel" placeholder="09XX XXX XXXX" className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} />
        <Btn type="submit" variant="secondary" disabled={busy || !number}>{busy ? "Sending…" : "Send"}</Btn>
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
      title="Rotate Semaphore API key"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="rotate-form" disabled={busy}>{busy ? "Saving…" : "Replace key"}</Btn>
        </>
      }
    >
      <form id="rotate-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">Generate a new key in the Semaphore dashboard, paste it here, then revoke the old key there. Messages already queued will use the new key.</p>
        <Field label="New API key">{(id) => <input id={id} type="password" autoComplete="off" className={`${inputClass} font-mono`} value={key} onChange={(e) => setKey(e.target.value)} />}</Field>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
