import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROVIDER_ID, PROVIDER_NAME } from "../constants";
import type { BaseModel } from "../models/baseModel";
import { resolveApiKey, resolveUrl } from "./resolver";
import { listModels } from "./retriever";

/**
 * Registers the Llama.cpp provider and returns the fetched models.
 *
 * @param pi The Pi extension API
 * @returns The list of models fetched from the server
 */
export const registerLlamaCppProvider = async (
  pi: ExtensionAPI,
): Promise<BaseModel[]> => {
  const baseUrl = `${await resolveUrl(process.cwd())}/v1`;
  const models = await listModels();

  pi.registerProvider(PROVIDER_ID, {
    name: PROVIDER_NAME,
    baseUrl,
    api: "openai-completions",
    apiKey: await resolveApiKey(),
    models: await Promise.all(models.map((m) => m.toProviderConfig())),
  });

  return models;
};
