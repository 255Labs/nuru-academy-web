"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Table, TR, TD, Badge, Btn, Toast, Spinner } from "@/components/admin/ui";

interface Mentor {
  user_id: string; display_name: string; email: string;
  bio: string; specialties: string[]; hourly_rate_tzs: number;
  approved: boolean; available: boolean; created_at: string;
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useCallback((m: string, e = false) => { if (e) setErr(m); else setMsg(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_list_mentors");
    setMentors((data ?? []) as Mentor[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(userId: string, approved: boolean) {
    await createClient().rpc("admin_set_mentor_approved", { p_user_id: userId, p_approved: approved });
    setMentors((m) => m.map((x) => x.user_id === userId ? { ...x, approved } : x));
    toast(approved ? "Mentor approved" : "Mentor rejected");
  }

  const pending = mentors.filter((m) => !m.approved).length;

  return (
    <div className="space-y-5">
      <Toast msg={msg} err={err} onClear={() => { setMsg(null); setErr(null); }} />
      <PageHeader title="Mentors" subtitle={`${pending} pending approval`}
        action={<Btn label="Refresh" icon={RefreshCw} variant="outline" size="sm" onClick={load} />} />

      {loading ? <Spinner /> : (
        <Table headers={["Mentor", "Specialties", "Rate", "Status", "Applied", ""]} empty={mentors.length === 0}>
          {mentors.map((m) => (
            <TR key={m.user_id}>
              <TD>
                <div className="font-semibold text-white/80 text-xs">{m.display_name}</div>
                <div className="text-white/25 text-[11px]">{m.email}</div>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {m.specialties.map((s) => <Badge key={s} label={s} color="purple" />)}
                </div>
              </TD>
              <TD muted>{m.hourly_rate_tzs === 0 ? "Volunteer" : `${m.hourly_rate_tzs.toLocaleString()} TZS/hr`}</TD>
              <TD><Badge label={m.approved ? "Approved" : "Pending"} color={m.approved ? "green" : "amber"} /></TD>
              <TD muted>{new Date(m.created_at).toLocaleDateString()}</TD>
              <TD>
                <div className="flex gap-1.5">
                  <Btn label="" icon={CheckCircle} variant="ghost" size="sm" onClick={() => approve(m.user_id, true)} />
                  <Btn label="" icon={XCircle} variant="danger" size="sm" onClick={() => approve(m.user_id, false)} />
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      )}
    </div>
  );
}
