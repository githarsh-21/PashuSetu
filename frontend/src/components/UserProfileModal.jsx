import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, MapPin, Shield, Globe, X } from 'lucide-react';

export default function UserProfileModal({ user, onClose }) {
    const { t, i18n } = useTranslation();

    const changeLanguage = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 relative max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">

                {/* Mobile Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden"></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header Profile Identity */}
                <div className="text-center mb-6 pt-2 sm:pt-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-700 font-black text-2xl sm:text-3xl rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">{user.full_name || user.username}</h2>
                    <span className="inline-block mt-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full border border-emerald-200">
                        {user.role ? t(`role_${user.role.toLowerCase()}`, user.role) : t('role_farmer', 'Farmer')}
                    </span>
                </div>

                {/* Details Section */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm mb-6">
                    <div className="flex items-center space-x-3 text-slate-700">
                        <User className="w-4 h-4 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-500 shrink-0">{t('lbl_username', 'Username:')}</span>
                        <span className="font-bold text-slate-900 truncate">{user.username}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-slate-700">
                        <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-500 shrink-0">{t('lbl_phone', 'Phone:')}</span>
                        <span className="font-bold text-slate-900">{user.phone || t('lbl_not_provided', 'Not Provided')}</span>
                    </div>
                    <div className="flex items-start space-x-3 text-slate-700">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-500 shrink-0">{t('lbl_address', 'Address:')}</span>
                        <span className="font-bold text-slate-900 leading-tight break-words">{user.address || t('lbl_not_provided', 'Not Provided')}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-slate-700">
                        <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-500 shrink-0">{t('lbl_category', 'Category:')}</span>
                        <span className="font-bold text-slate-900">{user.category ? t(`category_${user.category.toLowerCase()}`, user.category) : t('category_general', 'General')}</span>
                    </div>
                </div>

                {/* Language Preference Setting */}
                <div className="mb-6 sm:mb-8">
                    <label className="flex items-center space-x-1.5 text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-2">
                        <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                        <span>{t('lbl_platform_language', 'Platform Language')}</span>
                    </label>
                    <select
                        value={i18n.language || 'en'}
                        onChange={changeLanguage}
                        className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
                    >
                        <option value="en">English</option>
                        <option value="hi">हिन्दी (Hindi)</option>
                        <option value="mr">मराठी (Marathi)</option>
                        <option value="te">తెలుగు (Telugu)</option>
                    </select>
                </div>

                {/* Action Button */}
                <button
                    onClick={onClose}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 sm:py-3 rounded-xl transition shadow-md cursor-pointer text-sm sm:text-base mb-2 sm:mb-0"
                >
                    {t('btn_close_profile', 'Close Profile')}
                </button>
            </div>
        </div>
    );
}