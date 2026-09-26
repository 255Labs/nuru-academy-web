import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { CodeConsoleGame } from "@/components/CodeConsoleGame";

export default function BaobabForestPage() {
  return (
    <Shell>
      <TopBar title="Chapter 2: Baobab Forest" subtitle="2.3 — Avoid the Spikes" />
      <CodeConsoleGame />
    </Shell>
  );
}
