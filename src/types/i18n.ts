export type LanguageCode = 'ar' | 'en' | 'am' | 'bn' | 'ur' | 'zh';

export type TextDirection = 'rtl' | 'ltr';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  direction: TextDirection;
  flag: string;
  script: string;
}

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    flag: '🇸🇦',
    script: 'Arabic'
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    flag: '🇺🇸',
    script: 'Latin'
  },
  am: {
    code: 'am',
    name: 'Amharic',
    nativeName: 'አማርኛ',
    direction: 'ltr',
    flag: '🇪🇹',
    script: 'Ethiopic'
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    direction: 'ltr',
    flag: '🇧🇩',
    script: 'Bengali'
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    direction: 'rtl',
    flag: '🇵🇰',
    script: 'Arabic'
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    flag: '🇨🇳',
    script: 'Simplified Chinese'
  }
};
