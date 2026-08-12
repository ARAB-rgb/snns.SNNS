import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageCode, TextDirection, SUPPORTED_LANGUAGES } from '../types/i18n';
import { TRANSLATIONS, Translations } from './translations';

interface LanguageContextType {
  currentLang: LanguageCode;
  direction: TextDirection;
  autoDetect: boolean;
  setLanguage: (lang: LanguageCode) => void;
  setAutoDetect: (auto: boolean) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const detectDeviceLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') return 'en';

  const navLangs = navigator.languages || [navigator.language || 'en'];
  for (const langStr of navLangs) {
    const code = langStr.toLowerCase().split('-')[0];
    if (code === 'ar') return 'ar';
    if (code === 'ur') return 'ur';
    if (code === 'am') return 'am';
    if (code === 'bn') return 'bn';
    if (code === 'zh') return 'zh';
    if (code === 'en') return 'en';
  }
  return 'en';
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [autoDetect, setAutoDetectState] = useState<boolean>(() => {
    const saved = localStorage.getItem('flutter_msg_auto_detect');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [currentLang, setCurrentLangState] = useState<LanguageCode>(() => {
    if (autoDetect) {
      return detectDeviceLanguage();
    }
    const saved = localStorage.getItem('flutter_msg_language') as LanguageCode;
    return saved && SUPPORTED_LANGUAGES[saved] ? saved : detectDeviceLanguage();
  });

  const direction = SUPPORTED_LANGUAGES[currentLang].direction;

  useEffect(() => {
    // Apply direction and lang attributes to document element
    document.documentElement.dir = direction;
    document.documentElement.lang = currentLang;
    if (direction === 'rtl') {
      document.body.classList.add('rtl');
      document.body.classList.remove('ltr');
    } else {
      document.body.classList.add('ltr');
      document.body.classList.remove('rtl');
    }
  }, [currentLang, direction]);

  const setLanguage = (lang: LanguageCode) => {
    setCurrentLangState(lang);
    setAutoDetectState(false);
    localStorage.setItem('flutter_msg_language', lang);
    localStorage.setItem('flutter_msg_auto_detect', JSON.stringify(false));
  };

  const setAutoDetect = (auto: boolean) => {
    setAutoDetectState(auto);
    localStorage.setItem('flutter_msg_auto_detect', JSON.stringify(auto));
    if (auto) {
      const detected = detectDeviceLanguage();
      setCurrentLangState(detected);
    }
  };

  const t = (key: keyof Translations): string => {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || String(key);
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLang,
        direction,
        autoDetect,
        setLanguage,
        setAutoDetect,
        t
      }}
    >
      <div dir={direction} className={direction === 'rtl' ? 'rtl-layout' : 'ltr-layout'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
