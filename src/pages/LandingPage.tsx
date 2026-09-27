import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Wallet, CreditCard, Target, BarChart3, Shield, ArrowRight, Sun, Moon, Users } from 'lucide-react';
import { useI18n, Locale } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { analyticsHelpers } from '../utils/analytics';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/format';
import SelectCombobox from '../components/SelectCombobox';

const LandingPage = () => {
  const { t, locale, setLocale } = useI18n();
  const { currentUser } = useAuth();
  // Don't fetch user data on landing page - not needed and prevents unnecessary queries
  const { theme, toggleTheme } = useTheme();
  const { baseCurrency, setBaseCurrency } = useCurrency();
  
  // Mapping of Locale to a default Currency for demo purposes
  const LOCALE_CURRENCY_MAP: Record<string, CurrencyCode> = useMemo(() => ({
    'pt-BR': 'BRL',
    'en-US': 'USD',
    'es-ES': 'EUR',
    'fr-FR': 'EUR',
    'ja-JP': 'JPY',
    'ru-RU': 'RUB',
    'zh-CN': 'CNY',
    'ar-SA': 'SAR',
  }), []);

  // Update baseCurrency when locale changes (only for non-logged in users on landing page)
  useEffect(() => {
    if (!currentUser && LOCALE_CURRENCY_MAP[locale]) {
      setBaseCurrency(LOCALE_CURRENCY_MAP[locale]);
    }
  }, [locale, currentUser, LOCALE_CURRENCY_MAP, setBaseCurrency]);

  // Animated words for the hero title
  const words = useMemo(() => [
    t.landingHeroWord1,
    t.landingHeroWord2,
    t.landingHeroWord3,
    t.landingHeroWord4
  ], [t.landingHeroWord1, t.landingHeroWord2, t.landingHeroWord3, t.landingHeroWord4]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState(words[0] || '');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // ... rest of state ...
  const featuresSectionRef = useRef<HTMLElement>(null);
  const widgetSectionRef = useRef<HTMLElement>(null);
  const securitySectionRef = useRef<HTMLElement>(null);
  const pricingSectionRef = useRef<HTMLElement>(null);
  const ctaSectionRef = useRef<HTMLElement>(null);
  const [isFeaturesVisible, setIsFeaturesVisible] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isSecurityVisible, setIsSecurityVisible] = useState(false);
  const [isPricingVisible, setIsPricingVisible] = useState(false);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });
  
  // Demo data for the widget
  const demoExpensesByCategory = [
    { name: t.landingDemoCategory1, value: 1200 },
    { name: t.landingDemoCategory2, value: 800 },
    { name: t.landingDemoCategory3, value: 550 },
  ];
  
  // Update displayText when words change (locale change)
  useEffect(() => {
    setDisplayText(words[currentWordIndex] || '');
  }, [locale, words, currentWordIndex]);

  const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6'];
  
  // Languages for the selector
  const languages = [
    { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
    { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  ];

  // ... rest of effects ...
  
  // Intersection Observer for scroll animations and analytics
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sectionViewed = new Set<string>();
    
    const createObserver = (ref: React.RefObject<HTMLElement>, setVisible: (value: boolean) => void, sectionName: string) => {
      if (!ref.current) return null;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisible(true);
              // Track section view only once
              if (!sectionViewed.has(sectionName)) {
                sectionViewed.add(sectionName);
                analyticsHelpers.logLandingSectionViewed(sectionName);
              }
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
      );
      
      observer.observe(ref.current);
      return observer;
    };
    
    const featuresObserver = createObserver(featuresSectionRef, setIsFeaturesVisible, 'features');
    const widgetObserver = createObserver(widgetSectionRef, setIsWidgetVisible, 'widget_demo');
    const securityObserver = createObserver(securitySectionRef, setIsSecurityVisible, 'security');
    const pricingObserver = createObserver(pricingSectionRef, setIsPricingVisible, 'pricing');
    const ctaObserver = createObserver(ctaSectionRef, setIsCtaVisible, 'cta');
    
    if (featuresObserver) observers.push(featuresObserver);
    if (widgetObserver) observers.push(widgetObserver);
    if (securityObserver) observers.push(securityObserver);
    if (pricingObserver) observers.push(pricingObserver);
    if (ctaObserver) observers.push(ctaObserver);
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  // Scroll depth tracking
  useEffect(() => {
    const trackedDepths = new Set<number>();
    const milestones = [25, 50, 75, 100];

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = Math.round((scrollTop / documentHeight) * 100);

      milestones.forEach((milestone) => {
        if (scrollPercentage >= milestone && !trackedDepths.has(milestone)) {
          trackedDepths.add(milestone);
          analyticsHelpers.logLandingScrollDepth(milestone);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parallax effect for blueprint grid - grid stays fixed in viewport while scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!featuresSectionRef.current) return;
      
      const section = featuresSectionRef.current;
      const rect = section.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Only apply parallax when section is visible
      if (rect.bottom < 0 || rect.top > windowHeight) {
        setGridOffset({ x: 0, y: 0 });
        return;
      }
      
      // Calculate how much the section has scrolled
      const sectionTop = rect.top;
      
      // Grid moves opposite to scroll to create fixed effect
      // As you scroll down, grid moves up relative to section
      const scrollProgress = -sectionTop * 0.3; // 30% movement speed for subtle parallax
      
      // Keep grid fixed - no horizontal movement, only vertical parallax
      setGridOffset({ x: 0, y: scrollProgress });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentWord = words[currentWordIndex];
    
    if (isDeleting) {
      // Deleting characters
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length - 1));
        }, 100);
      } else {
        // Move to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    } else {
      // Typing characters
      if (displayText.length < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        }, 150);
      } else {
        // Wait before deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, currentWordIndex, isDeleting, words]);

  // Structured data for AI optimization
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": t.landingSeoTitle,
    "description": t.landingSeoDescription,
    "url": "https://recta.app",
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Recta",
      "applicationCategory": "FinanceApplication"
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Structured Data for AI */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 animate-fade-in-up" aria-label={t.landingNavAriaLabel}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              to="/home"
              className="flex items-center hover:scale-105 transition-transform duration-200"
              onClick={() => analyticsHelpers.logLandingNavClicked('logo')}
            >
              <Wallet className="h-8 w-8 text-primary-600 dark:text-primary-400 animate-pulse-slow" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-gray-100">Recta</span>
            </Link>
            <div className="flex items-center space-x-4">
              {/* Desktop Language Selector */}
              <div className="hidden sm:block">
                <SelectCombobox
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                  options={languages.map((lang) => ({
                    value: lang.code,
                    label: `${lang.flag} ${lang.name}`
                  }))}
                  placeholder={t.selectLanguage}
                />
              </div>

              {/* Mobile Language Selector (Flag only) */}
              <div className="sm:hidden">
                <SelectCombobox
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                  options={languages.map((lang) => ({
                    value: lang.code,
                    label: lang.flag
                  }))}
                  placeholder="🌐"
                />
              </div>

              {currentUser ? (
                <Link
                  to="/app"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  onClick={() => analyticsHelpers.logLandingNavClicked('go_to_app')}
                >
                  {t.landingGoToApp}
                </Link>
              ) : (
                <Link
                  to="/login?action=login"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  onClick={() => analyticsHelpers.logLandingNavClicked('login')}
                >
                  {t.landingLoginButton}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" aria-label={t.landingMainContentAriaLabel}>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-32" aria-label={t.landingHeroSectionAriaLabel}>
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
          <div className="animate-fade-in-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 animate-fade-in-up animate-delay-100">
              <span className="block">
                {t.landingHeroTitle.split(' ').slice(0, -1).join(' ')}
              </span>
              <span className="block text-primary-700 dark:text-primary-300 mt-2">
                {displayText}
                <span className="animate-pulse">|</span>
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 animate-fade-in-up animate-delay-200">
              {t.landingHeroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-in-up animate-delay-300">
              {currentUser ? (
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 hover:scale-105 hover:shadow-lg group"
                  onClick={() => analyticsHelpers.logLandingCtaClicked('hero', true)}
                >
                  {t.landingGoToApp}
                </Link>
              ) : (
                <Link
                  to="/login?action=signup"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 hover:scale-105 hover:shadow-lg group"
                  onClick={() => analyticsHelpers.logLandingCtaClicked('hero', false)}
                >
                  {t.landingGetStarted}
                </Link>
              )}
            </div>
          </div>
          <div className="animate-fade-in-right animate-delay-200 mt-8 sm:mt-10 lg:mt-0">
            <div className="relative max-w-md mx-auto lg:max-w-none">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 rounded-lg transform rotate-6 opacity-25 -z-10 hidden lg:block"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-5 sm:p-6 lg:p-8 border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:scale-105 transition-transform duration-200">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{t.landingTotalBalance}</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(12450, baseCurrency)}</p>
                    </div>
                    <Wallet className="h-7 w-7 lg:h-8 lg:w-8 text-primary-600 dark:text-primary-400 animate-pulse-slow flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:scale-105 transition-transform duration-200 hover:shadow-md">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{t.landingDemoIncome}</p>
                      <p className="text-lg lg:text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(15000, baseCurrency)}</p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:scale-105 transition-transform duration-200 hover:shadow-md">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{t.landingDemoExpense}</p>
                      <p className="text-lg lg:text-xl font-bold text-red-700 dark:text-red-300">{formatCurrency(2550, baseCurrency)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        ref={featuresSectionRef} 
        className="bg-gray-50 dark:bg-gray-800 py-20 blueprint-grid relative"
        style={{
          backgroundPosition: `${gridOffset.x}px ${gridOffset.y}px`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-16 transition-opacity duration-700 ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
              {t.landingFeaturesTitle}
            </h2>
            <p className="text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              {t.landingFeaturesSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            <div className={`relative bg-white dark:bg-gray-900 p-8 rounded-2xl border-l-4 border-primary-500 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-100' : 'opacity-0'}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100 dark:bg-primary-900/20 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl mb-5 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <CreditCard className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {t.landingFeature1Title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                  {t.landingFeature1Description}
                </p>
              </div>
            </div>

            <div className={`relative bg-white dark:bg-gray-900 p-8 rounded-2xl border-l-4 border-green-500 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-200' : 'opacity-0'}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 dark:bg-green-900/20 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl mb-5 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {t.landingFeature2Title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                  {t.landingFeature2Description}
                </p>
              </div>
            </div>

            <div className={`relative bg-white dark:bg-gray-900 p-8 rounded-2xl border-l-4 border-purple-500 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-300' : 'opacity-0'}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 dark:bg-purple-900/20 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-5 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {t.landingFeature3Title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                  {t.landingFeature3Description}
                </p>
              </div>
            </div>

            <div className={`relative bg-white dark:bg-gray-900 p-8 rounded-2xl border-l-4 border-indigo-500 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-400' : 'opacity-0'}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 dark:bg-indigo-900/20 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl mb-5 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {t.landingFeature4Title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                  {t.landingFeature4Description}
                </p>
              </div>
            </div>
          </div>

          <div className={`text-center transition-opacity duration-700 ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-500' : 'opacity-0'}`}>
            {currentUser ? (
              <Link
                to="/app"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 hover:scale-105 hover:shadow-lg group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('features', true)}
              >
                {t.landingGoToApp}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <Link
                to="/login?action=signup"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 hover:scale-105 hover:shadow-lg group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('features', false)}
              >
                {t.landingFreeTrial}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Widget Demo Section */}
      <section ref={widgetSectionRef} className="bg-white dark:bg-gray-900 py-20 border-t border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-12 transition-opacity duration-700 ${isWidgetVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
            {t.landingWidgetTitle}
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
            {t.landingWidgetSubtitle}
          </p>
        </div>
        
        <div className={`grid lg:grid-cols-2 gap-8 items-center transition-opacity duration-700 ${isWidgetVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`${isWidgetVisible ? 'animate-fade-in-left' : ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                {t.landingWidgetChartTitle}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={demoExpensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {demoExpensesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, baseCurrency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {demoExpensesByCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(item.value, baseCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className={`space-y-6 ${isWidgetVisible ? 'animate-fade-in-right' : ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-primary-100 dark:bg-primary-900/30 rounded-lg p-3">
                  <BarChart3 className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t.landingDetailedReportsTitle}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {t.landingDetailedReportsDesc}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                  <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t.landingAutomaticInsightsTitle}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {t.landingAutomaticInsightsDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Security Section */}
      <section ref={securitySectionRef} className="bg-primary-600 dark:bg-primary-700 py-20 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`transition-all duration-700 ${isSecurityVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-white mb-3 sm:mb-0 sm:mr-3 animate-pulse-slow" />
                <h2 className="text-2xl lg:text-3xl font-extrabold text-white">
                  {t.landingSecurityTitle}
                </h2>
              </div>
              <p className="text-lg text-primary-50 dark:text-primary-100">
                {t.landingSecurityDescription}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingSectionRef} className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-opacity duration-700 ${isPricingVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
              {t.landingPricingTitle}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              {t.landingPricingSubtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan - Featured */}
            <div className={`bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl border-2 border-primary-500 p-8 shadow-lg hover:shadow-xl transition-all duration-300 relative lg:scale-105 ${isPricingVisible ? 'opacity-100 animate-fade-in-up animate-delay-100' : 'opacity-0'}`}>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-primary-600 text-white">
                  {t.landingMostPopular}
                </span>
              </div>
              <div className="text-center mt-4">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 mb-4">
                  {t.landingBetaFree}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {t.landingFreePlanName}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{CURRENCIES[baseCurrency]?.symbol || '$'} </span>
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 demo-blur">XX</span>
                  <span className="text-gray-600 dark:text-gray-400">/{t.landingPerMonth}</span>
                </div>
                <ul className="space-y-4 mb-8 text-left">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingFreePlanFeature1}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingFreePlanFeature2}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingFreePlanFeature3}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingFreePlanFeature4}</span>
                  </li>
                </ul>
                <Link
                  to="/login?action=signup"
                  className="block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center"
                  onClick={() => analyticsHelpers.logLandingPlanClicked('gratis')}
                >
                  {t.landingGetStarted}
                </Link>
              </div>
            </div>

            {/* Premium Individual */}
            <div className={`bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-8 shadow-sm hover:shadow-lg transition-all duration-300 ${isPricingVisible ? 'opacity-100 animate-fade-in-up animate-delay-200' : 'opacity-0'}`}>
              <div className="text-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 mb-4">
                  {t.landingBetaFree}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {t.landingPremiumIndividualName}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{CURRENCIES[baseCurrency]?.symbol || '$'} </span>
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 demo-blur">XX</span>
                  <span className="text-gray-600 dark:text-gray-400">/{t.landingPerMonth}</span>
                </div>
                <ul className="space-y-4 mb-8 text-left">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature1}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature2}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature3}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature4}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature5}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumIndividualFeature6}</span>
                  </li>
                </ul>
                <button
                  disabled
                  className="block w-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 font-semibold py-3 px-6 rounded-lg cursor-not-allowed text-center opacity-60"
                  onClick={() => analyticsHelpers.logLandingPlanClicked('premium_individual')}
                >
                  {t.landingComingSoon}
                </button>
              </div>
            </div>

            {/* Premium Família */}
            <div className={`bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-8 shadow-sm hover:shadow-lg transition-all duration-300 ${isPricingVisible ? 'opacity-100 animate-fade-in-up animate-delay-300' : 'opacity-0'}`}>
              <div className="text-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 mb-4">
                  {t.landingBetaFree}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {t.landingPremiumFamilyName}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{CURRENCIES[baseCurrency]?.symbol || '$'} </span>
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 demo-blur">XX</span>
                  <span className="text-gray-600 dark:text-gray-400">/{t.landingPerMonth}</span>
                </div>
                <ul className="space-y-4 mb-8 text-left">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumFamilyFeature1}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumFamilyFeature2}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumFamilyFeature3}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumFamilyFeature4}</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">{t.landingPremiumFamilyFeature5}</span>
                  </li>
                </ul>
                <button
                  disabled
                  className="block w-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 font-semibold py-3 px-6 rounded-lg cursor-not-allowed text-center opacity-60"
                  onClick={() => analyticsHelpers.logLandingPlanClicked('premium_familia')}
                >
                  {t.landingComingSoon}
                </button>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.landingPricingNote}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaSectionRef} className="bg-primary-600 dark:bg-primary-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className={`text-3xl lg:text-4xl font-extrabold text-white mb-4 transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-200' : 'opacity-0'}`}>
            {t.landingAppTitle}
          </h2>
          <p className={`text-xl text-primary-100 mb-8 max-w-2xl mx-auto transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-300' : 'opacity-0'}`}>
            {t.landingAppDescription}
          </p>
          <div className={`transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-400' : 'opacity-0'}`}>
            {currentUser ? (
              <Link
                to="/app"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 transition-all duration-200 hover:scale-105 hover:shadow-xl group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('final_cta', true)}
              >
                {t.landingGoToApp}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <Link
                to="/login?action=signup"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 transition-all duration-200 hover:scale-105 hover:shadow-xl group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('final_cta', false)}
              >
                {t.landingGetStarted}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            <div className="flex flex-col items-center md:items-start space-y-4">
              <div className="flex items-center">
                <Wallet className="h-6 w-6 text-primary-400 mr-2" />
                <span className="text-lg font-bold">Recta</span>
              </div>
              
              {/* Language Selector in Footer */}
              <div className="flex items-center space-x-2">
                <SelectCombobox
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                  options={languages.map((lang) => ({
                    value: lang.code,
                    label: `${lang.flag} ${lang.name}`
                  }))}
                  placeholder={t.selectLanguage}
                />
              </div>
            </div>

            <div className="text-sm text-center md:text-right space-y-2">
              <p>© {new Date().getFullYear()} Recta. {t.landingFooterRights}</p>
              <div className="flex flex-wrap justify-center md:justify-end gap-4 text-gray-400">
                <Link to="/support" className="hover:text-gray-300 transition-colors">
                  Suporte
                </Link>
                <Link to="/terms" className="hover:text-gray-300 transition-colors">
                  Termos de Uso
                </Link>
                <Link to="/privacy" className="hover:text-gray-300 transition-colors">
                  Política de Privacidade
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Theme Toggle Button - Floating */}
      <button
        onClick={() => {
          toggleTheme();
          analyticsHelpers.logLandingThemeToggled(theme === 'dark' ? 'light' : 'dark');
        }}
        className="fixed bottom-6 right-6 z-50 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-gray-200 dark:border-gray-700"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

    </div>
  );
};

export default LandingPage;

