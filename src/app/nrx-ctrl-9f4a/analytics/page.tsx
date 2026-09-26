"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Baby } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Spinner } from "@/components/admin/ui";

interface Demo { age_tier: string; display_lang: string; count: number; }

const AGE_LABELS: Record<string, string> = {
  child: "Explorer (6–12)", teen: "Challenger (13–17)",
  adult: "Learner (18+)", professional: "Professional", unknown: "Unknown",
};
const LANG_LABELS: Record<string, string> = {
  en: "English", sw: "Swahili", fr: "French",
  am: "Amharic", ha: "Hausa", yo: "Yoruba", zu: "Zulu",
};

export default function AnalyticsPage() {
  const [demographics, setDemographics] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_demographics");
    setDemographics((data ?? []) as Demo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = demographics.reduce((a, d) => a + Number(d.count), 0);

  function Bar({ label, count, color = "#6B4EFF" }: { label: string; count: number; color?: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-28 text-xs text-white/40 truncate shrink-0">{label}</div>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="text-xs text-white/30 w-8 text-right tabular-nums">{count}</div>
      </div>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle="Learner demographics and language distribution" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Age tiers" subtitle={`${total} total learners`}>
          {["child","teen","adult","professional","unknown"].map((tier) => {
            const count = demographics.filter((d) => d.age_tier === tier).reduce((a, d) => a + Number(d.count), 0);
            return <Bar key={tier} label={AGE_LABELS[tier] ?? tier} count={count} color="#6B4EFF" />;
          })}
        </Card>
        <Card title="Languages" subtitle="Interface language preference">
          {["en","sw","fr","am","ha","yo","zu"].map((code, i) => {
            const count = demographics.filter((d) => d.display_lang === code).reduce((a, d) => a + Number(d.count), 0);
            const colors = ["#6B4EFF","#22C55E","#3B82F6","#F5B942","#EF4444","#8B5CF6","#06B6D4"];
            return <Bar key={code} label={LANG_LABELS[code] ?? code} count={count} color={colors[i]} />;
          })}
        </Card>
      </div>
    </div>
  );
}
