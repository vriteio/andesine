import { visitors } from "@andesine/server/database";
import { type Visitor } from "@andesine/contracts/entities";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import { resolveVisitorEntry, type VisitorEntry } from "#backend/lib/shares";

const renameVisitor = withAuthorization<{ name: string | null }, VisitorEntry, Visitor>(
  {
    actions: ({ resolved }) => ({ entries: [{ action: "entry:read", ...resolved }] }),
    resolve: async ({ auth }) => resolveVisitorEntry(auth)
  },
  async ({ auth, database, input }) => {
    const { visitorID } = auth.visitor!;

    // Signed-in visitors show their account name.
    const [renamed] = await database
      .update(visitors)
      .set({ name: input.name })
      .where(and(eq(visitors.id, toUUID(visitorID)), isNull(visitors.userID)))
      .returning({ id: visitors.id });

    if (!renamed) {
      throw new ORPCError("FORBIDDEN", { message: "Signed-in visitors use their account name" });
    }

    return { id: visitorID, name: input.name };
  }
);

export { renameVisitor };
