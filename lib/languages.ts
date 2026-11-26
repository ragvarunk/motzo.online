// Languages Motzo can talk in. The code is used for the AI's replies, the
// browser's speech recognition and picking a matching device voice.

export interface Language {
  code: string;
  name: string; // English name
  native: string; // name in the language itself
}

export const LANGUAGES: Language[] = [
  { code: "en-US", name: "English (US)", native: "English" },
  { code: "en-GB", name: "English (UK)", native: "English" },
  { code: "es-US", name: "Spanish", native: "Español" },
  { code: "hi-IN", name: "Hindi", native: "हिन्दी" },
  { code: "te-IN", name: "Telugu", native: "తెలుగు" },
  { code: "ta-IN", name: "Tamil", native: "தமிழ்" },
  { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", native: "മലയാളം" },
  { code: "mr-IN", name: "Marathi", native: "मराठी" },
  { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
  { code: "bn-IN", name: "Bengali", native: "বাংলা" },
  { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur-PK", name: "Urdu", native: "اردو" },
  { code: "zh-CN", name: "Chinese (Mandarin)", native: "中文" },
  { code: "vi-VN", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "fil-PH", name: "Filipino (Tagalog)", native: "Filipino" },
  { code: "ko-KR", name: "Korean", native: "한국어" },
  { code: "ja-JP", name: "Japanese", native: "日本語" },
  { code: "ar-SA", name: "Arabic", native: "العربية" },
  { code: "fa-IR", name: "Persian (Farsi)", native: "فارسی" },
  { code: "ru-RU", name: "Russian", native: "Русский" },
  { code: "pt-BR", name: "Portuguese", native: "Português" },
  { code: "fr-FR", name: "French", native: "Français" },
  { code: "de-DE", name: "German", native: "Deutsch" },
  { code: "it-IT", name: "Italian", native: "Italiano" },
];

export function languageByCode(code: string | undefined): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => code && l.code.split("-")[0] === code.split("-")[0]) ?? LANGUAGES[0];
}

/** The device's own language when Motzo supports it, otherwise US English. */
export function defaultLanguage(): string {
  if (typeof navigator === "undefined") return "en-US";
  const nav = navigator.language || "en-US";
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === nav.toLowerCase());
  if (exact) return exact.code;
  const base = LANGUAGES.find((l) => l.code.split("-")[0] === nav.split("-")[0]);
  return base?.code ?? "en-US";
}

export function isRtl(code: string): boolean {
  return /^(ar|ur|fa|he)/.test(code);
}
