import { Prisma, RevisionSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DesignSnapshot } from "@/types";

function countComponents(snapshot: DesignSnapshot) {
  return snapshot.components.length;
}

function totalPrice(snapshot: DesignSnapshot) {
  return snapshot.components.reduce((sum, component) => {
    return sum + (component.priceEach ?? 0);
  }, 0);
}

function defaultProjectName(snapshot: DesignSnapshot) {
  return `Closet Concept ${snapshot.dimensions.width}x${snapshot.dimensions.height}`;
}

function toJsonSnapshot(snapshot: DesignSnapshot) {
  return snapshot as unknown as Prisma.InputJsonValue;
}

export async function createProjectWithRevision(snapshot: DesignSnapshot) {
  const project = await prisma.project.create({
    data: {
      name: defaultProjectName(snapshot),
      status: "designing",
      spaces: {
        create: {
          name: "Primary Closet",
          widthInches: snapshot.dimensions.width,
          heightInches: snapshot.dimensions.height,
        },
      },
    },
    include: {
      spaces: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  const space = project.spaces[0];

  const revision = await prisma.designRevision.create({
    data: {
      projectId: project.id,
      spaceId: space.id,
      revisionNumber: 1,
      name: "Initial concept",
      source: RevisionSource.manual,
      dimensionsWidth: snapshot.dimensions.width,
      dimensionsHeight: snapshot.dimensions.height,
      totalPrice: totalPrice(snapshot),
      componentCount: countComponents(snapshot),
      snapshot: toJsonSnapshot(snapshot),
      pricingSnapshot: {
        totalPrice: totalPrice(snapshot),
      },
    },
  });

  return { project, revision };
}

export async function getProjectWithLatestRevision(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      spaces: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
      revisions: {
        orderBy: {
          revisionNumber: "desc",
        },
        take: 1,
      },
      scanSessions: {
        orderBy: {
          capturedAt: "desc",
        },
        take: 3,
      },
    },
  });
}

export async function listProjectsForLoad() {
  return prisma.project.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    take: 10,
    include: {
      revisions: {
        orderBy: {
          revisionNumber: "desc",
        },
        take: 10,
      },
    },
  });
}

export async function createRevision(projectId: string, snapshot: DesignSnapshot) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      spaces: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
      revisions: {
        orderBy: {
          revisionNumber: "desc",
        },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const space =
    project.spaces[0] ??
    (await prisma.space.create({
      data: {
        projectId: project.id,
        name: "Primary Closet",
        widthInches: snapshot.dimensions.width,
        heightInches: snapshot.dimensions.height,
      },
    }));

  await prisma.space.update({
    where: { id: space.id },
    data: {
      widthInches: snapshot.dimensions.width,
      heightInches: snapshot.dimensions.height,
    },
  });

  return prisma.designRevision.create({
    data: {
      projectId: project.id,
      spaceId: space.id,
      revisionNumber: (project.revisions[0]?.revisionNumber ?? 0) + 1,
      name: `Revision ${(project.revisions[0]?.revisionNumber ?? 0) + 1}`,
      source: RevisionSource.manual,
      dimensionsWidth: snapshot.dimensions.width,
      dimensionsHeight: snapshot.dimensions.height,
      totalPrice: totalPrice(snapshot),
      componentCount: countComponents(snapshot),
      snapshot: toJsonSnapshot(snapshot),
      pricingSnapshot: {
        totalPrice: totalPrice(snapshot),
      },
    },
  });
}
