import { Mode } from "../enums/mode";
import { Status } from "../enums/status";
import { PropsEndpoint } from "../interfaces/endpoints/props";
import { rpc } from "../tools/retriever";
import { BaseModel } from "./baseModel";

export class SingleModel extends BaseModel {
  get mode(): Mode {
    return Mode.SINGLE;
  }

  async getStatus(): Promise<Status> {
    // In single-mode, the extension will only work when the model is fully loaded
    const { is_sleeping } = await rpc<PropsEndpoint>("/props");
    if (is_sleeping) return Status.SLEEPING;

    return Status.LOADED;
  }
}
