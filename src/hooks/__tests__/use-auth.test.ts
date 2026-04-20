import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
  (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-project-123" });
});

describe("useAuth — initial state", () => {
  test("isLoading is false on mount", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  describe("successful sign-in", () => {
    beforeEach(() => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    });

    test("calls signInAction with the provided credentials", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "password123");
    });

    test("returns the action result", async () => {
      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signIn("user@example.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });

    test("isLoading is true during the call and false after", async () => {
      let resolveAction!: (v: any) => void;
      (signInAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((res) => { resolveAction = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signIn("user@example.com", "password123"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveAction({ success: true }); });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("post-sign-in routing — no anonymous work", () => {
    beforeEach(() => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
    });

    test("redirects to the most recent project when one exists", async () => {
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "proj-1" },
        { id: "proj-2" },
      ]);
      const { result } = renderHook(() => useAuth());

      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates a new project and redirects when no projects exist", async () => {
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const { result } = renderHook(() => useAuth());

      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-project-123");
    });

    test("new project name matches expected pattern", async () => {
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const { result } = renderHook(() => useAuth());

      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      const callArg = (createProject as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.name).toMatch(/^New Design #\d+$/);
    });
  });

  describe("post-sign-in routing — with anonymous work", () => {
    beforeEach(() => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    });

    test("saves anon work as a new project and redirects", async () => {
      const anonMessages = [{ role: "user", content: "build a button" }];
      const anonFileSystem = { "/App.jsx": { content: "export default () => <button/>" } };
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFileSystem,
      });
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "saved-anon-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonMessages,
          data: anonFileSystem,
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/saved-anon-project");
    });

    test("project name includes a time string when saving anon work", async () => {
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      const callArg = (createProject as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.name).toMatch(/^Design from /);
    });

    test("clears anon work after saving", async () => {
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      expect(clearAnonWork).toHaveBeenCalledOnce();
    });

    test("falls through to project lookup when anon messages array is empty", async () => {
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        fileSystemData: { "/App.jsx": {} },
      });
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "existing-proj" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });

      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });
  });

  describe("failed sign-in", () => {
    test("returns error result without redirecting", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signIn("u@e.com", "wrong");
      });

      expect(returned).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("isLoading resets to false after a failed attempt", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("u@e.com", "wrong"); });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("thrown errors", () => {
    test("propagates thrown errors from the action", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network failure")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => { await result.current.signIn("u@e.com", "pass1234"); })
      ).rejects.toThrow("Network failure");
    });

    test("isLoading resets to false even when an error is thrown", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("oops"));

      const { result } = renderHook(() => useAuth());

      try {
        await act(async () => { await result.current.signIn("u@e.com", "pass1234"); });
      } catch {
        // expected
      }

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });
});

describe("useAuth — signUp", () => {
  describe("successful sign-up", () => {
    beforeEach(() => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    });

    test("calls signUpAction with the provided credentials", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "securePass1");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "securePass1");
    });

    test("returns the action result", async () => {
      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signUp("new@example.com", "securePass1");
      });

      expect(returned).toEqual({ success: true });
    });

    test("isLoading is true during the call and false after", async () => {
      let resolveAction!: (v: any) => void;
      (signUpAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((res) => { resolveAction = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signUp("new@example.com", "securePass1"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveAction({ success: true }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("triggers post-sign-in routing on success", async () => {
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "first-proj" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "securePass1"); });

      expect(mockPush).toHaveBeenCalledWith("/first-proj");
    });

    test("saves anon work on sign-up just like sign-in", async () => {
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ role: "user", content: "create a form" }],
        fileSystemData: { "/App.jsx": {} },
      });
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-from-signup" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "securePass1"); });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "create a form" }],
        })
      );
      expect(clearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/new-from-signup");
    });
  });

  describe("failed sign-up", () => {
    test("returns error result without redirecting", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signUp("existing@example.com", "pass1234");
      });

      expect(returned).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("isLoading resets to false after failure", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("u@e.com", "pass1234"); });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("thrown errors", () => {
    test("propagates thrown errors from the action", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => { await result.current.signUp("u@e.com", "pass1234"); })
      ).rejects.toThrow("Database error");
    });

    test("isLoading resets to false even when an error is thrown", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("oops"));

      const { result } = renderHook(() => useAuth());

      try {
        await act(async () => { await result.current.signUp("u@e.com", "pass1234"); });
      } catch {
        // expected
      }

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });
});
