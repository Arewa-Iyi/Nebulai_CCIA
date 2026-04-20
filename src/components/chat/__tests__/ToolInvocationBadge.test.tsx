import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge, getToolLabel } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// Helper to build a ToolInvocation with sensible defaults
function makeInvocation(overrides: Partial<ToolInvocation> = {}): ToolInvocation {
  return {
    state: "call",
    toolCallId: "test-id",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    ...overrides,
  } as ToolInvocation;
}

// ─── getToolLabel ────────────────────────────────────────────────────────────

describe("getToolLabel", () => {
  describe("str_replace_editor", () => {
    it("returns 'Creating <file>' for create command", () => {
      expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating App.jsx");
    });

    it("returns 'Editing <file>' for str_replace command", () => {
      expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/Card.jsx" })).toBe("Editing Card.jsx");
    });

    it("returns 'Updating <file>' for insert command", () => {
      expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })).toBe("Updating App.jsx");
    });

    it("returns 'Viewing <file>' for view command", () => {
      expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Viewing App.jsx");
    });

    it("extracts filename from a nested path", () => {
      expect(getToolLabel("str_replace_editor", { command: "create", path: "/components/Card.jsx" })).toBe("Creating Card.jsx");
    });

    it("falls back gracefully when path is missing", () => {
      expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating file...");
    });

    it("falls back gracefully when command is missing", () => {
      expect(getToolLabel("str_replace_editor", { path: "/App.jsx" })).toBe("Processing file...");
    });

    it("falls back gracefully for an unknown command", () => {
      expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Processing App.jsx");
    });
  });

  describe("file_manager", () => {
    it("returns 'Renaming <old> → <new>' for rename command", () => {
      expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })).toBe("Renaming old.jsx → new.jsx");
    });

    it("returns 'Renaming <file>' when new_path is not yet available", () => {
      expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx" })).toBe("Renaming old.jsx");
    });

    it("returns 'Deleting <file>' for delete command", () => {
      expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" })).toBe("Deleting App.jsx");
    });

    it("falls back gracefully when path is missing", () => {
      expect(getToolLabel("file_manager", { command: "delete" })).toBe("Deleting file...");
    });
  });

  describe("edge cases", () => {
    it("returns the raw tool name for an unrecognized tool", () => {
      expect(getToolLabel("some_other_tool", { command: "run" })).toBe("some_other_tool");
    });

    it("returns 'Working...' when args are undefined", () => {
      expect(getToolLabel("str_replace_editor", undefined)).toBe("Working...");
    });
  });
});

// ─── ToolInvocationBadge component ──────────────────────────────────────────

describe("ToolInvocationBadge", () => {
  it("renders the human-friendly label", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation()} />);
    expect(screen.getByText("Creating App.jsx")).toBeDefined();
  });

  it("shows the loading indicator when state is 'call'", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation({ state: "call" })} />);
    expect(screen.getByTestId("tool-status-loading")).toBeDefined();
    expect(screen.queryByTestId("tool-status-complete")).toBeNull();
  });

  it("shows the loading indicator when state is 'partial-call'", () => {
    render(
      <ToolInvocationBadge
        toolInvocation={makeInvocation({ state: "partial-call", args: {} })}
      />
    );
    expect(screen.getByTestId("tool-status-loading")).toBeDefined();
  });

  it("shows the complete indicator when state is 'result' with a truthy result", () => {
    render(
      <ToolInvocationBadge
        toolInvocation={makeInvocation({ state: "result", result: "ok" } as Partial<ToolInvocation>)}
      />
    );
    expect(screen.getByTestId("tool-status-complete")).toBeDefined();
    expect(screen.queryByTestId("tool-status-loading")).toBeNull();
  });

  it("shows the loading indicator when state is 'result' but result is falsy", () => {
    render(
      <ToolInvocationBadge
        toolInvocation={makeInvocation({ state: "result", result: null } as Partial<ToolInvocation>)}
      />
    );
    expect(screen.getByTestId("tool-status-loading")).toBeDefined();
  });

  it("renders an Editing label for str_replace command", () => {
    render(
      <ToolInvocationBadge
        toolInvocation={makeInvocation({
          args: { command: "str_replace", path: "/Card.jsx" },
        })}
      />
    );
    expect(screen.getByText("Editing Card.jsx")).toBeDefined();
  });

  it("renders a Deleting label for file_manager delete", () => {
    render(
      <ToolInvocationBadge
        toolInvocation={makeInvocation({
          toolName: "file_manager",
          args: { command: "delete", path: "/App.jsx" },
        })}
      />
    );
    expect(screen.getByText("Deleting App.jsx")).toBeDefined();
  });
});
