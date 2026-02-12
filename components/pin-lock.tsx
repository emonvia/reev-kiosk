"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function PinLock() {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const t = useTranslations();

  const submit = useCallback(async (pin: string) => {
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        setError(true);
        setDigits([]);
      }
    } catch {
      setError(true);
      setDigits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = useCallback(
    (key: string) => {
      if (loading) return;

      if (key === "del") {
        setDigits((d) => d.slice(0, -1));
        setError(false);
        return;
      }

      if (key === "") return;

      setError(false);
      setDigits((prev) => {
        const next = [...prev, key];
        if (next.length === PIN_LENGTH) {
          submit(next.join(""));
        }
        return next.length <= PIN_LENGTH ? next : prev;
      });
    },
    [loading, submit],
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center transition-colors"
      style={{
        height: "100dvh",
        background: dark
          ? "radial-gradient(ellipse at 50% 40%, rgba(30,40,60,1) 0%, rgb(3,7,18) 70%)"
          : "linear-gradient(180deg, #f5f5f7 0%, #e8e8ed 100%)",
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={() => setDark((d) => !d)}
        className={`absolute top-5 right-5 h-8 w-8 rounded-full flex items-center justify-center text-xs transition-colors ${
          dark
            ? "bg-white/10 text-white/60 hover:bg-white/20"
            : "bg-black/[0.05] text-gray-500 hover:bg-black/[0.08]"
        }`}
        aria-label={t.toggleTheme}
      >
        {dark ? "\u2600" : "\u263E"}
      </button>

      <div className="flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1
            className={`text-2xl font-light tracking-tight ${
              dark ? "text-white" : "text-gray-900"
            }`}
          >
            {t.enterPin}
          </h1>
          <p
            className={`mt-2 text-sm transition-colors ${
              error
                ? "text-red-500"
                : dark
                  ? "text-white/40"
                  : "text-gray-400"
            }`}
          >
            {error ? t.incorrectPin : t.enterPinSubtitle}
          </p>
        </div>

        {/* Dots */}
        <div className="flex gap-4">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
                error && i < digits.length
                  ? "bg-red-500 scale-110"
                  : i < digits.length
                    ? dark
                      ? "bg-white scale-110"
                      : "bg-gray-900 scale-110"
                    : dark
                      ? "bg-white/20"
                      : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4">
          {KEYS.map((key, i) => {
            if (key === "") {
              return <div key={i} />;
            }

            const isDel = key === "del";

            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={loading}
                className={`h-[72px] w-[72px] rounded-full flex items-center justify-center transition-all active:scale-95 select-none ${
                  isDel
                    ? dark
                      ? "text-white/50 text-sm font-medium hover:bg-white/[0.06]"
                      : "text-gray-500 text-sm font-medium hover:bg-black/[0.04]"
                    : dark
                      ? "bg-white/[0.08] backdrop-blur-xl backdrop-saturate-150 border border-white/[0.1] text-white text-xl font-light hover:bg-white/[0.14]"
                      : "bg-white/70 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.04] shadow-lg shadow-black/[0.03] text-gray-900 text-xl font-light hover:bg-white/90"
                } ${loading ? "opacity-50" : ""}`}
              >
                {isDel ? t.delete : key}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <p
          className={`text-sm font-light mt-4 ${dark ? "text-white/70" : "text-gray-500"}`}
        >
          {t.poweredBy}
        </p>
      </div>
    </div>
  );
}
