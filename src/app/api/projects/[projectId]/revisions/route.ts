import { createRevision } from "@/lib/designPersistence";
import { DesignSnapshotSchema } from "@/types";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const snapshot = DesignSnapshotSchema.parse(body.snapshot);
    const revision = await createRevision(projectId, snapshot);

    return NextResponse.json(
      {
        projectId,
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
        snapshot: revision.snapshot,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create revision", error);
    return NextResponse.json(
      { error: "Failed to create revision" },
      { status: 500 }
    );
  }
}
