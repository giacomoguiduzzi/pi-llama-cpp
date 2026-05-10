import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CTX } from "../src/constants";
import { Mode } from "../src/enums/mode";
import { Status } from "../src/enums/status";
import { ModelProperty } from "../src/interfaces/endpoints/models";
import { SingleModel } from "../src/models/singleModel";

const mockRpc = vi.fn();

vi.mock("../src/tools/retriever", () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
  isServerReady: vi.fn(),
  listModels: vi.fn(),
}));

beforeEach(() => {
  mockRpc.mockClear();
});

const createModel = (extra: Partial<ModelProperty> = {}): SingleModel =>
  new SingleModel({
    id: "test",
    tags: [],
    object: "model",
    owned_by: "test",
    created: Date.now(),
  });

describe("SingleModel mode", () => {
  it("should always return SINGLE mode", () => {
    const model = createModel();
    expect(model.mode).toBe(Mode.SINGLE);
  });
});

describe("SingleModel capabilities", () => {
  it("should detect image capability when modalities.vision is true", async () => {
    mockRpc.mockResolvedValueOnce({ modalities: { vision: true } });

    const model = createModel();
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["image"]);
    expect(mockRpc).toHaveBeenCalledWith("/props?model=test");
  });

  it("should detect text-only capability when modalities.vision is false", async () => {
    mockRpc.mockResolvedValueOnce({ modalities: { vision: false } });

    const model = createModel();
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["text"]);
  });

  it("should return text when /props call fails", async () => {
    mockRpc.mockRejectedValueOnce(new Error("Connection refused"));

    const model = createModel();
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["text"]);
  });
});

describe("SingleModel getStatus", () => {
  it("should return LOADED when not sleeping", async () => {
    mockRpc.mockResolvedValueOnce({ is_sleeping: false });

    const model = createModel();
    const status = await model.getStatus();

    expect(status).toBe(Status.LOADED);
    expect(mockRpc).toHaveBeenCalledWith(`/props?model=${model.id}`);
  });

  it("should return SLEEPING when is_sleeping is true", async () => {
    mockRpc.mockResolvedValueOnce({ is_sleeping: true });

    const model = createModel();
    const status = await model.getStatus();

    expect(status).toBe(Status.SLEEPING);
  });
});

describe("SingleModel getContextSize", () => {
  it("should return n_ctx from /props endpoint default_generation_settings", async () => {
    mockRpc.mockResolvedValueOnce({
      default_generation_settings: { n_ctx: 8192 },
    });

    const model = createModel();
    const ctxSize = await model.getContextSize();

    expect(ctxSize).toBe(8192);
    expect(mockRpc).toHaveBeenCalledWith("/props?model=test");
  });

  it("should return DEFAULT_CTX when /props fails", async () => {
    mockRpc.mockRejectedValueOnce(new Error("Connection refused"));

    const model = createModel();
    const ctxSize = await model.getContextSize();

    expect(ctxSize).toBe(DEFAULT_CTX);
  });
});
