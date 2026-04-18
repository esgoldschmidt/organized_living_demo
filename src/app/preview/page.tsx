"use client";

import Toolbar from "@/components/Toolbar";
import ClosetExperience3D from "@/components/ClosetExperience3D";

export default function PreviewPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#dfe7e0]">
      <Toolbar />
      <ClosetExperience3D />
    </div>
  );
}
