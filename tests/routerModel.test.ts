import { describe, expect, it, vi } from "vitest";
import { Mode } from "../src/enums/mode";
import { DataProperty } from "../src/interfaces/endpoints/models";
import { RouterModel } from "../src/models/routerModel";

// Mock the retriever module before importing anything that depends on it
const mockRpc = vi.fn();

vi.mock("../src/tools/retriever", () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
  isServerReady: vi.fn(),
  listModels: vi.fn(),
}));

// Helper to create a mock DataProperty
const createModel = (overrides: Partial<DataProperty> = {}): DataProperty => ({
  id: "test-model",
  aliases: ["test-alias"],
  tags: [],
  object: "model",
  owned_by: "test",
  created: Date.now(),
  status: { value: "loaded", args: [], preset: "default", failed: false },
  ...overrides,
});

describe("RouterModel context size extraction", () => {
  it("should extract --ctx-size value", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: [
            "--model",
            "gguf",
            "--ctx-size",
            "4096",
            "--batch-size",
            "512",
          ],
          preset: "default",
        },
      }),
    );

    // Access the private method via any
    const extractFrom = (model as any).extractFrom.bind(model);
    expect(extractFrom("--ctx-size")).toBe(4096);
  });

  it("should extract --fit-ctx value when --ctx-size is not present", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--fit-ctx", "8192"],
          preset: "default",
        },
      }),
    );

    const extractFrom = (model as any).extractFrom.bind(model);
    expect(extractFrom("--fit-ctx")).toBe(8192);
  });

  it("should return null when argument is not found", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--batch-size", "512"],
          preset: "default",
        },
      }),
    );

    const extractFrom = (model as any).extractFrom.bind(model);
    expect(extractFrom("--ctx-size")).toBeNull();
    expect(extractFrom("--fit-ctx")).toBeNull();
  });

  it("should return null when argument has no following value", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--ctx-size"],
          preset: "default",
        },
      }),
    );

    const extractFrom = (model as any).extractFrom.bind(model);
    expect(extractFrom("--ctx-size")).toBeNull();
  });

  it("should return null when argument value is not a valid number", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--ctx-size", "not-a-number"],
          preset: "default",
        },
      }),
    );

    const extractFrom = (model as any).extractFrom.bind(model);
    expect(extractFrom("--ctx-size")).toBeNull();
  });

  it("should prefer --ctx-size over --fit-ctx when loaded", async () => {
    // First call: getStatus() -> /models
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "loaded", args: ["--model", "gguf", "--ctx-size", "4096", "--fit-ctx", "8192"], preset: "default" },
        },
      ],
    });
    // Second call: super.getContextSize() -> /models with meta.n_ctx
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          meta: { n_ctx: 4096 },
        },
      ],
    });

    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--ctx-size", "4096", "--fit-ctx", "8192"],
          preset: "default",
        },
      }),
    );

    const ctxSize = await model.getContextSize();
    expect(ctxSize).toBe(4096);
  });

  it("should return DEFAULT_CTX when no context size args are present and loaded", async () => {
    // First call: getStatus() -> /models
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "loaded", args: ["--model", "gguf"], preset: "default" },
        },
      ],
    });
    // Second call: super.getContextSize() -> /models without meta.n_ctx
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
        },
      ],
    });

    const { DEFAULT_CTX } = await import("../src/constants");

    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf"],
          preset: "default",
        },
      }),
    );

    const ctxSize = await model.getContextSize();
    expect(ctxSize).toBe(DEFAULT_CTX);
  });
});

describe("RouterModel capabilities detection", () => {
  it("should detect image capability when modalities.vision is true", async () => {
    // getStatus() calls /models first
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "loaded", args: [], preset: "default", failed: false },
        },
      ],
    });
    // super.getCapabilities() calls /props?model=<id>
    mockRpc.mockResolvedValueOnce({ modalities: { vision: true } });

    const model = new RouterModel(createModel());
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["image"]);
    expect(mockRpc).toHaveBeenCalledWith("/props?model=test-model");
  });

  it("should detect text-only capability when modalities.vision is false", async () => {
    // getStatus() calls /models first
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "loaded", args: [], preset: "default", failed: false },
        },
      ],
    });
    // super.getCapabilities() calls /props?model=<id>
    mockRpc.mockResolvedValueOnce({ modalities: { vision: false } });

    const model = new RouterModel(createModel());
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["text"]);
  });

  it("should default to text when /props call fails", async () => {
    // getStatus() calls /models first
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "loaded", args: [], preset: "default", failed: false },
        },
      ],
    });
    // super.getCapabilities() calls /props?model=<id> which fails
    mockRpc.mockRejectedValueOnce(new Error("Connection refused"));

    const model = new RouterModel(createModel());
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["text"]);
  });

  it("should use status.args to detect image capability when not loaded", async () => {
    // getStatus() calls /models first, returns unloaded
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "unloaded", args: ["--model", "gguf", "--mmproj", "mmproj.gguf"], preset: "default", failed: false },
        },
      ],
    });

    const model = new RouterModel(
      createModel({
        status: { value: "unloaded", args: ["--model", "gguf", "--mmproj", "mmproj.gguf"], preset: "default", failed: false },
      }),
    );
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["image"]);
  });

  it("should return text when not loaded and no --mmproj in args", async () => {
    // getStatus() calls /models first, returns unloaded
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "test-model",
          status: { value: "unloaded", args: ["--model", "gguf"], preset: "default", failed: false },
        },
      ],
    });

    const model = new RouterModel(
      createModel({
        status: { value: "unloaded", args: ["--model", "gguf"], preset: "default", failed: false },
      }),
    );
    const capabilities = await model.getCapabilities();

    expect(capabilities).toEqual(["text"]);
  });
});

describe("RouterModel mode", () => {
  it("should always return ROUTER mode", () => {
    const model = new RouterModel(createModel());
    expect(model.mode).toBe(Mode.ROUTER);
  });
});
