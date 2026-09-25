"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, ErrorText, Field, fmtDateTime, fmtNum, inputClass, Loading, Modal, PageTitle, StatCard, Table, td, th } from "@/components/admin/ui";
import { CacheStats, getCacheStats, getDatabaseInfo, getSystemHealth, LIVE, purgeCache, ServiceStatus, setCacheTtl, TableInfo } from "@/lib/adminApi";

// System Administrator (Fig. 11): Monitor System Health, Manage Database
// Configuration, Manage Session Cache (Redis). Health checks for FastAPI,
// PostgreSQL and Redis call the real /health endpoints when not in mock mode.

type Db = Awaited<ReturnType<typeof getDatabaseInfo>>;

export default function SystemPage() {
  const [health, setHealth] = useState<ServiceStatus[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purge, setPurge] = useState<"expired" | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [ttl, setTtl] = useState("");

  const refreshHealth = useCallback(() => {
    getSystemHealth()
      .then((h) => {
        setHealth(h);
        setCheckedAt(new Date());
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refreshHealth();
    getCacheStats().then((c) => {
      setCache(c);
      setTtl(String(c.ttl_minutes));
    });
    getDatabaseInfo().then(setDb);
    const t = setInterval(refreshHealth, 30000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  async function doPurge() {
    if (!purge) return;
    setBusy(true);
    try {
      setCache(await purgeCache(purge));
      setPurge(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTtl() {
    const n = Number(ttl);
    if (!Number.isInteger(n) || n < 5 || n > 240) {
      setError("Session TTL must be a whole number between 5 and 240 minutes.");
      return;
    }
    await setCacheTtl(n);
    setCache((c) => (c ? { ...c, ttl_minutes: n } : c));
    setError(null);
  }

  const up = health?.filter((h) => h.status === "up").length ?? 0;
  const modules = db ? [...new Set(db.tables.map((t) => t.module))] : [];

  return (
    <>
      <PageTitle
        title="System Health"
        description="Status of the backend services, the PostgreSQL database and the Redis session cache."
        actions={<Btn variant="secondary" onClick={refreshHealth}>Re-check now</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <div className="space-y-4">
        <Card title="Services" subtitle={checkedAt ? `Checked ${checkedAt.toLocaleTimeString("en-PH")} · refreshes every 30 s` : undefined} actions={health ? <Badge tone={up === health.length ? "green" : "amber"} dot>{up}/{health.length} healthy</Badge> : undefined}>
          {!health ? (
            <Loading label="Checking services…" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {health.map((s) => (
                <div key={s.name} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <Badge tone={s.status === "up" ? "green" : s.status === "degraded" ? "amber" : "red"} dot>
                      {s.status === "up" ? "Operational" : s.status === "degraded" ? "Degraded" : "Down"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" title={s.detail}>{s.detail}</p>
                  <p className="mt-2 text-xs tabular-nums text-gray-400">{s.latency_ms != null ? `${s.latency_ms} ms response` : "No response"}</p>
                </div>
              ))}
            </div>
          )}
          {LIVE.health && <p className="mt-3 text-[11px] text-gray-400">NLP, scoring and SMS rows are sample values until those services expose a health endpoint.</p>}
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-2" title="Redis session cache" subtitle="Chat state is kept here only while a citizen is active, then purged (RA 10173).">
            {!cache ? (
              <Loading />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Active chat sessions" value={cache.active_sessions} />
                  <StatCard label="Keys in cache" value={fmtNum(cache.keys)} hint={`${cache.memory_mb} MB used`} tone="gray" />
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{fmtNum(cache.purged_today)} session keys purged today.</p>
                <div className="mt-4 flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Idle session timeout (minutes)" hint="Inactive chats are wiped after this long.">
                      {(id) => <input id={id} type="number" min={5} max={240} className={inputClass} value={ttl} onChange={(e) => setTtl(e.target.value)} />}
                    </Field>
                  </div>
                  <Btn variant="secondary" className="mb-[22px]" onClick={saveTtl} disabled={ttl === String(cache.ttl_minutes)}>Save</Btn>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                  <Btn variant="secondary" onClick={() => setPurge("expired")}>Purge expired sessions</Btn>
                  <Btn variant="danger" onClick={() => setPurge("all")}>Flush entire cache</Btn>
                </div>
              </>
            )}
          </Card>

          <Card className="xl:col-span-3" title="PostgreSQL" subtitle={db ? `Connection pool ${db.pool_in_use}/${db.pool_size} in use · last backup ${fmtDateTime(db.last_backup)}` : undefined}>
            {!db ? (
              <Loading />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Table</th>
                    <th className={th}>Module</th>
                    <th className={`${th} text-right`}>Rows</th>
                    <th className={`${th} text-right`}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.flatMap((m) =>
                    db.tables
                      .filter((t: TableInfo) => t.module === m)
                      .map((t: TableInfo) => (
                        <tr key={t.table}>
                          <td className={td}><code className="font-mono text-[12px]">{t.table}</code></td>
                          <td className={`${td} text-gray-500`}>{t.module}</td>
                          <td className={`${td} text-right tabular-nums`}>{fmtNum(t.rows)}</td>
                          <td className={`${td} text-right tabular-nums text-gray-500`}>{t.size_kb >= 1024 ? `${(t.size_kb / 1024).toFixed(1)} MB` : `${t.size_kb} KB`}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-[11px] text-gray-400">Row counts are sample values until a database-stats endpoint exists.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={!!purge}
        onClose={() => setPurge(null)}
        title={purge === "all" ? "Flush the entire session cache?" : "Purge expired sessions?"}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setPurge(null)}>Cancel</Btn>
            <Btn variant={purge === "all" ? "danger" : "primary"} onClick={doPurge} disabled={busy}>{busy ? "Working…" : purge === "all" ? "Flush cache" : "Purge"}</Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {purge === "all"
            ? `This ends all ${cache?.active_sessions ?? 0} active citizen chats immediately. They'll need to start their assessment again. This can't be undone.`
            : "Removes chat state for sessions that have already gone idle. Active chats are not affected."}
        </p>
      </Modal>
    </>
  );
}
