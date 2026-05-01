/**
 * The structure of llama-server's /slots endpoint
 *
 * In single mode, applies to /slots
 * In router mode, applies to /slots?model=<id>
 */
export interface SlotsEndpoint {
  id: number;
  n_ctx: number;
  speculative: boolean;
  is_processing: boolean;
  id_task?: number;
  params?: Array<Record<string, any>>;
  next_token?: Array<Record<string, any>>;
}
