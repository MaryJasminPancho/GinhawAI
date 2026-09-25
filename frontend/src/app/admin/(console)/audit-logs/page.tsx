"use client";

import { useEffect, useState } from "react";
import { Badge, Btn, Card, downloadCsv, EmptyState, ErrorText, fmtDateTime, inputClass, Loading, PageTitle, Table, td, th, Toggle } from "@/components/admin/ui";
import { AuditLog, getAuditLogs } from "@/lib/adminApi";

// "View Administrative Audit Logs" (Fig. 9) + System Audit & Compliance Trail
// modules: view consolidated trail, export compliance reports, flag anomalous
// access patterns. Rows are immutable — there is no edit or delete here.

const ACTION_TONE: Record<string, "green" | "amber" | "red" | "blue" | "gray" | "brand"> = {
  INSERT: "green",
  UPDATE: "blue",
  DELETE: "amber",
  FAILED_LOGIN: "red",
  PURGE: "brand",
  LOGIN: "gray",
  LOGOUT: "gray",
};

const PAGE = 25;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [table, setTable] = useState("all");
  const [user, setUser] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    getAuditLogs().then(setLogs).catch((e) => setError(e.message));
  }, []);

  const uniq = (k: keyof AuditLog) => [...new Set((logs ?? []).map((l) => String(l[k])))].sort();
  const filtered = (logs ?? []).filter(
    (l) =>
      (action === "all" || l.action_type === action) &&
      (table === "all" || l.target_table === table) &&
      (user === "all" || l.username === user) &&
      (!flaggedOnly || l.flagged) &&
      (!q || `${l.old_value} ${l.new_value} ${l.target_table} ${l.username}`.toLowerCase().includes(q.toLowerCase()))
  );
  const flaggedCount = (logs ?? []).filter((l) => l.flagged).length;

  function exportCsv() {
    downloadCsv(`ginhawai-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["timestamp", "user", "action", "table", "old_value", "new_value", "flag"],
      ...filtered.map((l) => [l.timestamp, l.username, l.action_type, l.target_table, l.old_value, l.new_value, l.flag_reason ?? ""]),
    ]);
  }

  return (
    <>
      <PageTitle
        title="Audit Logs"
        description="Every change to rules, schedules, offices and accounts — who made it, when, and what it was before. Entries can't be edited or deleted."
        actions={<Btn variant="secondary" onClick={exportCsv} disabled={!logs}>Export compliance CSV</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      {flaggedCount > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-800 ring-1 ring-red-200 sm:flex-row sm:items-center sm:justify-between dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/20">
          <span>
            <strong>{flaggedCount} events flagged</strong> — repeated failed sign-ins or activity outside office hours. Review them with the account owners.
          </span>
          <Btn variant="danger" onClick={() => setFlaggedOnly(true)}>Review flagged</Btn>
        </div>
      )}

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_190px_150px_auto]">
          <input type="search" aria-label="Search" placeholder="Search values…" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Action" className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>
            {uniq("action_type").map((a) => <option key={a}>{a}</option>)}
          </select>
          <select aria-label="Table" className={`${inputClass} font-mono text-xs`} value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="all">All tables</option>
            {uniq("target_table").map((a) => <option key={a}>{a}</option>)}
          </select>
          <select aria-label="User" className={inputClass} value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="all">All users</option>
            {uniq("username").map((a) => <option key={a}>{a}</option>)}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap px-1 text-[13px] text-gray-600 dark:text-gray-300">
            <Toggle checked={flaggedOnly} onChange={setFlaggedOnly} label="Flagged only" />
            Flagged only
          </label>
        </div>

        {!logs && !error && <Loading />}
        {logs && filtered.length === 0 && <EmptyState title="No matching entries" />}
        {filtered.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>User</th>
                <th className={th}>Action</th>
                <th className={th}>Table</th>
                <th className={th}>Change</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, shown).map((l) => (
                <tr key={l.audit_id} className={l.flagged ? "bg-red-50/60 dark:bg-red-500/[0.06]" : "hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{fmtDateTime(l.timestamp)}</td>
                  <td className={`${td} font-medium`}>{l.username}</td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={ACTION_TONE[l.action_type] ?? "gray"}>{l.action_type.replace("_", " ")}</Badge>
                      {l.flagged && <span title={l.flag_reason}><Badge tone="red" dot>Flagged</Badge></span>}
                    </div>
                  </td>
                  <td className={td}>
                    <code className="font-mono text-[12px]">{l.target_table}</code>
                  </td>
                  <td className={`${td} max-w-md`}>
                    {l.old_value && <p className="text-xs text-gray-400 line-through decoration-gray-300 dark:text-gray-500">{l.old_value}</p>}
                    {l.new_value && <p className="text-xs text-gray-800 dark:text-gray-200">{l.new_value}</p>}
                    {l.flag_reason && <p className="mt-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">{l.flag_reason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {filtered.length > shown && (
          <div className="mt-4 text-center">
            <Btn variant="secondary" onClick={() => setShown(shown + PAGE)}>Show more ({filtered.length - shown} left)</Btn>
          </div>
        )}
      </Card>
    </>
  );
}
