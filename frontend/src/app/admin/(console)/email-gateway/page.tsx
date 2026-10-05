"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Btn, Card, ErrorText, Field, fmtDateTime, fmtNum, inputClass, Loading, PageTitle, StatCard, Table, td, th, Toggle } from "@/components/admin/ui";
import { EmailGatewayConfig, getEmailGateway, sendTestEmail, shortProgramName, updateEmailGateway } from "@/lib/adminApi";

// Email gateway: how GinhawAI sends messages (SMS is a future enhancement). Citizens can optionally have their
// checklist emailed, and staff receive verification and password-reset codes.
// Sent through a team Gmail account using a Google "app password".

export default function EmailGatewayPage() {
  const [cfg, setCfg] = useState<EmailGatewayConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmailGateway().then(setCfg).catch((e) => setError(e.message));
  }, []);

  async function toggleEnabled(v: boolean) {
    if (!v && !confirm("Pause all outgoing email? Citizens can't email their checklist and staff won't receive codes until you turn it back on.")) return;
    try {
      setCfg(await updateEmailGateway({ enabled: v }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const total = cfg ? cfg.sent_this_month + cfg.failed_this_month : 0;

  return (
    <>
      <PageTitle title="Email Gateway" description="The free way GinhawAI sends messages: citizens' checklists (if they type an email) and staff verification and password-reset codes." />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!cfg && !error && <Loading />}

      {cfg && (
        <div className="space-y-4">
          {!cfg.configured && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
              <strong>Email isn&apos;t set up yet.</strong> Until it is, citizens won&apos;t see the &ldquo;Email my checklist&rdquo; option and staff can&apos;t verify an email address.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Gateway" value={!cfg.configured ? "Not set up" : cfg.enabled ? "Sending" : "Paused"} hint="Free · about 500 emails a day on Gmail" tone={cfg.configured && cfg.enabled ? "brand" : "red"} />
            <StatCard label="Checklists emailed this month" value={fmtNum(cfg.sent_this_month)} hint={total ? `${fmtNum(cfg.failed_this_month)} failed of ${fmtNum(total)}` : "None yet"} tone="gray" />
            <StatCard label="Sending account" value={cfg.smtp_username || "—"} hint={cfg.smtp_host ? `${cfg.smtp_host}:${cfg.smtp_port}` : undefined} tone="gray" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Email account" actions={<Toggle checked={cfg.enabled} onChange={toggleEnabled} label="Email sending enabled" />}>
              <AccountForm cfg={cfg} onSaved={setCfg} />
              <TestEmail disabled={!cfg.configured} />
            </Card>

            <Card title="How to get a Gmail app password" subtitle="One time, on Google's own website. Your real Gmail password is never used.">
              <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                <li>Use a team Gmail account (not someone&apos;s personal one), e.g. <span className="font-mono">ginhawai.lgu@gmail.com</span>.</li>
                <li>Go to <span className="font-mono">myaccount.google.com</span> → <strong>Security</strong> → turn on <strong>2-Step Verification</strong>.</li>
                <li>Go to <span className="font-mono">myaccount.google.com/apppasswords</span>, type the name <strong>GinhawAI</strong> and click <strong>Create</strong>.</li>
                <li>Google shows a 16-letter password. Paste it into <strong>App password</strong> here and save. You can close Google&apos;s window after; you won&apos;t need it again.</li>
                <li>If it ever leaks, delete it on the same Google page and create a new one.</li>
              </ol>
            </Card>
          </div>

          <Card title="Recent checklist emails" subtitle="Addresses are masked before they're logged (RA 10173)">
            {cfg.recent.length === 0 ? (
              <p className="text-sm text-gray-500">No checklist emails yet.</p>
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
                  {cfg.recent.map((e) => (
                    <tr key={e.email_id}>
                      <td className={`${td} tabular-nums`}>{fmtDateTime(e.sent_at)}</td>
                      <td className={`${td} font-mono`}>{e.masked_recipient}</td>
                      <td className={td}>{shortProgramName(e.program_name)}</td>
                      <td className={td}><Badge tone={e.delivery_status === "FAILED" ? "red" : "green"} dot>{e.delivery_status.toLowerCase()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function AccountForm({ cfg, onSaved }: { cfg: EmailGatewayConfig; onSaved: (c: EmailGatewayConfig) => void }) {
  const [username, setUsername] = useState(cfg.smtp_username);
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(cfg.from_name);
  const [advanced, setAdvanced] = useState(false);
  const [host, setHost] = useState(cfg.smtp_host);
  const [port, setPort] = useState(String(cfg.smtp_port));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    username.trim() !== cfg.smtp_username || password !== "" || fromName.trim() !== cfg.from_name || host.trim() !== cfg.smtp_host || port !== String(cfg.smtp_port);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(username.trim())) {
      setError("Enter the full Gmail address, like ginhawai.lgu@gmail.com.");
      return;
    }
    if (!password && !cfg.password_set) {
      setError("Paste the 16-letter app password from Google.");
      return;
    }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port must be a number (465 for Gmail).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      onSaved(
        await updateEmailGateway({
          smtp_username: username.trim(),
          from_name: fromName.trim() || "GinhawAI",
          smtp_host: host.trim(),
          smtp_port: portNum,
          ...(password ? { smtp_password: password } : {}),
        }),
      );
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Gmail address" hint="The account the emails come from.">
        {(id) => <input id={id} type="email" autoComplete="off" placeholder="ginhawai.lgu@gmail.com" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />}
      </Field>
      <Field label="App password" hint={cfg.password_set ? "Saved (stored encrypted). Leave blank to keep it." : "The 16-letter password from Google, not your Gmail password."}>
        {(id) => <input id={id} type="password" autoComplete="new-password" placeholder={cfg.password_set ? "••••••••••••••••" : "abcd efgh ijkl mnop"} className={`${inputClass} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="Sender name" hint="What people see in their inbox.">
        {(id) => <input id={id} maxLength={60} className={inputClass} value={fromName} onChange={(e) => setFromName(e.target.value)} />}
      </Field>
      <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
        {advanced ? "Hide" : "Show"} server settings (only change these if you don&apos;t use Gmail)
      </button>
      {advanced && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="SMTP server">{(id) => <input id={id} className={`${inputClass} font-mono`} value={host} onChange={(e) => setHost(e.target.value)} />}</Field>
          </div>
          <Field label="Port">{(id) => <input id={id} inputMode="numeric" className={`${inputClass} font-mono`} value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))} />}</Field>
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Saved ✓</span>}
        <Btn type="submit" disabled={busy || !changed}>{busy ? "Saving…" : "Save email account"}</Btn>
      </div>
    </form>
  );
}

function TestEmail({ disabled }: { disabled: boolean }) {
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await sendTestEmail(to);
      setResult({ ok: true, text: "Test email sent. Check the inbox (and the spam folder)." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Send a test email</p>
      <div className="flex gap-2">
        <input aria-label="Email address" type="email" placeholder="you@gmail.com" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} disabled={disabled} />
        <Btn type="submit" variant="secondary" disabled={disabled || busy || !to}>{busy ? "Sending…" : "Send"}</Btn>
      </div>
      {result && <p className={`mt-2 text-xs font-medium ${result.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>{result.text}</p>}
    </form>
  );
}
