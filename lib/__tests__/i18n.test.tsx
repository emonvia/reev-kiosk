import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LocaleProvider, useTranslations, type Locale } from "../i18n";

function TranslationConsumer() {
  const t = useTranslations();
  return <span data-testid="text">{t.free}</span>;
}

describe("lib/i18n", () => {
  afterEach(() => cleanup());

  it("returns English translations by default (no provider)", () => {
    render(<TranslationConsumer />);
    expect(screen.getByTestId("text")).toHaveTextContent("Free");
  });

  it("provides German translations when locale='de'", () => {
    render(
      <LocaleProvider locale="de">
        <TranslationConsumer />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("text")).toHaveTextContent("Frei");
  });

  it("provides French translations when locale='fr'", () => {
    render(
      <LocaleProvider locale="fr">
        <TranslationConsumer />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("text")).toHaveTextContent("Libre");
  });

  it("provides Italian translations when locale='it'", () => {
    render(
      <LocaleProvider locale="it">
        <TranslationConsumer />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("text")).toHaveTextContent("Libero");
  });

  it("falls back to English for unknown locale", () => {
    render(
      <LocaleProvider locale={"xx" as Locale}>
        <TranslationConsumer />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("text")).toHaveTextContent("Free");
  });
});
