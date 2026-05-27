import { access, constants, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  API_KEY_PLACEHOLDER,
  DEFAULT_LLAMA_SERVER_URL,
  PROVIDER_ID,
} from "../constants";
import { AuthFile } from "../interfaces/auth";

// The URL is detected once, to reuse forever
type ResolvedUrl = Readonly<{ url: string; warning: string | null }>;
type MaybeResolvedUrl = Readonly<{ url: string | null; warning: string | null }>;

let resolvedUrl: ResolvedUrl | undefined;

const resolveHomeDir = (): { home: string; warning: string | null } => {
  const home =
    process.env.HOME || // Works on Linux and MacOS, returns undefined on Windows
    process.env.USERPROFILE || // Windows compatibility
    "."; // fallback to CWD

  return {
    home,
    warning:
      home == "."
        ? "User home directory not found. Falling back to current directory. This may indicate an issue with your environment configuration."
        : null,
  };
};

/**
 * Detects if a particular file is present
 * @param filePath The path
 * @returns True if exists
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Reads and parses the contents of a file as JSON
 * @param filePath The path to the file
 * @returns The parsed content, or null if parsing fails
 */
const readContents = async <T>(filePath: string): Promise<T | null> => {
  const raw = await readFile(filePath, "utf-8");

  try {
    const contents = JSON.parse(raw);
    return contents;
  } catch (err) {
    return null;
  }
};

/**
 * Reads a value from a JSON config file by key
 * @param filePath Path to the JSON config file
 * @param key Key to extract from the parsed JSON
 * @returns The value at the given key, or null if file/key missing or invalid
 */
const readConfigValue = async <T>(
  filePath: string,
  key: keyof T,
): Promise<T[keyof T] | null> => {
  const cfg = await readContents<T>(filePath);
  return cfg?.[key] ?? null;
};

/**
 * Reads API key from Pi's auth file
 * @returns The API key, as defined by the auth.json file
 */
export const resolveApiKey = async (): Promise<string> => {
  const { home } = resolveHomeDir();
  const authPath = join(home, ".pi", "agent", "auth.json");
  if (!(await fileExists(authPath))) return API_KEY_PLACEHOLDER;

  const cfg = await readConfigValue<AuthFile>(authPath, PROVIDER_ID);
  return cfg?.key ?? API_KEY_PLACEHOLDER;
};

/**
 * Resolves the llama-server url by searching for it in the global settings.json file
 * @returns The URL, if found.
 */
const resolveGlobalUrl = async (): Promise<MaybeResolvedUrl> => {
  const { home, warning } = resolveHomeDir();

  const globalPath = join(
    home,
    ".pi",
    "agent",
    "settings.json",
  );

  if (!(await fileExists(globalPath))) return { url: null, warning };

  const url = await readConfigValue<Record<string, string>>(
    globalPath,
    "llamaServerUrl",
  );
  return { url, warning };
};

/**
 * Resolves the llama-server url by searching for it in the project's .pi/llama-server.json file
 * @param cwd The current working directory
 * @returns The URL, if found.
 */
const resolveProjectUrl = async (cwd: string): Promise<string | null> => {
  const projectPath = join(cwd, ".pi", "llama-server.json");

  if (!(await fileExists(projectPath))) return null;
  return readConfigValue<Record<string, string>>(projectPath, "url");
};

/**
 * Resolves the llama-server url by searching for it in the environment
 * @returns The URL, if found.
 */
const resolveEnvUrl = async (): Promise<string | null> => {
  return process.env.LLAMA_SERVER_URL ?? null;
};

/**
 * Tries all possible ways to retrieve the llama-server URL
 * @param cwd The current working directory
 * @returns The URL, or a default if not found
 */
const resolveUrlWithFallbacks = async (cwd: string): Promise<ResolvedUrl> => {
  // 1. per-project config
  let response = await resolveProjectUrl(cwd);
  if (response) return { url: response, warning: null };

  // 2. env
  response = await resolveEnvUrl();
  if (response) return { url: response, warning: null };

  // 3. global settings: ~/.pi/agent/settings.json
  const { url: globalUrl, warning } = await resolveGlobalUrl();
  if (globalUrl) return { url: globalUrl, warning };

  // 4. default
  return { url: DEFAULT_LLAMA_SERVER_URL, warning };
};

/**
 * Resolves the URL where llama-server is running
 * @param cwd The current working directory
 * @returns The URL, or a default if not found
 */
export const resolveUrl = async (cwd: string): Promise<ResolvedUrl> => {
  if (resolvedUrl) return resolvedUrl;
  const result = await resolveUrlWithFallbacks(cwd);

  // Strip trailing slashes
  resolvedUrl = { ...result, url: result.url.replace(/\/+$/, "") };

  return resolvedUrl;
};
