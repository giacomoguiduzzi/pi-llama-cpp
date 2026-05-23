import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { onSessionBeforeSwitch } from "./commands/models";
import { PROVIDER_NAME } from "./constants";
import { onModelSelect } from "./events";
import { CommandManager } from "./manager";

export default async function (pi: ExtensionAPI) {
  const manager = new CommandManager(pi);
  await manager.initialize();

  // Command: /models
  pi.registerCommand("models", {
    description: `Browse ${PROVIDER_NAME} models`,
    handler: async (args: string, ctx: ExtensionCommandContext) =>
      await manager.run(args, ctx),
  });

  // Events registration
  pi.on("model_select", onModelSelect);
  pi.on("session_before_switch", onSessionBeforeSwitch);
}
