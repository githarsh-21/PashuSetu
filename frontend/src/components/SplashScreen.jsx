import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowRight } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
    const { t, i18n } = useTranslation();

    const changeLanguage = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">

            {/* Logo and App Name (Animated) */}
            <div className="flex flex-col items-center mb-10 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-lg border border-slate-700">
                    <span className="text-4xl sm:text-5xl">🐄</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
                    {t('app_name', 'PashuSetu')}
                </h1>
                <p className="text-slate-400 text-[10px] sm:text-xs mt-2 tracking-widest uppercase font-bold text-center px-4">
                    {t('app_subtitle', 'Digital Livestock & AI Triage')}
                </p>
            </div>

            {/* Selection Card Container */}
            <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-500 delay-150 relative overflow-hidden">

                {/* Decorative background element */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-blue-500"></div>

                <div className="flex flex-col items-center text-center mb-6 sm:mb-8 pt-2">
                    <div className="p-3 sm:p-3.5 bg-emerald-50 rounded-2xl mb-3 sm:mb-4 border border-emerald-100">
                        <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                        {t('selectLang', 'Choose your language')}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-1.5">
                        {t('select_lang_desc', 'Select your preferred language to continue')}
                    </p>
                </div>

                <div className="space-y-5 sm:space-y-6">
                    {/* Custom Dropdown Wrapper */}
                    <div className="relative group">
                        <select
                            value={i18n.language || 'en'}
                            onChange={changeLanguage}
                            className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none cursor-pointer transition shadow-sm group-hover:border-emerald-300"
                        >
                            <option value="en">English</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                            <option value="mr">मराठी (Marathi)</option>
                            <option value="te">తెలుగు (Telugu)</option>
                        </select>
                        {/* Custom dropdown arrow */}
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>

                    <button
                        onClick={onComplete}
                        className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 sm:py-4 rounded-xl transition shadow-md cursor-pointer text-sm sm:text-base group"
                    >
                        <span>{t('getStarted', 'Get Started')}</span>
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1.5 transition-transform" />
                    </button>
                </div>
            </div>

            <p className="text-slate-500 text-[10px] sm:text-xs mt-8 sm:mt-10 font-medium text-center px-4">
                {t('vci_certified', 'VCI Certified Veterinary Framework')}
            </p>
        </div>
    );
}