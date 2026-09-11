import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, Syringe, Milk, HeartHandshake, Calendar, Trash2 } from 'lucide-react';
import API from '../services/api';

export default function Cattle360Modal({ username, tag, onClose }) {
    const { t, i18n } = useTranslation();

    const [data, setData] = useState(null);
    const [timeline, setTimeline] = useState({ past_history: [], upcoming_alerts: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('vaccines');
    const [expandedDiag, setExpandedDiag] = useState(null);

    const fetch360 = async () => {
        try {
            const [profileRes, timelineRes] = await Promise.all([
                API.get(`/cattle/profile-360/${username}/${tag}`),
                API.get(`/vaccination/timeline/${username}/${tag}`)
            ]);
            setData(profileRes.data);
            setTimeline(timelineRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tag) fetch360();
    }, [username, tag]);

    const formatNiceDate = (dateString) => {
        if (!dateString) return t('lbl_unknown_date', 'Unknown Date');
        const d = new Date(dateString);
        const hasTime = dateString.includes('T');

        const localeMap = {
            'en': 'en-IN',
            'hi': 'hi-IN',
            'mr': 'mr-IN',
            'te': 'te-IN'
        };
        const currentLocale = localeMap[i18n.language] || 'en-IN';

        return d.toLocaleDateString(currentLocale, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...(hasTime && { hour: '2-digit', minute: '2-digit' })
        });
    };

    const handleDelete = async (recordType, identifier) => {
        const confirmDelete = window.confirm(t('confirm_delete', 'Are you sure you want to delete this record?'));
        if (!confirmDelete) return;

        try {
            await API.post(`/${recordType}/delete`, {
                username: username,
                cattle_tag: tag,
                identifier: identifier
            });
            fetch360();
        } catch (err) {
            console.error(err);
            alert(t('err_delete_record', 'Failed to delete record. See console for details.'));
        }
    };

    const translateVaccineName = (name) => {
        if (!name) return t('lbl_sched_vaccine', 'Scheduled Vaccine');
        const lowerName = String(name).toLowerCase();
        if (lowerName.includes('albendazole')) return t('vac_deworming_alb', 'Deworming (Albendazole)');
        if (lowerName.includes('deworming')) return t('vac_deworming', 'Deworming');
        if (lowerName.includes('fmd') || lowerName.includes('foot & mouth')) return t('vac_fmd_full', 'Foot & Mouth Disease (FMD)');
        if (lowerName.includes('hs') || lowerName.includes('hemorrhagic')) return t('vac_hs', 'HS (Hemorrhagic Septicemia)');
        if (lowerName.includes('brucellosis')) return t('vac_brucellosis', 'Brucellosis');
        if (lowerName.includes('lsd') || lowerName.includes('lumpy')) return t('vac_lsd', 'Lumpy Skin Disease (LSD)');
        if (lowerName.includes('rabies')) return t('vac_rabies', 'Rabies');
        return name;
    };

    const translateStatus = (status) => {
        if (!status) return t('lbl_due_soon', 'Due Soon');
        const lowerStatus = String(status).toLowerCase();
        if (lowerStatus.includes('overdue')) return t('badge_overdue', 'OVERDUE');
        if (lowerStatus.includes('due now')) return t('status_due_now', 'DUE NOW');
        if (lowerStatus.includes('due next month')) return t('status_due_next_month', 'Due Next Month');
        if (lowerStatus.includes('scheduled')) return t('status_scheduled', 'Scheduled');
        return status;
    };

    const translateEventType = (type) => {
        if (!type) return '';
        const lowerType = String(type).toLowerCase();
        if (lowerType.includes('artificial') || lowerType.includes('(ai)')) return t('opt_ai', 'Artificial Insemination (AI)');
        if (lowerType.includes('natural')) return t('opt_natural', 'Natural Service');
        if (lowerType.includes('pregnancy')) return t('opt_preg_check', 'Pregnancy Check');
        return type;
    };

    const parseDiagnosisReport = (primaryText, fallbackText) => {
        let rawStr = String(primaryText).includes('{') ? String(primaryText) : String(fallbackText);

        let result = {
            disease: fallbackText && !String(fallbackText).includes('{') ? fallbackText : 'Clinical Assessment',
            severity: 'Review',
            symptoms: [],
            advisory: []
        };

        if (!rawStr || rawStr === 'undefined' || rawStr === 'null') return result;

        rawStr = rawStr.replace(/```(?:json)?|```/g, '').trim();
        if (rawStr.startsWith('"') && rawStr.endsWith('"')) {
            try { rawStr = JSON.parse(rawStr); } catch (e) { }
        }

        const toList = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
                return val.split(/\n/).map(s => s.replace(/^[-*•\d.\s]+/, '').trim()).filter(s => s.length > 2);
            }
            return [String(val)];
        };

        try {
            const parsed = JSON.parse(rawStr);
            result.disease = parsed.disease || parsed.condition || result.disease;
            result.severity = parsed.severity || parsed.urgency || result.severity;
            result.symptoms = toList(parsed.symptoms);
            result.advisory = toList(parsed.advisory);
            return result;
        } catch (e1) {
            try {
                let fixedStr = rawStr;
                if ((fixedStr.match(/"/g) || []).length % 2 !== 0) {
                    fixedStr += '"';
                }

                let missingBrackets = (fixedStr.match(/\[/g) || []).length - (fixedStr.match(/\]/g) || []).length;
                let missingBraces = (fixedStr.match(/\{/g) || []).length - (fixedStr.match(/\}/g) || []).length;

                while (missingBrackets > 0) { fixedStr += ']'; missingBrackets--; }
                while (missingBraces > 0) { fixedStr += '}'; missingBraces--; }

                const parsed = JSON.parse(fixedStr);
                result.disease = parsed.disease || parsed.condition || result.disease;
                result.severity = parsed.severity || parsed.urgency || result.severity;
                result.symptoms = toList(parsed.symptoms);
                result.advisory = toList(parsed.advisory);
                return result;
            } catch (e2) {
                const extractStr = (key) => {
                    const match = rawStr.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'));
                    return match ? match[1] : null;
                };

                const extractArr = (key) => {
                    const keyIdx = rawStr.indexOf(`"${key}"`);
                    if (keyIdx === -1) return [];
                    const block = rawStr.substring(keyIdx, rawStr.indexOf(']', keyIdx) + 1 || rawStr.length);
                    const matches = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]);
                    return matches.filter(m => m.toLowerCase() !== key.toLowerCase());
                };

                result.disease = extractStr('disease') || extractStr('condition') || result.disease;
                result.severity = extractStr('severity') || extractStr('urgency') || result.severity;
                result.symptoms = extractArr('symptoms');
                result.advisory = extractArr('advisory');
            }
        }

        if (result.disease.includes('{') || result.disease.length > 50) {
            result.disease = fallbackText && !String(fallbackText).includes('{') ? fallbackText : 'AI Clinical Scan';
        }

        return result;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex justify-end">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">

                {/* Header */}
                <div className="p-4 sm:p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <span className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-400 font-bold">
                            {t('title_cattle_360', 'Cattle Health 360°')}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold">{t('lbl_tag', 'Tag:')} {tag}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer transition">
                        <X className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-2 sm:px-6 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'vaccines', label: t('tab_vaccines', 'Vaccination History'), icon: Syringe },
                        { id: 'diagnoses', label: t('tab_diagnoses', 'AI Diagnoses'), icon: Activity },
                        { id: 'milk', label: t('tab_milk', 'Milk Records'), icon: Milk },
                        { id: 'breeding', label: t('tab_breeding', 'Breeding'), icon: HeartHandshake },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-emerald-600 text-emerald-600 bg-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Body */}
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-slate-50/30">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500 font-medium">
                            {t('msg_loading_360', 'Loading 360° health record...')}
                        </div>
                    ) : (
                        <div>
                            {/* --- VACCINES --- */}
                            {activeTab === 'vaccines' && (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-3">
                                            {t('title_action_req', 'Action Required / Upcoming Schedule')}
                                        </h4>
                                        {timeline?.upcoming_alerts?.length > 0 ? (
                                            <div className="space-y-2">
                                                {timeline.upcoming_alerts.map((alert, idx) => {
                                                    let rawName = alert.vaccine_name || alert.vaccine;
                                                    let rawDate = alert.due_date || alert.date;
                                                    let rawStatus = alert.status;

                                                    if (!rawName && !rawDate && Array.isArray(alert)) {
                                                        if (typeof alert[0] === 'string' && alert[0].match(/^\d{4}-/)) {
                                                            rawDate = alert[0];
                                                            rawName = alert[1];
                                                            rawStatus = alert[2];
                                                        } else {
                                                            rawName = alert[0];
                                                            rawDate = alert[1];
                                                            rawStatus = alert[2];
                                                        }
                                                    }

                                                    const vName = translateVaccineName(rawName);
                                                    const vDate = rawDate ? formatNiceDate(rawDate) : t('lbl_upcoming', 'Upcoming');
                                                    const vStatus = translateStatus(rawStatus);
                                                    const isOverdue = String(rawStatus).toLowerCase().includes('overdue') || String(rawStatus).toLowerCase().includes('due now');

                                                    return (
                                                        <div key={`up-${idx}`} className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm ${isOverdue ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                                                            <div>
                                                                <p className={`font-bold text-sm sm:text-base ${isOverdue ? 'text-rose-800' : 'text-amber-800'}`}>
                                                                    {vName}
                                                                </p>
                                                                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                    {t('lbl_target_date', 'Target Date:')} {vDate}
                                                                </p>
                                                            </div>
                                                            <span className={`text-[10px] sm:text-xs font-black px-3 py-1 rounded-full border self-start sm:self-auto whitespace-nowrap ${isOverdue ? 'bg-rose-200 text-rose-800 border-rose-300' : 'bg-amber-200 text-amber-800 border-amber-300'}`}>
                                                                {vStatus}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic px-2">
                                                {t('msg_all_clear', 'No upcoming vaccinations predicted by the engine. All clear! 🎉')}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-3 border-t border-slate-200 pt-5">
                                            {t('title_hist_log', 'Historical Log')}
                                        </h4>
                                        {data?.vaccinations?.length > 0 ? (
                                            <div className="space-y-2">
                                                {data.vaccinations.map((row, idx) => (
                                                    <div key={`hist-${idx}`} className="p-3.5 rounded-xl border border-slate-200 bg-white flex justify-between items-center relative group shadow-sm">
                                                        <div className="pr-8">
                                                            <span className="font-bold text-slate-700 text-sm">{translateVaccineName(row[0])}</span>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {t('lbl_administered', 'Administered:')} {formatNiceDate(row[1])}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDelete('vaccination', row[1])}
                                                            className="absolute top-3.5 right-3.5 text-slate-300 hover:text-rose-500 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer p-1"
                                                            title={t('title_delete_record', 'Delete Record')}
                                                        >
                                                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 text-center py-6">
                                                {t('msg_no_past_vax', 'No past vaccination logs recorded.')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* --- AI DIAGNOSES --- */}
                            {activeTab === 'diagnoses' && (
                                <div className="space-y-4">
                                    {data?.diagnoses?.length ? (
                                        data.diagnoses.map((row, idx) => {
                                            const reportData = parseDiagnosisReport(row[3], row[2]);

                                            const sevString = (reportData.severity || '').toLowerCase();
                                            const isCritical = sevString.includes('crit') || sevString.includes('गंभीर') || sevString.includes('తీవ్రమైన');

                                            const badgeColors = isCritical
                                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                                : 'bg-amber-100 text-amber-800 border-amber-200';
                                            const iconColors = isCritical
                                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                : 'bg-amber-50 text-amber-500 border-amber-100';

                                            const isTimeout = String(row[3]).includes('Diagnosis Timeout');
                                            const isExpanded = expandedDiag === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${isExpanded ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'}`}
                                                >

                                                    {/* 1. Primary Visible Tier (Glanceable) */}
                                                    <div
                                                        onClick={() => setExpandedDiag(isExpanded ? null : idx)}
                                                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors relative group"
                                                    >
                                                        <div className="flex items-center gap-4 pr-10 sm:pr-0">
                                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${iconColors}`}>
                                                                <Activity className="w-5 h-5" />
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center gap-3 flex-wrap mb-1">
                                                                    <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight">
                                                                        {isTimeout ? 'Diagnosis Timeout' : reportData.disease}
                                                                    </h3>
                                                                    {!isTimeout && (
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeColors}`}>
                                                                            {reportData.severity}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs font-medium flex items-center gap-2">
                                                                    <span className="text-slate-500">{formatNiceDate(row[0])}</span>
                                                                    <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                                                                    <span className="text-emerald-600 font-bold transition-opacity">
                                                                        {isExpanded ? t('lbl_hide_details', 'Hide Details ↑') : t('lbl_view_details', 'View Details & Actions ↓')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete('diagnosis', row[0]); }}
                                                            className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 text-slate-300 hover:text-rose-500 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 bg-white sm:bg-transparent rounded-md hover:bg-rose-50 z-10"
                                                            title={t('title_delete_record', 'Delete Record')}
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>

                                                    {/* 2. Secondary Expandable Tier (Action View) */}
                                                    {isExpanded && (
                                                        <div
                                                            className="border-t border-slate-100 bg-white p-4 sm:p-5 animate-in slide-in-from-top-2 fade-in duration-200"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {isTimeout ? (
                                                                <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg border border-amber-200">
                                                                    {t('err_diagnosis_timeout', '⚠️ The AI was analyzing the image but ran out of processing space. Please try running the diagnosis again.')}
                                                                </p>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                                        <p className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wider">
                                                                            {t('lbl_symptoms', 'Key Symptoms Observed')}
                                                                        </p>
                                                                        {reportData.symptoms?.length > 0 ? (
                                                                            <ul className="space-y-2">
                                                                                {reportData.symptoms.map((sym, i) => (
                                                                                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                                                                                        <span className="text-slate-400 font-black mt-0.5">•</span>
                                                                                        <span className="leading-snug">{sym}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : (
                                                                            <p className="text-sm text-slate-500 italic">No specific symptoms recorded.</p>
                                                                        )}
                                                                    </div>

                                                                    <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
                                                                        <p className="text-xs font-bold text-emerald-700 mb-2.5 uppercase tracking-wider">
                                                                            {t('badge_farmer_advisory', 'Immediate Action Plan')}
                                                                        </p>
                                                                        {reportData.advisory?.length > 0 ? (
                                                                            <ul className="space-y-2">
                                                                                {reportData.advisory.map((adv, i) => (
                                                                                    <li key={i} className="text-sm text-emerald-900 flex items-start gap-2.5 font-medium">
                                                                                        <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                                                                                        <span className="leading-snug">{adv}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : (
                                                                            <p className="text-sm text-emerald-700 italic">Consult your local veterinarian.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-xl border border-slate-200 border-dashed">
                                            <Activity className="w-8 h-8 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">
                                                {t('msg_no_diag', 'No diagnostic scans recorded for this animal.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- MILK RECORDS --- */}
                            {activeTab === 'milk' && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 text-sm">{t('title_milking_hist', 'Milking History')}</h4>
                                    {data?.milk_logs?.length ? (
                                        data.milk_logs.map((row, idx) => {
                                            const mYield = parseFloat(row[1]) || 0;
                                            const eYield = parseFloat(row[2]) || 0;
                                            const calculatedTotal = (mYield + eYield).toFixed(1);

                                            return (
                                                <div key={idx} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white shadow-sm relative group">
                                                    <div className="flex items-start sm:items-center space-x-3 pr-8">
                                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-1 sm:mt-0">
                                                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-800 text-sm block">{formatNiceDate(row[0])}</span>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {t('lbl_morning_m', 'M:')} {mYield}L • {t('lbl_evening_e', 'E:')} {eYield}L
                                                            </p>
                                                            {row[4] && <p className="text-[10px] sm:text-xs text-slate-400 italic mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">{t('lbl_note', 'Note:')} {row[4]}</p>}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-slate-100">
                                                        <span className="font-black text-emerald-700 text-base sm:text-lg bg-emerald-50 sm:bg-transparent px-3 py-1 sm:p-0 rounded-lg">
                                                            {t('lbl_total', 'Total:')} {calculatedTotal}L
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleDelete('milk', row[0])}
                                                        className="absolute top-3.5 right-3.5 text-slate-300 hover:text-rose-500 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer p-1"
                                                        title={t('title_delete_record', 'Delete Record')}
                                                    >
                                                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center py-6">
                                            {t('msg_no_milk_logs', 'No milk records logged yet for this tag.')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* --- BREEDING --- */}
                            {activeTab === 'breeding' && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 text-sm">
                                        {t('title_insem_hist', 'Insemination & Breeding History')}
                                    </h4>
                                    {data?.breeding_events?.length ? (
                                        data.breeding_events.map((row, idx) => (
                                            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm relative group">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2 pr-8">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md shrink-0">
                                                            <HeartHandshake className="w-4 h-4" />
                                                        </div>
                                                        <span className="font-bold text-slate-800 text-sm">{translateEventType(row[0])}</span>
                                                    </div>
                                                    <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded bg-slate-50 text-slate-600 border border-slate-200 self-start sm:self-auto">
                                                        {formatNiceDate(row[1])}
                                                    </span>
                                                </div>

                                                <div className="sm:pl-9 space-y-1.5">
                                                    {row[2] && (
                                                        <p className="text-xs sm:text-sm text-slate-700 bg-purple-50/50 p-2 rounded-lg border border-purple-100/50">
                                                            <span className="font-semibold text-purple-700 block sm:inline">{t('lbl_expected_calving', 'Expected Calving:')}</span> {formatNiceDate(row[2])}
                                                        </p>
                                                    )}
                                                    {row[4] && (
                                                        <p className="text-[10px] sm:text-xs text-slate-500 italic mt-1">
                                                            <span className="font-semibold text-slate-600 not-italic">{t('lbl_notes', 'Notes:')}</span> {row[4]}
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleDelete('breeding', row[1])}
                                                    className="absolute top-3.5 right-3.5 text-slate-300 hover:text-rose-500 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer p-1"
                                                    title={t('title_delete_record', 'Delete Record')}
                                                >
                                                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center py-6">
                                            {t('msg_no_breed_logs', 'No breeding events logged.')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}