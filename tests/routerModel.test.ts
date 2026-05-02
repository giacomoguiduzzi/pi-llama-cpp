import { describe, expect, it } from "vitest";
import { Mode } from "../src/enums/mode";
import { DataProperty } from "../src/interfaces/endpoints/models";
import { RouterModel } from "../src/models/routerModel";

// Helper to create a mock DataProperty
const createModel = (overrides: Partial<DataProperty> = {}): DataProperty => ({
  id: "test-model",
  aliases: ["test-alias"],
  tags: [],
  object: "model",
  owned_by: "test",
  created: Date.now(),
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

  it("should prefer --ctx-size over --fit-ctx", async () => {
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

  it("should return DEFAULT_CTX when no context size args are present", async () => {
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
  it("should detect image capability when --mmproj is present", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf", "--mmproj", "mmproj.gguf"],
          preset: "default",
        },
      }),
    );

    expect(model.capabilities).toEqual(["image"]);
  });

  it("should detect text-only capability when --mmproj is absent", () => {
    const model = new RouterModel(
      createModel({
        status: {
          value: "loaded",
          args: ["--model", "gguf"],
          preset: "default",
        },
      }),
    );

    expect(model.capabilities).toEqual(["text"]);
  });

  it("should default to text when status is undefined", () => {
    const model = new RouterModel(createModel({ status: undefined }));

    expect(model.capabilities).toEqual(["text"]);
  });
});

describe("RouterModel mode", () => {
  it("should always return ROUTER mode", () => {
    const model = new RouterModel(createModel());
    expect(model.mode).toBe(Mode.ROUTER);
  });
});
