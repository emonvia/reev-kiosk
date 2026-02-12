"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Locale = "en" | "de" | "fr" | "it";

const translations = {
  en: {
    enterPin: "Enter PIN",
    enterPinSubtitle: "Enter your PIN to continue",
    incorrectPin: "Incorrect PIN, try again",
    delete: "Delete",
    poweredBy: "Volt Kiosk \u2014 Powered by reev",
    free: "Free",
    faulted: "Faulted",
    offline: "Offline",
    chargingSession: "Charging session",
    occupied: "Occupied",
    notAvailable: "Not available",
    reserved: "Reserved",
    freeCount: "free",
    all: "All",
    toggleTheme: "Toggle theme",
  },
  de: {
    enterPin: "PIN eingeben",
    enterPinSubtitle: "Geben Sie Ihre PIN ein, um fortzufahren",
    incorrectPin: "Falsche PIN, erneut versuchen",
    delete: "Löschen",
    poweredBy: "Volt Kiosk \u2014 Powered by reev",
    free: "Frei",
    faulted: "Störung",
    offline: "Offline",
    chargingSession: "Ladevorgang",
    occupied: "Belegt",
    notAvailable: "Nicht verfügbar",
    reserved: "Reserviert",
    freeCount: "frei",
    all: "Alle",
    toggleTheme: "Design wechseln",
  },
  fr: {
    enterPin: "Saisir le PIN",
    enterPinSubtitle: "Entrez votre PIN pour continuer",
    incorrectPin: "PIN incorrect, réessayez",
    delete: "Supprimer",
    poweredBy: "Volt Kiosk \u2014 Powered by reev",
    free: "Libre",
    faulted: "En panne",
    offline: "Hors ligne",
    chargingSession: "En charge",
    occupied: "Occupé",
    notAvailable: "Non disponible",
    reserved: "Réservé",
    freeCount: "libres",
    all: "Tous",
    toggleTheme: "Changer le thème",
  },
  it: {
    enterPin: "Inserisci PIN",
    enterPinSubtitle: "Inserisci il tuo PIN per continuare",
    incorrectPin: "PIN errato, riprova",
    delete: "Cancella",
    poweredBy: "Volt Kiosk \u2014 Powered by reev",
    free: "Libero",
    faulted: "Guasto",
    offline: "Offline",
    chargingSession: "In carica",
    occupied: "Occupato",
    notAvailable: "Non disponibile",
    reserved: "Riservato",
    freeCount: "liberi",
    all: "Tutti",
    toggleTheme: "Cambia tema",
  },
} satisfies Record<string, Record<string, string>>;

export type Translations = (typeof translations)["en"];

const LocaleContext = createContext<Translations>(translations.en);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const t = translations[locale] ?? translations.en;
  return (
    <LocaleContext.Provider value={t}>{children}</LocaleContext.Provider>
  );
}

export function useTranslations() {
  return useContext(LocaleContext);
}
