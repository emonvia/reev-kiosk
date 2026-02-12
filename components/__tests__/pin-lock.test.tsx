import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PinLock } from "../pin-lock";

describe("PinLock", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 4 empty dots and a keypad", () => {
    render(<PinLock />);
    // 10 digit buttons (0-9) + 1 delete button = 11 buttons + theme toggle = 12
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(11);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("pressing digit keys fills dots", () => {
    render(<PinLock />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    // After pressing 2 digits, we should not have submitted yet
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("pressing delete removes last digit", () => {
    render(<PinLock />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("3"));
    // Should not have triggered submit (only 2 digits: 1, 3)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("auto-submits when 4 digits entered", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(<PinLock />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("4"));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      });
    });
  });

  it("shows error message on failed PIN submission", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid PIN" }), { status: 401 }),
    );

    render(<PinLock />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("0"));
    fireEvent.click(screen.getByText("0"));
    fireEvent.click(screen.getByText("0"));

    await waitFor(() => {
      expect(screen.getByText("Incorrect PIN, try again")).toBeInTheDocument();
    });
  });

  it("shows error message on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    render(<PinLock />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("0"));
    fireEvent.click(screen.getByText("0"));
    fireEvent.click(screen.getByText("0"));

    await waitFor(() => {
      expect(screen.getByText("Incorrect PIN, try again")).toBeInTheDocument();
    });
  });
});
