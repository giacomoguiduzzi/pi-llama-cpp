import { DEFAULT_CTX } from "../constants";
import { Mode } from "../enums/mode";
import { PropsEndpoint } from "../interfaces/endpoints/props";
import { rpc } from "../tools/retriever";
import { BaseModel } from "./baseModel";

export class SingleModel extends BaseModel {
  get mode(): Mode {
    return Mode.SINGLE;
  }

  async getContextSize(): Promise<number> {
    try {
      const { default_generation_settings } = await rpc<PropsEndpoint>(
        `/props?model=${this.id}`,
      );
      const { n_ctx } = default_generation_settings;
      return n_ctx;
    } catch {
      return DEFAULT_CTX;
    }
  }
}
