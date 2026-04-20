"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown> | undefined
): string {
  if (!args || typeof args !== "object") return "Working...";

  const fileName = (path: unknown): string => {
    if (typeof path !== "string" || !path) return "";
    return path.split("/").filter(Boolean).pop() ?? path;
  };

  if (toolName === "str_replace_editor") {
    const { command, path } = args;
    if (typeof command !== "string") return "Processing file...";
    const name = fileName(path);
    switch (command) {
      case "create":
        return name ? `Creating ${name}` : "Creating file...";
      case "str_replace":
        return name ? `Editing ${name}` : "Editing file...";
      case "insert":
        return name ? `Updating ${name}` : "Updating file...";
      case "view":
        return name ? `Viewing ${name}` : "Viewing file...";
      default:
        return name ? `Processing ${name}` : "Processing file...";
    }
  }

  if (toolName === "file_manager") {
    const { command, path, new_path } = args;
    if (typeof command !== "string") return "Processing file...";
    const name = fileName(path);
    switch (command) {
      case "rename": {
        const newName = fileName(new_path);
        return name
          ? newName
            ? `Renaming ${name} → ${newName}`
            : `Renaming ${name}`
          : "Renaming file...";
      }
      case "delete":
        return name ? `Deleting ${name}` : "Deleting file...";
      default:
        return name ? `Processing ${name}` : "Processing file...";
    }
  }

  return toolName;
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationBadge({ toolInvocation }: ToolInvocationBadgeProps) {
  const isComplete =
    toolInvocation.state === "result" && !!toolInvocation.result;
  const label = getToolLabel(
    toolInvocation.toolName,
    toolInvocation.args as Record<string, unknown>
  );

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div
          data-testid="tool-status-complete"
          className="w-2 h-2 rounded-full bg-emerald-500"
        />
      ) : (
        <Loader2
          data-testid="tool-status-loading"
          className="w-3 h-3 animate-spin text-blue-600"
        />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
