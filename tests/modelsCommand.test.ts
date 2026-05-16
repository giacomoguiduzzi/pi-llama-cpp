import { describe, expect, it, vi } from "vitest";
import { modelsCommand } from "../src/commands/models";
import { Action } from "../src/enums/action";
import { Mode } from "../src/enums/mode";
import { Status } from "../src/enums/status";
import { BaseModel } from "../src/models/baseModel";

// Mock the retriever module
vi.mock("../src/tools/retriever", () => ({
  rpc: vi.fn(),
  isServerReady: vi.fn(),
  listModels: vi.fn(),
}));

// Helper to create a mock BaseModel
const createMockModel = (
  name: string,
  overrides: Partial<BaseModel> = {},
): BaseModel =>
  ({
    name,
    id: name,
    mode: Mode.ROUTER,
    capabilities: ["text"] as ["text"],
    getStatus: vi.fn().mockResolvedValue(Status.LOADED),
    getContextSize: vi.fn().mockResolvedValue(4096),
    getInfo: vi.fn().mockResolvedValue(`Model: ${name}\nID: ${name}`),
    load: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    toProviderConfig: vi.fn().mockResolvedValue({}),
    getLabel: vi.fn().mockResolvedValue(name),
    ...overrides,
  }) as unknown as BaseModel;

const createMockCtx = (
  selectFn: (prompt: string, options: string[]) => string | null,
) => ({
  cwd: "/tmp/test",
  ui: {
    select: vi.fn(selectFn),
    notify: vi.fn(),
    theme: {
      fg: (color: string, text: string) => text,
    },
  },
  modelRegistry: {
    find: vi.fn().mockReturnValue({ id: "test-model-id" }),
  },
});

const createMockPi = () => ({
  setModel: vi.fn(),
  registerProvider: vi.fn(),
});

describe("modelsCommand", () => {
  it("should return early on cancel (null model selection)", async () => {
    const models = [createMockModel("model-a")];
    const ctx = createMockCtx(() => null);
    const pi = createMockPi();

    await modelsCommand(ctx as any, pi as any, models);

    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });

  it("should show info when INFO action is selected", async () => {
    const model = createMockModel("model-a");
    const models = [model];
    const ctx = createMockCtx((prompt) => {
      if (prompt.includes("models")) return "model-a";
      return Action.INFO;
    });
    const pi = createMockPi();

    await modelsCommand(ctx as any, pi as any, models);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Model: model-a\nID: model-a",
      "info",
    );
  });

  it("should unload model when UNLOAD action is selected", async () => {
    const model = createMockModel("model-a");
    const models = [model];
    const ctx = createMockCtx((prompt) => {
      if (prompt.includes("models")) return "model-a";
      return Action.UNLOAD;
    });
    const pi = createMockPi();

    await modelsCommand(ctx as any, pi as any, models);

    expect(model.unload).toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith("Unloaded model-a", "info");
  });

  it("should load model when LOAD action is selected", async () => {
    const loadFn = vi.fn().mockResolvedValue(undefined);
    const model = createMockModel("model-a");
    (model.load as any) = loadFn;
    (model.getStatus as any).mockResolvedValue(Status.UNLOADED);
    const models = [model];
    const ctx = createMockCtx((prompt) => {
      if (prompt.includes("models")) return "model-a";
      return Action.LOAD;
    });
    const pi = createMockPi();

    await modelsCommand(ctx as any, pi as any, models);
    await vi.waitFor(() => expect(loadFn).toHaveBeenCalled());
    await vi.waitFor(() => expect(pi.setModel).toHaveBeenCalled());
  });

  it("should loop back to model selection when action is cancelled", async () => {
    const model = createMockModel("model-a");
    const models = [model];

    let selectCallCount = 0;
    const ctx = createMockCtx(() => {
      selectCallCount++;
      // 1st: select model-a, 2nd: cancel action, 3rd: cancel model => exit
      if (selectCallCount === 1) return "model-a";
      return null;
    });
    const pi = createMockPi();

    await modelsCommand(ctx as any, pi as any, models);

    expect(ctx.ui.select).toHaveBeenCalledTimes(3);
    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });
});
