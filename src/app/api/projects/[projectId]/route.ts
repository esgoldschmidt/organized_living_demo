import { getProjectWithLatestRevision } from "@/lib/designPersistence";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const project = await getProjectWithLatestRevision(projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      status: project.status,
      latestRevision: project.revisions[0] ?? null,
      space: project.spaces[0] ?? null,
      scans: project.scanSessions,
    });
  } catch (error) {
    console.error("Failed to load project", error);
    return NextResponse.json(
      { error: "Failed to load project" },
      { status: 500 }
    );
  }
}
