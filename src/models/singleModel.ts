import { DEFAULT_CTX } from "../constants";
import { Mode } from "../enums/mode";
import { Status } from "../enums/status";
import { PropsEndpoint } from "../interfaces/endpoints/props";
import { SlotsEndpoint } from "../interfaces/endpoints/slots";
import { rpc } from "../tools/retriever";
import { BaseModel } from "./baseModel";

export class SingleModel extends BaseModel {
  private contextSize?: number;

  get mode(): Mode {
    return Mode.SINGLE;
  }

  async getStatus(): Promise<Status> {
    // In single-mode, the extension will only work when the model is fully loaded
    const { is_sleeping } = await rpc<PropsEndpoint>("/props");
    if (is_sleeping) return Status.SLEEPING;

    return Status.LOADED;
  }

  async getContextSize(): Promise<number> {
    // Avoid calling the endpoint if we already have the value
    if (this.contextSize) return this.contextSize;

    try {
      const [{ n_ctx }] = await rpc<SlotsEndpoint[]>("/slots");
      this.contextSize = n_ctx;

      return this.contextSize;
    } catch {
      return DEFAULT_CTX;
    }
  }
}
