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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-6 min-w-0">
          <HeroBanner />
          <ContinueLearning />
          <RecommendedForYou />
        </div>

        {/* Right column — sticky, scrolls independently */}
        <div className="flex flex-col gap-6 sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto pb-4 scrollbar-hide">
          <Leaderboard />
          <QuestList />
          <StreakCalendar />
          <BossBattleCard />
        </div>
      </div>
    </Shell>
  );
}
