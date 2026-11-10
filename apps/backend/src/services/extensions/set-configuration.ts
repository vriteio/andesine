import { toUUID } from "@andesine/contracts/primitives";
import { extensionConfigurations, extensions } from "@andesine/server/database";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { resolveDisabledReason, getExtensionManifest } from "@andesine/server/extensions";
import { writeConfiguration } from "#backend/lib/extensions/configuration";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";

interface SetConfigurationInput {
  extensionID: string;
  values: Record<string, unknown>;
  secrets?: Record<string, string | null>;
  expectedRevision: number;
}
interface SetConfigurationResult {
  revision: number;
}

/** Missing required fields disable the extension until completed (`configuration_required`). */
const setConfiguration = withAuthorization<
  SetConfigurationInput,
  undefined,
  SetConfigurationResult
>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const [extension] = await database
      .select()
      .from(extensions)
      .where(
        and(
          eq(extensions.id, toUUID(input.extensionID)),
          eq(extensions.workspaceID, workspaceID),
          isNull(extensions.uninstalledAt),
          isVisibleExtension(auth)
        )
      )
      .for("update");

    if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    await database
      .insert(extensionConfigurations)
      .values({ extensionID: extension.id })
      .onConflictDoNothing();

    const [current] = await database
      .select({ revision: extensionConfigurations.revision })
      .from(extensionConfigurations)
      .where(eq(extensionConfigurations.extensionID, extension.id))
      .for("update");

    if (current.revision !== input.expectedRevision) {
      throw new ORPCError("CONFLICT", {
        message: "The configuration changed. Reload and try again."
      });
    }

    const schema = (await getExtensionManifest(database, extension))?.configuration;
    const { revision, changedKeys } = await writeConfiguration(
      database,
      extension.id,
      schema,
      input
    );

    await transitionExtension(database, extension, {
      event: "extension.configured",
      set: { disabledReason: await resolveDisabledReason(database, extension) },
      configuredKeys: changedKeys
    });

    return { revision };
  }
);

export { setConfiguration };
