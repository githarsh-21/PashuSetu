import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Stethoscope, ClipboardList, ShieldAlert, Sparkles, Download, Search, PlusCircle,
    CheckCircle2, Syringe, User, Trash2, Crosshair, TrendingUp, Minus, Square
} from 'lucide-react';
import API from '../services/api';
import AIDiagnosisScanner from './AIDiagnosisScanner';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { pashuDb } from '../db/pashuDb'; // 📡 NEW: Import our local database

// Forces Leaflet to recalculate container geometry across mobile reflows, tab switches, and orientations
function MapResizeHandler() {
    const map = useMap();
    useEffect(() => {
        const t1 = setTimeout(() => map.invalidateSize(), 150);
        const t2 = setTimeout(() => map.invalidateSize(), 500);

        const handleResize = () => map.invalidateSize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [map]);
    return null;
}

export default function VetDashboard({ user }) {
    const { t, i18n } = useTranslation();

    const [activeTab, setActiveTab] = useState('registry');
    const [farmersList, setFarmersList] = useState([]);
    const [selectedFarmer, setSelectedFarmer] = useState('');
    const [availableCattle, setAvailableCattle] = useState([]);

    const [farmerSearch, setFarmerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeFarmerProfile, setActiveFarmerProfile] = useState(null);

    const [formData, setFormData] = useState({
        cattle_tag: '',
        visit_date: new Date().toISOString().split('T')[0],
        diagnosis: '',
        treatment_notes: '',
        medicines_prescribed: '',
        vaccine_name: '',
        vaccine_batch_no: '',
        vaccine_manufacturer: '',
        next_booster_date: ''
    });

    const [logs, setLogs] = useState([]);
    const [timeframe, setTimeframe] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const [outbreakData, setOutbreakData] = useState({ active_clusters: [], total_monitored_cases: 0 });

    useEffect(() => {
        API.get('/vet/farmers')
            .then(res => setFarmersList(res.data || []))
            .catch(err => console.error("Error fetching farmers:", err));

        API.get('/vet/outbreak-surveillance')
            .then(res => setOutbreakData(res.data || { active_clusters: [], total_monitored_cases: 0 }))
            .catch(err => console.error("Error fetching outbreak telemetry:", err));
    }, []);

    const fetchLogs = () => {
        if (!user?.username) return;
        setLoadingLogs(true);
        API.get(`/vet/clinical-logs/${user.username}?timeframe=${timeframe}&search=${encodeURIComponent(searchQuery)}`)
            .then(res => setLogs(res.data || []))
            .catch(err => console.error("Error fetching logs:", err))
            .finally(() => setLoadingLogs(false));
    };

    useEffect(() => {
        fetchLogs();
    }, [user, timeframe, searchQuery]);

    const filteredFarmers = farmersList.filter(f =>
        (f.name || '').toLowerCase().includes(farmerSearch.toLowerCase()) ||
        (f.username || '').toLowerCase().includes(farmerSearch.toLowerCase())
    );

    const handleSelectFarmer = (farmer) => {
        setSelectedFarmer(farmer.username);
        setFarmerSearch(`${farmer.name} (@${farmer.username})`);
        setActiveFarmerProfile(farmer);
        setAvailableCattle(farmer.cattle || []);
        setFormData(prev => ({ ...prev, cattle_tag: farmer.cattle?.[0]?.tag || 'UNREGISTERED' }));
        setShowDropdown(false);
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setFarmerSearch(val);
        setShowDropdown(true);
        if (val === '') {
            setSelectedFarmer('');
            setActiveFarmerProfile(null);
            setAvailableCattle([]);
            setFormData(prev => ({ ...prev, cattle_tag: 'UNREGISTERED' }));
        }
    };

    // 📡 NEW: Helper function to save offline via Dexie
    const saveOfflineLocally = async (payload) => {
        try {
            await pashuDb.offline_clinical_logs.add({
                ...payload,
                sync_status: 'pending',
                created_at: new Date().toISOString()
            });
            setStatusMsg('⚠️ No internet. Record saved locally and will auto-sync when network returns!');
            setFormData(prev => ({
                ...prev, diagnosis: '', treatment_notes: '', medicines_prescribed: '',
                vaccine_name: '', vaccine_batch_no: '', vaccine_manufacturer: '', next_booster_date: ''
            }));
            setTimeout(() => setStatusMsg(''), 5000);
        } catch (dbErr) {
            console.error("Local DB Error:", dbErr);
            alert("Failed to save offline. Please check storage permissions.");
        }
    };

    // 📡 UPDATED: Offline-aware Submit Handler
    const handleSubmitRecord = async (e) => {
        e.preventDefault();
        if (!selectedFarmer) {
            alert(t('alert_select_farmer', "Please select a farmer."));
            return;
        }

        const payload = {
            vet_username: user?.username || 'dr_vet',
            farmer_username: selectedFarmer,
            ...formData
        };

        // 1. Check if browser is explicitly offline
        if (!navigator.onLine) {
            await saveOfflineLocally(payload);
            return;
        }

        // 2. Try normal cloud save
        try {
            const res = await API.post('/vet/clinical-log', payload);

            if (res.data.status === 'success') {
                setStatusMsg(t('msg_record_saved', 'Record saved & synced with cattle health ledger!'));
                fetchLogs();
                setFormData(prev => ({
                    ...prev, diagnosis: '', treatment_notes: '', medicines_prescribed: '',
                    vaccine_name: '', vaccine_batch_no: '', vaccine_manufacturer: '', next_booster_date: ''
                }));
                setTimeout(() => setStatusMsg(''), 4000);
            } else {
                alert(t('alert_db_error', "Database Error: ") + res.data.message);
            }
        } catch (err) {
            // 3. Fallback to offline storage if network drops during fetch
            console.warn('Online save failed, storing locally:', err);
            await saveOfflineLocally(payload);
        }
    };

    const handleDeleteRecord = async (id) => {
        if (!window.confirm(t('confirm_delete_record', "Are you sure you want to delete this record? This action cannot be undone."))) return;

        try {
            const res = await API.delete(`/vet/clinical-log/${id}`);
            if (res.data.status === 'success') {
                setStatusMsg(t('msg_record_deleted', 'Record deleted successfully!'));
                fetchLogs();
                setTimeout(() => setStatusMsg(''), 4000);
            } else {
                alert(t('alert_db_error', "Database Error: ") + res.data.message);
            }
        } catch (err) {
            alert(t('alert_conn_error', "Failed to connect to server: ") + err.message);
        }
    };

    const handleExportCSV = () => {
        if (!logs || logs.length === 0) {
            alert(t('alert_no_export', "No records to export."));
            return;
        }

        const headers = [
            t('col_visit_date', "Visit Date"), t('col_farmer_name', "Farmer Name"), t('col_farmer_user', "Farmer Username"), t('col_mobile', "Mobile No"),
            t('col_address', "Address"), t('col_cattle_tag', "Cattle Tag"), t('col_diagnosis', "Diagnosis"), t('col_treatment', "Treatment Notes"),
            t('col_medicines', "Medicines Prescribed"), t('col_vac_name', "Vaccine Name"), t('col_vac_batch', "Batch No"),
            t('col_vac_mfg', "Manufacturer"), t('col_next_booster', "Next Booster Date")
        ];

        const csvRows = logs.map(log => {
            const rowData = [
                log.visit_date, log.farmer_name, log.farmer_username, log.farmer_phone,
                log.farmer_address, log.cattle_tag, log.diagnosis, log.treatment_notes,
                log.medicines_prescribed, log.vaccine_name, log.vaccine_batch_no,
                log.vaccine_manufacturer, log.next_booster_date || t('lbl_na', 'N/A')
            ];

            return rowData.map(value => {
                const safeValue = value ? String(value).replace(/"/g, '""') : "";
                return `"${safeValue}"`;
            }).join(',');
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `PashuSetu_Clinical_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Safe lookup translator
    const tDynamic = (text) => {
        if (!text) return '';
        const cleanKey = String(text).trim();

        const directTranslation = t(cleanKey, { keySeparator: false });
        if (directTranslation && directTranslation !== cleanKey) return directTranslation;

        const nsTranslation = t(`translation.${cleanKey}`, { keySeparator: false });
        if (nsTranslation && nsTranslation !== `translation.${cleanKey}`) return nsTranslation;

        return text;
    };

    const currentLang = i18n.language || 'en';
    const MAPTILER_KEY = "Ej7BgblKF0JiaT3Mrqgr";
    const mapTileUrl = `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}&lang=${currentLang}`;

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Header / Sub-Nav */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                    <div className="p-3 sm:p-3.5 bg-emerald-50 text-emerald-700 rounded-xl sm:rounded-2xl border border-emerald-100 shrink-0 mt-1 sm:mt-0">
                        <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{tDynamic('vet_title')}</h1>
                            <span className="text-[10px] sm:text-xs uppercase tracking-wider bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">{tDynamic('badge_vci_certified')}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">{tDynamic('vet_subtitle')}</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar w-full md:w-auto shrink-0">
                    <button
                        onClick={() => setActiveTab('registry')}
                        className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'registry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{tDynamic('tab_clinical_registry')}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('diagnosis')}
                        className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'diagnosis' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{tDynamic('tab_ai_diagnosis')}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('outbreak')}
                        className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'outbreak' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{tDynamic('tab_outbreak_radar')}</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: CLINICAL REGISTRY & ASSISTANCE */}
            {activeTab === 'registry' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Left: Input Form */}
                    <div className="lg:col-span-1 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center space-x-2">
                            <PlusCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>{tDynamic('log_treatment_title')}</span>
                        </h3>

                        {statusMsg && (
                            <div className={`p-3 border text-xs sm:text-sm rounded-xl font-medium flex items-center space-x-2 ${statusMsg.includes('offline') || statusMsg.includes('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                                <CheckCircle2 className={`w-4 h-4 shrink-0 ${statusMsg.includes('offline') || statusMsg.includes('⚠️') ? 'text-amber-600' : 'text-emerald-600'}`} />
                                <span>{statusMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmitRecord} className="space-y-4 text-sm">
                            <div className="relative z-20">
                                <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-1">{tDynamic('lbl_search_farmer')}</label>
                                <input
                                    type="text"
                                    placeholder={tDynamic('ph_search_farmer')}
                                    value={farmerSearch}
                                    onChange={handleSearchChange}
                                    onFocus={() => setShowDropdown(true)}
                                    required
                                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-sm appearance-none"
                                />

                                {showDropdown && farmerSearch && (
                                    <div className="absolute w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {filteredFarmers.length > 0 ? (
                                            filteredFarmers.map(f => (
                                                <div key={f.username} onClick={() => handleSelectFarmer(f)} className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0">
                                                    <p className="font-bold text-slate-900">{f.name}</p>
                                                    <p className="text-[10px] sm:text-xs text-slate-500">@{f.username} • {f.cattle?.length || 0} {tDynamic('lbl_cattle')}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-sm text-slate-500 italic text-center">{tDynamic('msg_no_farmers')}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {activeFarmerProfile && (
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center space-x-2">
                                        <User className="w-4 h-4 text-blue-700 shrink-0" />
                                        <span className="font-bold text-sm text-blue-900 leading-tight">{activeFarmerProfile.name}</span>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-blue-700 pl-6">📞 {activeFarmerProfile.phone}</p>
                                    <p className="text-[10px] sm:text-xs text-blue-700 pl-6 leading-snug">📍 {activeFarmerProfile.address}</p>
                                </div>
                            )}

                            <div>
                                <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-1">{tDynamic('lbl_cattle_tag')}</label>
                                <select
                                    value={formData.cattle_tag}
                                    onChange={e => setFormData({ ...formData, cattle_tag: e.target.value })}
                                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-sm appearance-none"
                                >
                                    <option value="UNREGISTERED">⚠️ {tDynamic('lbl_unregistered')}</option>
                                    {availableCattle.map(c => (
                                        <option key={c.tag} value={c.tag}>{c.tag} ({tDynamic(c.breed)})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-1">{tDynamic('lbl_visit_date')}</label>
                                    <input
                                        type="date"
                                        value={formData.visit_date}
                                        onChange={e => setFormData({ ...formData, visit_date: e.target.value })}
                                        className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm appearance-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-1">{tDynamic('lbl_diagnosis')}</label>
                                    <input
                                        type="text"
                                        placeholder={tDynamic('ph_diagnosis')}
                                        required
                                        value={formData.diagnosis}
                                        onChange={e => setFormData({ ...formData, diagnosis: e.target.value })}
                                        className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-1">{tDynamic('lbl_medicines')}</label>
                                <textarea
                                    rows="2"
                                    placeholder={tDynamic('ph_medicines')}
                                    value={formData.medicines_prescribed}
                                    onChange={e => setFormData({ ...formData, medicines_prescribed: e.target.value })}
                                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm"
                                />
                            </div>

                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center space-x-1.5">
                                    <Syringe className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tDynamic('lbl_vaccine_batch')}</span>
                                </span>

                                <input
                                    type="text"
                                    placeholder={tDynamic('ph_vaccine_name')}
                                    value={formData.vaccine_name}
                                    onChange={e => setFormData({ ...formData, vaccine_name: e.target.value })}
                                    className="w-full p-3 sm:p-2 bg-white border border-slate-200 rounded-lg text-sm sm:text-xs font-medium"
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <input
                                        type="text"
                                        placeholder={tDynamic('ph_batch_no')}
                                        value={formData.vaccine_batch_no}
                                        onChange={e => setFormData({ ...formData, vaccine_batch_no: e.target.value })}
                                        className="w-full p-3 sm:p-2 bg-white border border-slate-200 rounded-lg text-sm sm:text-xs font-medium"
                                    />
                                    <input
                                        type="text"
                                        placeholder={tDynamic('ph_manufacturer')}
                                        value={formData.vaccine_manufacturer}
                                        onChange={e => setFormData({ ...formData, vaccine_manufacturer: e.target.value })}
                                        className="w-full p-3 sm:p-2 bg-white border border-slate-200 rounded-lg text-sm sm:text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 sm:py-3 rounded-xl transition shadow-sm cursor-pointer mt-2"
                            >
                                💾 {tDynamic('btn_save_sync')}
                            </button>
                        </form>
                    </div>

                    {/* Right: History Table */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between overflow-hidden">
                        <div className="w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base sm:text-lg">{tDynamic('casebook_history')}</h3>
                                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{tDynamic('casebook_subtitle')}</p>
                                </div>

                                <button
                                    onClick={handleExportCSV}
                                    className="flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl transition self-start sm:self-auto cursor-pointer w-full sm:w-auto"
                                >
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tDynamic('btn_export_csv')}</span>
                                </button>
                            </div>

                            {/* Filters Bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                                <div className="sm:col-span-2 relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3.5 sm:top-3 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={tDynamic('ph_search_history')}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                                    />
                                </div>

                                <select
                                    value={timeframe}
                                    onChange={e => setTimeframe(e.target.value)}
                                    className="w-full py-3 sm:py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 appearance-none"
                                >
                                    <option value="all">{tDynamic('filter_all_time')}</option>
                                    <option value="7days">{tDynamic('filter_7_days')}</option>
                                    <option value="30days">{tDynamic('filter_30_days')}</option>
                                    <option value="1year">{tDynamic('filter_1_year')}</option>
                                </select>
                            </div>

                            <div className="overflow-x-auto border border-slate-100 rounded-xl w-full">
                                <table className="w-full text-left text-xs sm:text-sm text-slate-600 min-w-[900px]">
                                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="py-3 px-4">{tDynamic('table_date')}</th>
                                            <th className="py-3 px-4">{tDynamic('table_farmer_tag')}</th>
                                            <th className="py-3 px-4">{tDynamic('table_diagnosis')}</th>
                                            <th className="py-3 px-4">{tDynamic('table_prescription')}</th>
                                            <th className="py-3 px-4">{tDynamic('table_vaccine')}</th>
                                            <th className="py-3 px-4 text-right">{tDynamic('table_actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loadingLogs ? (
                                            <tr><td colSpan="6" className="text-center py-8">{tDynamic('msg_loading_ledger')}</td></tr>
                                        ) : logs.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-8 italic text-slate-400">{tDynamic('msg_no_records')}</td></tr>
                                        ) : (
                                            logs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">{log.visit_date}</td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="flex flex-col space-y-1">
                                                            <div className="flex items-center space-x-2">
                                                                <span className="font-bold text-slate-900">{log.farmer_name}</span>
                                                                <span className="text-[10px] sm:text-xs text-slate-500">@{log.farmer_username}</span>
                                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-black border border-emerald-200">{log.cattle_tag}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-3 text-[10px] sm:text-xs text-slate-500">
                                                                <span>📞 {log.farmer_phone}</span>
                                                                <span className="truncate max-w-[120px] sm:max-w-[150px]" title={log.farmer_address}>📍 {log.farmer_address}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 font-bold text-slate-800">{tDynamic(log.diagnosis)}</td>
                                                    <td className="py-3 px-4 max-w-[180px] sm:max-w-[200px] truncate" title={log.medicines_prescribed}>
                                                        {log.medicines_prescribed || <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        {log.vaccine_name ? (
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-200">
                                                                {log.vaccine_name} ({log.vaccine_batch_no || tDynamic('lbl_na')})
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteRecord(log.id)}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                                            title={tDynamic('title_delete_record')}
                                                        >
                                                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: OUTBREAK RADAR (Multilingual & Responsive UI) */}
            {activeTab === 'outbreak' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
                    {/* --- HEADER --- */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">
                                    {tDynamic('outbreak_radar_title')}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {tDynamic('outbreak_radar_subtitle')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white shadow-sm">
                                {outbreakData.active_clusters?.length || 0} {tDynamic('badge_active_zones')}
                            </span>
                        </div>
                    </div>

                    {/* --- MAIN LAYOUT (MAP + SIDEBAR) --- */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* 1. LEFT COLUMN: REAL LEAFLET MAP */}
                        <div className="w-full lg:w-7/12 xl:w-7/12 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner z-0 min-h-[360px] h-[360px] sm:h-[450px] lg:h-[580px] xl:h-[660px]">
                            <MapContainer
                                center={[21.1458, 79.0882]}
                                zoom={8}
                                scrollWheelZoom={false}
                                className="h-full w-full"
                                style={{ height: '100%', minHeight: '360px', width: '100%', zIndex: 0 }}
                            >
                                <MapResizeHandler />
                                <TileLayer
                                    key={currentLang}
                                    attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a>'
                                    url={mapTileUrl}
                                />
                                {outbreakData.active_clusters?.map((cluster, idx) => (
                                    <CircleMarker
                                        key={idx}
                                        center={cluster.coordinates}
                                        pathOptions={{
                                            color: cluster.severity === 'critical' ? '#e11d48' : '#d97706',
                                            fillColor: cluster.severity === 'critical' ? '#f43f5e' : '#fbbf24',
                                            fillOpacity: 0.4
                                        }}
                                        radius={Math.min(18 + (cluster.case_count * 4), 50)}
                                    >
                                        <Popup>
                                            <div className="text-center font-sans">
                                                <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">{tDynamic(cluster.disease)}</h4>
                                                <p className="text-[10px] sm:text-xs font-bold text-rose-600 mb-1 sm:mb-2">
                                                    {cluster.case_count} {tDynamic('lbl_active_cases_in')} {tDynamic(cluster.location)}
                                                </p>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                ))}
                            </MapContainer>
                        </div>

                        {/* 2. RIGHT COLUMN: HOTSPOT INTELLIGENCE CARDS */}
                        <div className="w-full lg:w-5/12 xl:w-5/12 flex flex-col gap-4">
                            <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase flex items-center gap-2 ml-1">
                                <Crosshair className="w-4 h-4" /> {tDynamic('detected_hotspots')}
                            </h3>

                            <div className="space-y-4 overflow-y-auto pr-2 pb-4 h-full max-h-[550px] xl:max-h-[660px] custom-scrollbar">
                                {!outbreakData.active_clusters || outbreakData.active_clusters.length === 0 ? (
                                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 font-bold text-sm">
                                        🟢 {tDynamic('no_active_clusters')}
                                    </div>
                                ) : (
                                    outbreakData.active_clusters.map((cluster, idx) => {
                                        const isCritical = cluster.severity === 'critical';

                                        const ColorConfig = {
                                            border: isCritical ? 'border-rose-200' : 'border-amber-200',
                                            bgHeader: isCritical ? 'bg-rose-50' : 'bg-amber-50',
                                            textMain: isCritical ? 'text-rose-700' : 'text-amber-700',
                                            badgeBg: isCritical ? 'bg-rose-600' : 'bg-amber-500',
                                        };

                                        return (
                                            <div key={idx} className={`bg-white rounded-xl border ${ColorConfig.border} shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md`}>
                                                {/* Card Header */}
                                                <div className={`${ColorConfig.bgHeader} p-4 border-b ${ColorConfig.border} flex justify-between items-start`}>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider text-white px-2 py-0.5 rounded shadow-sm ${ColorConfig.badgeBg}`}>
                                                                {isCritical ? tDynamic('badge_active_outbreak') : tDynamic('badge_emerging_hotspot')}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-base font-black text-slate-800">{tDynamic(cluster.disease)}</h4>
                                                        <p className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1.5">
                                                            📍 {tDynamic(cluster.location)} (15km {tDynamic('lbl_radius')})
                                                        </p>
                                                    </div>

                                                    {/* Velocity Tracker */}
                                                    <div className="text-right flex flex-col items-end">
                                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white border ${ColorConfig.border} shadow-sm ${ColorConfig.textMain}`}>
                                                            {cluster.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                                            {tDynamic(cluster.velocity || '+2 in 48h')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Telemetry Metrics */}
                                                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                                    <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-1">
                                                        📈 {tDynamic('lbl_telemetry_metrics')}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-center">
                                                            <p className="text-xl font-black text-slate-800">{cluster.case_count}</p>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{tDynamic('lbl_affected_cattle')}</p>
                                                        </div>
                                                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-center flex flex-col justify-center">
                                                            <p className="text-xs font-black text-slate-700 leading-tight">{tDynamic('lbl_last_48_hrs')}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{tDynamic('lbl_last_detected')}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Containment Protocol Checklist */}
                                                <div className="p-4 bg-white">
                                                    <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-1">
                                                        📋 {tDynamic('lbl_containment_protocol')}
                                                    </p>
                                                    <div className="space-y-2">
                                                        <label className="flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-50">
                                                            <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                                            <span className="text-xs font-medium text-slate-700">
                                                                {tDynamic(cluster.recommended_action)}
                                                            </span>
                                                        </label>
                                                        {isCritical && (
                                                            <label className="flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-50">
                                                                <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                                                <span className="text-xs font-medium text-slate-700">
                                                                    {tDynamic('lbl_ring_vaccination')}
                                                                </span>
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: AI DIAGNOSIS TRIAGE */}
            {activeTab === 'diagnosis' && (
                <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm space-y-5 sm:space-y-6 animate-in fade-in duration-300">
                    <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center space-x-2">
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                            <span>{tDynamic('ai_triage_title')}</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">{tDynamic('ai_triage_subtitle')}</p>
                    </div>

                    <div className="max-w-md bg-slate-50 p-4 rounded-xl border border-slate-200 relative z-20">
                        <label className="block font-bold text-slate-700 text-xs sm:text-sm mb-2">{tDynamic('search_patient_label')}</label>
                        <input
                            type="text"
                            placeholder={tDynamic('ph_search_farmer')}
                            value={farmerSearch}
                            onChange={handleSearchChange}
                            onFocus={() => setShowDropdown(true)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-sm appearance-none"
                        />
                        {showDropdown && farmerSearch && (
                            <div className="absolute w-[calc(100%-2rem)] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                {filteredFarmers.length > 0 ? (
                                    filteredFarmers.map(f => (
                                        <div key={f.username} onClick={() => handleSelectFarmer(f)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0">
                                            <p className="font-bold text-slate-900">{f.name}</p>
                                            <p className="text-[10px] sm:text-xs text-slate-500">@{f.username} • {f.cattle?.length || 0} {tDynamic('lbl_cattle')}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-sm text-slate-500 italic text-center">{tDynamic('msg_no_farmers')}</div>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedFarmer ? (
                        <div className="pt-2">
                            <AIDiagnosisScanner username={selectedFarmer} herd={availableCattle} />
                        </div>
                    ) : (
                        <div className="text-center py-12 sm:py-16 text-slate-400 font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-sm px-4">
                            {tDynamic('no_farmer_selected_ai')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}