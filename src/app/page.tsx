import HomeHero from "@/components/HomeHero";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div>
      <HomeHero />
      <TaskBoard />
    </div>
  );
}
