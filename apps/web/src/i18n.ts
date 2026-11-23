import { initReactI18next } from "react-i18next";
import i18n from "i18next";
import enTranslations from "../locales/en/translation.json";
import svTranslations from "../locales/sv/translation.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    sv: { translation: svTranslations }
  },
  lng: typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en",
  supportedLngs: ["en", "sv"],
  fallbackLng: "en",
  keySeparator: false,
  interpolation: {
    escapeValue: false
  }
});

export default i18n;