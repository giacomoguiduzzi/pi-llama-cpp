import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import { PROVIDER_ID, PROVIDER_NAME } from "./constants";
import { Action } from "./enums/action";
import { Mode } from "./enums/mode";
import { Status } from "./enums/status";
import { BaseModel } from "./models/baseModel";

/**
 * Defines a handler when llama-server is running
 * @param ctx Pi context
 * @returns The action and model, if detected
 */
const modelSelectionHandler = async (
  ctx: ExtensionCommandContext,
  models: BaseModel[],
): Promise<{ action: Action; model: BaseModel } | null> => {
  // Setup the labels
  const labels = await Promise.all(models.map((m) => m.getLabel()));

  // Detect the selected model
  const choice = await ctx.ui.select(`${PROVIDER_NAME} models:`, labels);
  if (!choice) return null;

  const idx = labels.indexOf(choice);
  const model = models[idx];

  // Router mode actions
  const routerModeActions: Record<Status, Array<Action>> = {
    [Status.LOADED]: [Action.SWITCH, Action.UNLOAD, Action.INFO, Action.CANCEL],
    [Status.LOADING]: [Action.CANCEL],
    [Status.FAILED]: [Action.RETRY, Action.CANCEL],
    [Status.SLEEPING]: [Action.UNLOAD, Action.INFO, Action.CANCEL],
    [Status.UNLOADED]: [Action.LOAD, Action.CANCEL],
  };

  // Single mode actions (more limited)
  const singleModeActions: Record<Status, Array<Action>> = {
    [Status.LOADED]: [Action.INFO, Action.CANCEL],
    [Status.LOADING]: [Action.CANCEL],
    [Status.FAILED]: [Action.CANCEL],
    [Status.SLEEPING]: [Action.CANCEL],
    [Status.UNLOADED]: [Action.CANCEL],
  };

  // Define the actions that the user can do
  const allActions =
    model.mode === Mode.ROUTER ? routerModeActions : singleModeActions;

  const status = await model.getStatus();
  const actions = allActions[status];

  const action = (await ctx.ui.select(`${model.name}`, actions)) as Action;

  // Send the selected action with the corresponding model
  return { action, model };
};

/**
 * Handles the /models command
 * @param ctx The context used by Pi
 * @param pi The Pi extension
 */
export const modelsCommandHandler = async (
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  models: BaseModel[],
): Promise<void> => {
  const event = await modelSelectionHandler(ctx, models);
  if (!event) return;

  // Detect the model
  const { action, model } = event;

  // Action: Cancel
  if (!action || action === Action.CANCEL) return;

  // Action: Info
  if (action === Action.INFO) {
    const info = await model.getInfo();
    ctx.ui.notify(`${info}`, "info");
    return;
  }

  // Action: Unload
  if (action === Action.UNLOAD) {
    await model.unload();
    ctx.ui.notify(`Unloaded ${model.name}`, "info");
    return;
  }

  // Actions: Load/Switch/Retry
  const loadActions = [Action.LOAD, Action.SWITCH, Action.RETRY];
  if (loadActions.includes(action)) {
    ctx.ui.notify(`Loading ${model.name}...`, "info");

    const onSuccess = async () => {
      const piModel = ctx.modelRegistry.find(PROVIDER_ID, model.id);
      if (!piModel) {
        throw new Error(`Cannot find model ${model.name} in pi registry`);
      }

      if ((await model.getStatus()) === Status.FAILED) {
        throw new Error("Failed to load model");
      }

      await pi.setModel(piModel);
      ctx.ui.notify(`Model ${model.name} ready`, "info");
    };

    const onFailure = (err: any) => {
      const message = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(message, "error");
    };

    // Load the model without blocking the UI
    model.load().then(onSuccess).catch(onFailure);
  }
};
