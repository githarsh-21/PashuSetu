import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Stethoscope, User, ShieldCheck, Menu, X, Globe } from 'lucide-react';

export default function Navbar({ user, onLogout, onOpenProfile }) {
    // State to handle the mobile dropdown menu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Initialize translation hook & i18n instance
    const { t, i18n } = useTranslation();

    const isVet = user?.role?.toLowerCase() === 'veterinarian';

    const translateRole = (role) => {
        if (!role) return '';
        const lowerRole = role.toLowerCase();
        if (lowerRole === 'veterinarian') return t('role_veterinarian', 'Veterinarian');
        if (lowerRole === 'farmer') return t('role_farmer', 'Farmer');
        return role;
    };

    const handleLanguageChange = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    return (
        <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">

                    {/* 1. Logo - Always visible */}
                    <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                        <span className="text-2xl shrink-0">🐄</span>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xl font-black tracking-tight text-emerald-400 leading-tight truncate">
                                {t('app_name', 'PashuSetu')}
                            </span>
                            <span className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[160px] sm:max-w-none">
                                {t('app_subtitle', 'Digital Livestock & AI Triage')}
                            </span>
                        </div>
                    </div>

                    {/* 2. Desktop Menu - Hidden on Mobile */}
                    <div className="hidden md:flex items-center space-x-3 shrink-0">
                        {/* Language Selector Dropdown */}
                        <div className="flex items-center space-x-1 bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700 shrink-0">
                            <Globe className="w-4 h-4 text-emerald-400 ml-1 shrink-0" />
                            <select
                                onChange={handleLanguageChange}
                                value={i18n.language || 'en'}
                                className="bg-transparent text-slate-200 text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer pr-1"
                            >
                                <option value="en" className="bg-slate-900 text-white">English</option>
                                <option value="hi" className="bg-slate-900 text-white">हिंदी</option>
                                <option value="mr" className="bg-slate-900 text-white">मराठी</option>
                                <option value="te" className="bg-slate-900 text-white">తెలుగు</option>
                            </select>
                        </div>

                        {/* Clickable Profile Badge Button */}
                        <button
                            onClick={onOpenProfile}
                            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 px-3 py-1.5 rounded-full border border-slate-700 transition cursor-pointer group shrink-0 max-w-[200px] lg:max-w-[250px]"
                            title={t('nav_view_profile', 'View Profile & Settings')}
                        >
                            {isVet ? (
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                                <User className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white transition truncate">
                                {isVet ? `Dr. ${user?.full_name || user?.username}` : user?.full_name || user?.username}
                            </span>
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                {translateRole(user?.role)}
                            </span>
                        </button>

                        <button
                            onClick={onLogout}
                            className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer shrink-0 whitespace-nowrap"
                        >
                            <LogOut className="w-4 h-4 shrink-0" />
                            <span>{t('nav_logout', 'Logout')}</span>
                        </button>
                    </div>

                    {/* 3. Mobile Hamburger Button */}
                    <div className="md:hidden flex items-center shrink-0">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-slate-300 hover:text-white p-2 rounded-lg focus:outline-none focus:bg-slate-800 transition shrink-0"
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-slate-800 border-t border-slate-700 animate-in slide-in-from-top-2 shadow-xl absolute w-full z-40">
                    <div className="px-4 pt-4 pb-6 space-y-4">
                        {/* Mobile Language Selector */}
                        <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                            <div className="flex items-center space-x-2 text-slate-300 text-sm font-medium shrink-0">
                                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="whitespace-nowrap">Language / भाषा</span>
                            </div>
                            <select
                                onChange={handleLanguageChange}
                                value={i18n.language || 'en'}
                                className="bg-slate-700 text-white text-sm font-bold py-1 px-3 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0"
                            >
                                <option value="en">English</option>
                                <option value="hi">हिंदी</option>
                                <option value="mr">मराठी</option>
                                <option value="te">తెలుగు</option>
                            </select>
                        </div>

                        {/* Big Mobile Profile Button */}
                        <button
                            onClick={() => {
                                onOpenProfile();
                                setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between bg-slate-700/50 hover:bg-slate-700 p-4 rounded-xl border border-slate-600 transition text-left overflow-hidden"
                        >
                            <div className="flex items-center space-x-3 min-w-0">
                                <div className={`p-2 rounded-lg shrink-0 ${isVet ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                    {isVet ? <ShieldCheck className="w-6 h-6 shrink-0" /> : <User className="w-6 h-6 shrink-0" />}
                                </div>
                                <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-base font-bold text-white truncate">
                                        {isVet ? `Dr. ${user?.full_name || user?.username}` : user?.full_name || user?.username}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-300 mt-0.5 truncate">
                                        {translateRole(user?.role)} • {t('nav_view_profile', 'View Profile & Settings')}
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Huge Mobile Logout Button */}
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-3.5 rounded-xl text-base font-bold transition shadow-sm whitespace-nowrap"
                        >
                            <LogOut className="w-5 h-5 shrink-0" />
                            <span className="truncate">{t('nav_logout_securely', 'Logout Securely')}</span>
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}