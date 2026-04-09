import { createProjectWithRevision, listProjectsForLoad } from "@/lib/designPersistence";
import { DesignSnapshotSchema } from "@/types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const projects = await listProjectsForLoad();

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        revisions: project.revisions.map((revision) => ({
          id: revision.id,
          revisionNumber: revision.revisionNumber,
          name: revision.name,
          createdAt: revision.createdAt,
          componentCount: revision.componentCount,
          totalPrice: revision.totalPrice,
          snapshot: revision.snapshot,
        })),
      })),
    });
  } catch (error) {
    console.error("Failed to list projects", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const snapshot = DesignSnapshotSchema.parse(body.snapshot);
    const created = await createProjectWithRevision(snapshot);

    return NextResponse.json(
      {
        projectId: created.project.id,
        revisionId: created.revision.id,
        snapshot: created.revision.snapshot,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create project", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
