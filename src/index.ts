import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { modelsCommand, notFoundCommand } from "./commands/models";
import { PROVIDER_NAME } from "./constants";
import { onModelSelect } from "./events";
import { registerLlamaCppProvider } from "./tools/provider";
import { isServerReady } from "./tools/retriever";

export default async function (pi: ExtensionAPI) {
  // Server verification
  if (!(await isServerReady())) {
    pi.registerCommand("models", {
      description: `${PROVIDER_NAME} models (offline)`,
      handler: async (_: string, ctx: ExtensionCommandContext) => {
        await notFoundCommand(ctx);
      },
    });

    return;
  }

  // Provider registration
  const serverModels = await registerLlamaCppProvider(pi);

  // Command: /models
  pi.registerCommand("models", {
    description: `Browse ${PROVIDER_NAME} models (live status)`,
    handler: async (_: string, ctx: ExtensionCommandContext) =>
      await modelsCommand(ctx, pi, serverModels),
  });

  // Events registration
  pi.on("model_select", onModelSelect);
}
