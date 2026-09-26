"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import { PageHeader, StatCard, Table, TR, TD, Badge, Btn, Spinner, Card } from "@/components/admin/ui";

interface Revenue { track_id: string; month: string; total_tzs: number; successful_payments: number; pending_payments: number; failed_payments: number; }

export default function RevenuePage() {
  const { tracks } = useTracks();
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_revenue_summary");
    setRevenue((data ?? []) as Revenue[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = revenue.reduce((a, r) => a + Number(r.total_tzs), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Revenue" subtitle="Payment analytics and track performance"
        action={<Btn label="Refresh" icon={RefreshCw} variant="outline" size="sm" onClick={load} />} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tracks.map((track) => {
          const trackRevenue = revenue.filter((r) => r.track_id === track.id);
          const trackTotal = trackRevenue.reduce((a, r) => a + Number(r.total_tzs), 0);
          const count = trackRevenue.reduce((a, r) => a + Number(r.successful_payments), 0);
          return (
            <StatCard key={track.id} icon={DollarSign} label={track.name}
              value={`${(trackTotal / 1000).toFixed(0)}K TZS`}
              sub={`${count} successful payment${count !== 1 ? "s" : ""}`}
              accent={track.tone} />
          );
        })}
      </div>

      {loading ? <Spinner /> : (
        <Table headers={["Month", "Track", "Revenue", "Successful", "Pending", "Failed"]} empty={revenue.length === 0}>
          {revenue.map((r, i) => {
            const track = tracks.find((t) => t.id === r.track_id);
            return (
              <TR key={i}>
                <TD>{r.month}</TD>
                <TD muted>{track?.name ?? r.track_id}</TD>
                <TD><span className="font-semibold text-white/80">{Number(r.total_tzs).toLocaleString()} TZS</span></TD>
                <TD><Badge label={String(r.successful_payments)} color="green" /></TD>
                <TD><Badge label={String(r.pending_payments)} color="amber" /></TD>
                <TD><Badge label={String(r.failed_payments)} color="red" /></TD>
              </TR>
            );
          })}
        </Table>
      )}
    </div>
  );
}
