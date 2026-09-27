import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { HeroBanner } from "@/components/HeroBanner";
import { QuestList } from "@/components/QuestList";
import { StreakCalendar } from "@/components/StreakCalendar";
import { Leaderboard } from "@/components/Leaderboard";
import { BossBattleCard } from "@/components/BossBattleCard";
import { ContinueLearning } from "@/components/ContinueLearning";
import { RecommendedForYou } from "@/components/RecommendedForYou";
import { LandingPage } from "@/components/LandingPage";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LandingPage />;

  return (
    <Shell>
      <TopBar />

      {/* Two-column layout: left scrolls with page, right panel is independently sticky */}
      <div className="flex gap-6 items-start min-h-0">
        {/* Left column — fills available width, normal document flow */}
        <div className="flex flex-col gap-6 min-w-0 flex-1">
          <HeroBanner />
          <ContinueLearning />
          <RecommendedForYou />
        </div>

        {/* Right column — fixed-height viewport, scrolls on its own, never tied to left */}
        <aside className="hidden xl:flex flex-col gap-5 w-[316px] shrink-0 sticky top-6 h-[calc(100vh-5rem)] overflow-y-auto pb-6 scrollbar-hide">
          <Leaderboard />
          <QuestList />
          <StreakCalendar />
          <BossBattleCard />
        </aside>
      </div>
    </Shell>
  );
}
