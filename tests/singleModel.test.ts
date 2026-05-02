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
  new SingleModel(
    {
      id: "test",
      tags: [],
      object: "model",
      owned_by: "test",
      created: Date.now(),
    },
    {
      name: "test",
      model: "test.gguf",
      modified_at: new Date().toISOString(),
      size: "1B",
      digest: "abc123",
      type: "model",
      description: "test",
      tags: [],
      capabilities: [],
      parameters: "",
      details: {
        parent_model: "",
        format: "",
        family: "",
        families: [],
        parameter_size: "",
        quantization_level: "",
      },
      ...extra,
    },
  );

describe("SingleModel mode", () => {
  it("should always return SINGLE mode", () => {
    const model = createModel();
    expect(model.mode).toBe(Mode.SINGLE);
  });
});

describe("SingleModel capabilities", () => {
  it("should detect image capability when multimodal", () => {
    const model = createModel({ capabilities: ["multimodal"] });
    expect(model.capabilities).toEqual(["image"]);
  });

  it("should detect text-only capability when not multimodal", () => {
    const model = createModel({ capabilities: [] });
    expect(model.capabilities).toEqual(["text"]);
  });
});

describe("SingleModel getStatus", () => {
  it("should return LOADED when not sleeping", async () => {
    mockRpc.mockResolvedValueOnce({ is_sleeping: false });

    const model = createModel();
    const status = await model.getStatus();

    expect(status).toBe(Status.LOADED);
    expect(mockRpc).toHaveBeenCalledWith("/props");
  });

  it("should return SLEEPING when is_sleeping is true", async () => {
    mockRpc.mockResolvedValueOnce({ is_sleeping: true });

    const model = createModel();
    const status = await model.getStatus();

    expect(status).toBe(Status.SLEEPING);
  });
});

describe("SingleModel getContextSize", () => {
  it("should return n_ctx from /slots endpoint", async () => {
    mockRpc.mockResolvedValueOnce([{ n_ctx: 8192 }]);

    const model = createModel();
    const ctxSize = await model.getContextSize();

    expect(ctxSize).toBe(8192);
    expect(mockRpc).toHaveBeenCalledWith("/slots");
  });

  it("should cache the context size on first call", async () => {
    mockRpc.mockResolvedValueOnce([{ n_ctx: 4096 }]);

    const model = createModel();
    const first = await model.getContextSize();
    const second = await model.getContextSize();

    expect(first).toBe(4096);
    expect(second).toBe(4096);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("should return DEFAULT_CTX when /slots fails", async () => {
    mockRpc.mockRejectedValueOnce(new Error("Connection refused"));

    const model = createModel();
    const ctxSize = await model.getContextSize();

    expect(ctxSize).toBe(DEFAULT_CTX);
  });
});
