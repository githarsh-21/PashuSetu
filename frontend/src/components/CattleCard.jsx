import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Tag, Activity, ChevronRight, Droplet, Syringe, X, HeartHandshake, Trash2 } from 'lucide-react';
import API from '../services/api';
import { pashuDb } from '../db/pashuDb'; // 📡 Import our local database

export default function CattleCard({ cattle, username, onOpenProfile, onLogVaccine, onRefresh, onRemoveLocally, alerts = [] }) {
    const { t, i18n } = useTranslation();

    const [showMilkModal, setShowMilkModal] = useState(false);
    const [showBreedingModal, setShowBreedingModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [morning, setMorning] = useState('');
    const [evening, setEvening] = useState('');
    const [notes, setNotes] = useState('');

    const [breedingDate, setBreedingDate] = useState(new Date().toISOString().split('T')[0]);
    const [eventType, setEventType] = useState('opt_ai');
    const [breedingNotes, setBreedingNotes] = useState('');

    const [archiveReason, setArchiveReason] = useState('Sold');
    const [loading, setLoading] = useState(false);

    const isFemale = cattle.gender === 'Female' || cattle.gender === 'मादी' || cattle.gender === 'ఆడ';

    // Translates breed string directly using JSON dictionaries
    const getTranslatedBreed = (breedName) => {
        if (!breedName) return t('lbl_unknown', 'Unknown');
        const normalizedKey = `breed_${breedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        return t(breedName, t(normalizedKey, breedName));
    };

    // Formats dates using the active language locale
    const formatDob = (dobStr) => {
        if (!dobStr) return t('lbl_na', 'N/A');
        const d = new Date(dobStr);
        if (isNaN(d.getTime())) return dobStr;
        return d.toLocaleDateString(i18n.language || 'en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const getVaccineStatus = () => {
        if (!alerts || alerts.length === 0) return 'ok';
        const today = new Date();
        let minDiffDays = Infinity;

        alerts.forEach(a => {
            if (a.next_due) {
                const diffDays = (new Date(a.next_due) - today) / (1000 * 60 * 60 * 24);
                if (diffDays < minDiffDays) minDiffDays = diffDays;
            }
        });

        if (minDiffDays < 0) return 'overdue';
        if (minDiffDays <= 14) return 'soon';
        return 'ok';
    };

    const vStatus = getVaccineStatus();
    let vStyles = "bg-slate-50 hover:bg-slate-600 hover:text-white text-slate-700 border-slate-200";
    if (vStatus === 'overdue') vStyles = "bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border-rose-200 ring-2 ring-rose-400";
    if (vStatus === 'soon') vStyles = "bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border-amber-200 ring-2 ring-amber-400";

    // 📡 Offline-aware Milk Logging
    const handleSaveMilkLog = async (e) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            username: username,
            cattle_tag: cattle.tag,
            morning_litres: parseFloat(morning || 0),
            evening_litres: parseFloat(evening || 0),
            log_date: date,
            notes: notes || ""
        };

        // 1. Check if offline
        if (!navigator.onLine) {
            try {
                await pashuDb.offline_milk_yields.add({
                    ...payload,
                    sync_status: 'pending',
                    created_at: new Date().toISOString()
                });
                alert(t('alert_no_net_save_local', '⚠️ No internet. Record saved locally and will auto-sync when network returns!'));
                setShowMilkModal(false);
                setMorning('');
                setEvening('');
                setNotes('');
            } catch (dbErr) {
                alert(t('alert_storage_err', 'Failed to save offline. Please check storage permissions.'));
            } finally {
                setLoading(false);
            }
            return;
        }

        // 2. Try online save
        try {
            await API.post('/milk/log', payload);
            setShowMilkModal(false);
            setMorning('');
            setEvening('');
            setNotes('');
            if (onRefresh) onRefresh();
        } catch (err) {
            // 3. Fallback to offline if network drops mid-request
            console.warn('Online save failed, storing locally:', err);
            try {
                await pashuDb.offline_milk_yields.add({
                    ...payload,
                    sync_status: 'pending',
                    created_at: new Date().toISOString()
                });
                alert(t('alert_net_drop_save_local', '⚠️ Network dropped. Record saved locally and will sync later.'));
                setShowMilkModal(false);
                setMorning('');
                setEvening('');
                setNotes('');
            } catch (dbErr) {
                alert(t('err_save_milk', 'Failed to save milk log.'));
            }
        } finally {
            setLoading(false);
        }
    };

    // 📡 Offline-aware Breeding Logging
    const handleSaveBreeding = async (e) => {
        e.preventDefault();
        setLoading(true);

        const eventPayloadMap = {
            opt_ai: 'Artificial Insemination (AI)',
            opt_natural: 'Natural Service',
            opt_preg_check: 'Pregnancy Check'
        };

        const payload = {
            username: username,
            cattle_tag: cattle.tag,
            event_type: eventPayloadMap[eventType] || eventType,
            event_date: breedingDate,
            notes: breedingNotes || ""
        };

        // 1. Check if offline
        if (!navigator.onLine) {
            try {
                await pashuDb.offline_breeding_logs.add({
                    ...payload,
                    sync_status: 'pending',
                    created_at: new Date().toISOString()
                });
                alert(t('alert_no_net_save_local', '⚠️ No internet. Record saved locally and will auto-sync when network returns!'));
                setShowBreedingModal(false);
                setBreedingNotes('');
            } catch (dbErr) {
                alert(t('alert_storage_err', 'Failed to save offline. Please check storage permissions.'));
            } finally {
                setLoading(false);
            }
            return;
        }

        // 2. Try online save
        try {
            await API.post('/breeding/log', payload);
            setShowBreedingModal(false);
            setBreedingNotes('');
            if (onRefresh) onRefresh();
        } catch (err) {
            // 3. Fallback to offline if network drops mid-request
            console.warn('Online save failed, storing locally:', err);
            try {
                await pashuDb.offline_breeding_logs.add({
                    ...payload,
                    sync_status: 'pending',
                    created_at: new Date().toISOString()
                });
                alert(t('alert_net_drop_save_local', '⚠️ Network dropped. Record saved locally and will sync later.'));
                setShowBreedingModal(false);
                setBreedingNotes('');
            } catch (dbErr) {
                alert(t('err_save_breed', 'Failed to save breeding record.'));
            }
        } finally {
            setLoading(false);
        }
    };

    // 📡 UPDATED: Offline-aware Cattle Archiving (Soft Delete)
    const handleArchiveCattle = async (e) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            username: username,
            cattle_tag: cattle.tag,
            status: archiveReason
        };

        const saveOfflineArchive = async (isNetworkDrop = false) => {
            try {
                // 1. Soft Delete: Mark as deleted in the local read-only cache
                await pashuDb.cached_herd.update(cattle.tag, { is_deleted: true });

                // 2. Queue the backend request in our new sync_queue
                await pashuDb.sync_queue.add({
                    action: 'ARCHIVE_CATTLE',
                    payload: payload
                });

                // 3. 📡 OPTIMISTIC UI: Instantly hide the cow from App.jsx's visual state
                if (onRemoveLocally) onRemoveLocally(cattle.tag);

                const msg = isNetworkDrop
                    ? t('alert_net_drop_save_local', '⚠️ Network dropped. Record saved locally and will sync later.')
                    : t('alert_no_net_save_local', '⚠️ No internet. Record saved locally and will auto-sync when network returns!');

                alert(msg);
                setShowArchiveModal(false);
            } catch (dbErr) {
                console.error(dbErr);
                alert(t('alert_storage_err', 'Failed to save offline. Please check storage permissions.'));
            }
        };

        // If explicitly offline, use soft delete logic
        if (!navigator.onLine) {
            await saveOfflineArchive(false);
            setLoading(false);
            return;
        }

        // Try online save
        try {
            await API.post('/cattle/archive', payload);
            setShowArchiveModal(false);
            if (onRefresh) onRefresh();
        } catch (err) {
            // Fallback to soft delete if connection drops mid-request
            console.warn('Online archive failed, storing locally:', err);
            await saveOfflineArchive(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className={`bg-white rounded-2xl shadow-sm border p-4 sm:p-5 hover:shadow-md transition flex flex-col justify-between relative group ${vStatus === 'overdue' ? 'border-rose-300' : 'border-slate-200'}`}>
                <div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                            <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                            <h3 className="font-bold text-slate-900 text-lg sm:text-xl truncate">{cattle.tag}</h3>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 sm:px-2.5 py-1 rounded-full border truncate max-w-[100px] sm:max-w-[150px] ${cattle.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                {cattle.status === 'Active' ? t('badge_active', 'Active') : t(`status_${cattle.status?.toLowerCase()}`, cattle.status)}
                            </span>
                            <button
                                onClick={() => setShowArchiveModal(true)}
                                className="text-slate-300 hover:text-rose-500 transition opacity-100 lg:opacity-0 lg:group-hover:opacity-100 cursor-pointer p-1 shrink-0"
                                title={t('title_remove_cattle', "Remove / Archive Cattle")}
                            >
                                <Trash2 className="w-4 h-4 sm:w-4 sm:h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 mb-4">
                        <div className="flex justify-between gap-2">
                            <span className="text-slate-400 shrink-0">{t('lbl_breed', 'Breed:')}</span>
                            <span className="font-medium text-slate-800 truncate text-right">
                                {getTranslatedBreed(cattle.breed)}
                            </span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-slate-400 shrink-0">{t('lbl_gender', 'Gender:')}</span>
                            <span className="font-medium text-slate-800 truncate text-right">
                                {cattle.gender ? t(`gender_${cattle.gender.toLowerCase()}`, cattle.gender) : t('lbl_unknown', 'Unknown')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 flex items-center gap-1 shrink-0">
                                <Calendar className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{t('lbl_approx_dob', 'Approx DOB:')}</span>
                            </span>
                            <span className="font-medium text-slate-800 truncate text-right">
                                {formatDob(cattle.dob)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 mt-2">
                    <button
                        onClick={() => onOpenProfile(cattle.tag)}
                        className="w-full flex items-center justify-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition cursor-pointer px-2"
                    >
                        <Activity className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t('btn_view_360', 'View 360° Records')}</span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>

                    <div className="flex gap-2">
                        {isFemale && (
                            <>
                                <button
                                    onClick={() => setShowMilkModal(true)}
                                    className="flex-1 flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 py-2 sm:py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition border border-blue-200 hover:border-transparent cursor-pointer min-w-0"
                                >
                                    <Droplet className="w-4 h-4 sm:w-4 sm:h-4 mb-1 sm:mb-0.5 shrink-0" />
                                    <span className="truncate w-full text-center">{t('btn_log_milk', 'Log Milk')}</span>
                                </button>
                                <button
                                    onClick={() => setShowBreedingModal(true)}
                                    className="flex-1 flex flex-col items-center justify-center bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 py-2 sm:py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition border border-purple-200 hover:border-transparent cursor-pointer min-w-0"
                                >
                                    <HeartHandshake className="w-4 h-4 sm:w-4 sm:h-4 mb-1 sm:mb-0.5 shrink-0" />
                                    <span className="truncate w-full text-center">{t('btn_breed', 'Breed')}</span>
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => onLogVaccine(cattle.tag)}
                            className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition border cursor-pointer min-w-0 ${vStyles}`}
                        >
                            <Syringe className="w-4 h-4 sm:w-4 sm:h-4 mb-1 sm:mb-0.5 shrink-0" />
                            <span className="text-center leading-tight line-clamp-2 w-full">
                                {vStatus === 'overdue' ? t('badge_overdue', 'OVERDUE') : vStatus === 'soon' ? t('badge_due_soon', 'DUE SOON') : t('btn_vaccine', 'Vaccine')}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL 1: LOG MILK */}
            {showMilkModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200 text-left">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 max-h-[95vh] flex flex-col">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden shrink-0"></div>
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="font-black text-slate-900 text-lg sm:text-xl truncate pr-2">{t('title_log_milk', 'Log Milk:')} {cattle.tag}</h3>
                            <button onClick={() => setShowMilkModal(false)} className="text-slate-400 hover:text-slate-700 transition cursor-pointer bg-slate-100 p-1.5 rounded-full shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveMilkLog} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_date', 'Date')}</label>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium appearance-none" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_morning_litres', 'Morning (Litres)')}</label>
                                    <input type="number" step="0.1" value={morning} onChange={(e) => setMorning(e.target.value)} placeholder="0.0" required className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_evening_litres', 'Evening (Litres)')}</label>
                                    <input type="number" step="0.1" value={evening} onChange={(e) => setEvening(e.target.value)} placeholder="0.0" required className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_observations', 'Observations / Events')}</label>
                                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('ph_observations', "e.g., Normal, Slight udder swelling...")} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                            </div>
                            <div className="flex space-x-3 pt-4 sm:pt-2">
                                <button type="button" onClick={() => setShowMilkModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 sm:py-3 rounded-xl transition text-sm cursor-pointer truncate px-2">{t('btn_cancel', 'Cancel')}</button>
                                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 sm:py-3 rounded-xl transition text-sm shadow-sm cursor-pointer truncate px-2">{loading ? t('btn_saving', 'Saving...') : t('btn_save_log', 'Save Log')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: LOG BREEDING */}
            {showBreedingModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200 text-left">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 max-h-[95vh] flex flex-col">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden shrink-0"></div>
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="font-black text-slate-900 text-lg sm:text-xl truncate pr-2">{t('title_log_insem', 'Log Insemination:')} {cattle.tag}</h3>
                            <button onClick={() => setShowBreedingModal(false)} className="text-slate-400 hover:text-slate-700 transition cursor-pointer bg-slate-100 p-1.5 rounded-full shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBreeding} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_event_type', 'Event Type')}</label>
                                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium appearance-none">
                                    <option value="opt_ai">{t('opt_ai', 'Artificial Insemination (AI)')}</option>
                                    <option value="opt_natural">{t('opt_natural', 'Natural Service')}</option>
                                    <option value="opt_preg_check">{t('opt_preg_check', 'Pregnancy Check')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_date', 'Date')}</label>
                                <input type="date" value={breedingDate} onChange={(e) => setBreedingDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium appearance-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_semen_details', 'Semen Details / Notes')}</label>
                                <input type="text" value={breedingNotes} onChange={(e) => setBreedingNotes(e.target.value)} placeholder={t('ph_semen_details', "e.g., Bull ID, Semen Batch No...")} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" />
                            </div>
                            <div className="flex space-x-3 pt-4 sm:pt-2">
                                <button type="button" onClick={() => setShowBreedingModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 sm:py-3 rounded-xl transition text-sm cursor-pointer truncate px-2">{t('btn_cancel', 'Cancel')}</button>
                                <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 sm:py-3 rounded-xl transition text-sm shadow-sm cursor-pointer truncate px-2">{loading ? t('btn_saving', 'Saving...') : t('btn_save_record', 'Save Record')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: ARCHIVE / SOFT DELETE QUESTIONNAIRE */}
            {showArchiveModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200 text-left">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border-t-4 border-rose-500 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 flex flex-col">
                        <div className="w-12 h-1.5 bg-rose-200 rounded-full mx-auto mt-4 sm:hidden shrink-0"></div>
                        <div className="px-5 sm:px-6 py-4 border-b border-rose-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="font-black text-rose-800 text-lg sm:text-xl truncate pr-2">{t('title_remove', 'Remove')} {cattle.tag}</h3>
                            <button onClick={() => setShowArchiveModal(false)} className="text-slate-400 hover:text-rose-700 transition cursor-pointer bg-rose-50 p-1.5 rounded-full shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleArchiveCattle} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                            <p className="text-sm text-slate-600 font-medium">
                                {t('msg_remove_reason', 'Why are you removing this animal from your active herd?')} <br />
                                <span className="text-[10px] sm:text-xs text-slate-400 font-normal italic block mt-1">{t('msg_preserve_data', '(Historical yield & vaccine data will be preserved).')}</span>
                            </p>
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{t('lbl_reason', 'Reason')}</label>
                                <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-rose-700 appearance-none">
                                    <option value="Sold">{t('opt_sold', 'Sold / Traded')}</option>
                                    <option value="Deceased">{t('opt_deceased', 'Deceased')}</option>
                                    <option value="Transferred">{t('opt_transferred', 'Transferred to another farm')}</option>
                                </select>
                            </div>
                            <div className="flex space-x-3 pt-4 sm:pt-2">
                                <button type="button" onClick={() => setShowArchiveModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 sm:py-3 rounded-xl transition text-sm cursor-pointer truncate px-2">{t('btn_cancel', 'Cancel')}</button>
                                <button type="submit" disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 sm:py-3 rounded-xl transition text-sm shadow-sm cursor-pointer truncate px-2">{loading ? t('btn_archiving', 'Archiving...') : t('btn_confirm_remove', 'Confirm Remove')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}