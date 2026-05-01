import { DEFAULT_CTX } from "../constants";
import { Mode } from "../enums/mode";
import { Status } from "../enums/status";
import { DataProperty, ModelsEndpoint } from "../interfaces/endpoints/models";
import { rpc } from "../tools/retriever";
import { BaseModel } from "./baseModel";

export class RouterModel extends BaseModel {
  constructor(protected readonly model: DataProperty) {
    super(model);
  }

  get mode(): Mode {
    return Mode.ROUTER;
  }

  get capabilities(): ["text"] | ["image"] {
    const hasImage = this.model.status!.args?.includes("--mmproj") ?? false;
    return hasImage ? ["image"] : ["text"];
  }

  async getStatus(): Promise<Status> {
    const { data } = await rpc<ModelsEndpoint>("/models");
    const model = data.find((m) => m.id === this.id);
    if (!model) return Status.FAILED;

    const status = this.statusMapper[model.status!.value];
    if (status === Status.UNLOADED) {
      if (this.model.status!.failed) return Status.FAILED;

      return Status.UNLOADED;
    }

    return status;
  }

  async getContextSize(): Promise<number> {
    let response = this.extractFrom("--ctx-size");
    if (response) return response;

    response = this.extractFrom("--fit-ctx");
    if (response) return response;

    return DEFAULT_CTX;
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
