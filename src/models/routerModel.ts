import { DEFAULT_CTX } from "../constants";
import { Mode } from "../enums/mode";
import { Status } from "../enums/status";
import { ModelsEndpoint } from "../interfaces/endpoints/models";
import { PropsEndpoint } from "../interfaces/endpoints/props";
import { rpc } from "../tools/retriever";
import { BaseModel } from "./baseModel";

/**
 * Represents a model in llama-server router mode.
 * Tracks per-model status from the /models endpoint and extracts
 * context size from startup arguments when the model is not loaded.
 */
export class RouterModel extends BaseModel {
  get mode(): Mode {
    return Mode.ROUTER;
  }

  async getStatus(): Promise<Status> {
    const { data } = await rpc<ModelsEndpoint>("/models");
    const model = data.find((m) => m.id === this.id);
    if (!model) return Status.FAILED;

    const status = this.statusMapper[model.status!.value];
    if (status === Status.UNLOADED) {
      if (this.model.status!.failed) {
        /**
         * Workaround for the currently-bugged /models status detection
         * (I suspect it was introduced in PR #22683 of llama.cpp)
         *
         * This workaround will show an eternal "loading" status when the model's real status
         * is "failed", which is acceptable, because models in "failed" or "loading" status
         * shouldn't be used.
         *
         * In exchange, it will allow unloaded models to be correctly shown as "unloaded".
         */
        // return Status.FAILED;  // <-- Original implementation
        return await super.getStatus();
      }

      return Status.UNLOADED;
    }

    return status;
  }

  /**
   * Workaround for the currently-bugged /models status detection
   * (I suspect it was introduced in PR #22683 of llama.cpp)
   *
   * @returns The detected status
   */
  private async getStatusWorkaround(): Promise<Status> {
    try {
      const { is_sleeping, error } = await rpc<PropsEndpoint>(
        `/props?model=${this.id}`,
      );

      if (is_sleeping) return Status.SLEEPING;
      if (!error) return Status.LOADED;
      if (error.code === 503) return Status.LOADING;

      return Status.UNLOADED;
    } catch (err) {
      return Status.FAILED;
    }
  }

  async getCapabilities(): Promise<["text"] | ["image"]> {
    // We can get the real capabilities if the model is already loaded
    if ((await this.getStatus()) === Status.LOADED) {
      return super.getCapabilities();
    }

    const hasImage = this.model.status?.args?.includes("--mmproj") ?? false;
    return hasImage ? ["image"] : ["text"];
  }

  async getContextSize(): Promise<number> {
    // We can get a more accurate context size if the model is already loaded
    if ((await this.getStatus()) === Status.LOADED) {
      return super.getContextSize();
    }

    const response =
      this.extractFrom("--ctx-size") ??
      this.extractFrom("--fit-ctx") ??
      DEFAULT_CTX;

    return response;
  }

  /**
   * Extracts the value from a llama-server argument
   * @param arg The argument
   * @returns The value
   */
  private extractFrom(arg: string): number | null {
    const args = this.model.status!.args;
    if (!args) return null;

    const ctxIdx = args.indexOf(arg);

    if (ctxIdx === -1) return null;
    if (args.length <= ctxIdx + 1) return null;

    const parsed = parseInt(args[ctxIdx + 1], 10);
    if (!isNaN(parsed)) return parsed;

    return null;
  }
}
