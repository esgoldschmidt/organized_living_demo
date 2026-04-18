"use client";
import ClosetExperience3D from "@/components/ClosetExperience3D";
import Toolbar from "@/components/Toolbar";

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#dfe7e0]">
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar />
        <ClosetExperience3D />
      </div>
    </div>
  );
}
