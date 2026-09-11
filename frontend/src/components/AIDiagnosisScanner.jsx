import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UploadCloud,
    Activity,
    AlertTriangle,
    Loader2,
    Sparkles,
    Download,
    WifiOff,
    Camera,
    FileText,
    CheckCircle2,
    HeartPulse
} from 'lucide-react';
import API from '../services/api';

export default function AIDiagnosisScanner({ username, herd = [] }) {
    const { t, i18n } = useTranslation();

    const [selectedTag, setSelectedTag] = useState(herd[0]?.tag || 'GENERAL-PATIENT');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [reportResult, setReportResult] = useState(null);
    const [error, setError] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Track network connectivity status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Clean up preview blob URL to prevent memory leaks
    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setReportResult(null);
            setError('');
        }
    };

    // Normalize active i18n language to ISO code ('mr', 'hi', 'te', or 'en')
    const getLanguageCode = () => {
        const currentLang = (i18n.language || 'en').toLowerCase().split('-')[0];
        return ['en', 'hi', 'mr', 'te'].includes(currentLang) ? currentLang : 'en';
    };

    const handleDiagnosisSubmit = async (e) => {
        e.preventDefault();
        if (!imageFile) {
            setError(t('err_no_image', 'Please upload an image of the cattle or affected area first.'));
            return;
        }

        if (!isOnline) {
            setError(t('err_offline_model', 'You are currently offline. Cloud AI Triage requires an active network connection.'));
            return;
        }

        setLoading(true);
        setError('');
        setReportResult(null);

        try {
            const formData = new FormData();
            formData.append('username', username || 'guest');
            formData.append('tag', selectedTag);
            formData.append('language', getLanguageCode());
            formData.append('image', imageFile);

            const res = await API.post('/diagnosis/triage', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data?.success) {
                setReportResult(res.data.report);
            } else {
                setError(t('err_parse_ai', 'AI Triage failed to parse response.'));
            }
        } catch (err) {
            const errorMsg = err.response?.data?.detail || t('err_connect_ai', 'Failed to connect to AI triage service.');
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!reportResult) return;

        try {
            setIsDownloading(true);
            setError('');

            const formData = new FormData();
            formData.append('username', username || 'guest');
            formData.append('tag', selectedTag);
            formData.append('language', getLanguageCode());
            formData.append('report_text', typeof reportResult === 'object' ? JSON.stringify(reportResult) : reportResult);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            const res = await API.post('/diagnosis/download-pdf', formData, {
                responseType: 'blob',
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            const fallbackTag = t('lbl_cattle', 'Cattle');
            const sanitizedTag = selectedTag && selectedTag !== 'GENERAL-PATIENT' ? selectedTag : fallbackTag;
            link.setAttribute('download', `PashuSetu_Report_${sanitizedTag}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download PDF', error);
            setError(t('err_pdf_gen', 'Failed to generate PDF. Make sure the backend server is running.'));
        } finally {
            setIsDownloading(false);
        }
    };

    // Resilient multilingual parser for JSON and text responses
    const parseReportData = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object' && raw.disease) return raw;

        // 1. Try direct JSON parsing
        try {
            const cleanStr = String(raw).replace(/```(?:json)?|```/g, '').trim();
            const parsed = JSON.parse(cleanStr);
            if (parsed && typeof parsed === 'object') {
                return {
                    disease: parsed.disease || parsed.condition || parsed.aajar || parsed.bimari || t('lbl_unknown_condition', 'Suspected Condition'),
                    severity: parsed.severity || parsed.urgency || 'Warning',
                    symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [parsed.symptoms].filter(Boolean),
                    advisory: Array.isArray(parsed.advisory) ? parsed.advisory : [parsed.advisory].filter(Boolean),
                };
            }
        } catch (e) {
            // 2. Multilingual regex fallback if string output is returned
            const text = String(raw);
            const diseaseMatch = text.match(/(?:Disease Name|Condition|आजाराचे नाव|बीमारी का नाम|रोग|వ్యాధి పేరు)\s*[:\-–]\s*([^\n\*\-]+)/i);
            const severityMatch = text.match(/(?:Severity|धोका पातळी|गंभीरता|తీవ్రత)\s*[:\-–]\s*([^\n\*\-]+)/i);

            let symptoms = [];
            const symMatch = text.match(/(?:Symptoms|Visible Symptoms|लक्षणे|लक्षण|లక్షణాలు)\s*[:\-–]?\s*([\s\S]*?)(?=(?:Farmer Advisory|Immediate Farmer Advisory|सल्ला|सलाह|సలహా|$))/i);
            if (symMatch && symMatch[1]) {
                symptoms = symMatch[1]
                    .split('\n')
                    .map(line => line.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim())
                    .filter(line => line.length > 2);
            }

            let advisory = [];
            const advMatch = text.match(/(?:Farmer Advisory|Immediate Farmer Advisory|सल्ला|सलाह|సలహా)\s*[:\-–]?\s*([\s\S]*?)$/i);
            if (advMatch && advMatch[1]) {
                advisory = advMatch[1]
                    .split('\n')
                    .map(line => line.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim())
                    .filter(line => line.length > 2);
            }

            return {
                disease: diseaseMatch ? diseaseMatch[1].trim() : t('lbl_unknown_condition', 'Suspected Condition'),
                severity: severityMatch ? severityMatch[1].trim() : 'Warning',
                symptoms,
                advisory,
            };
        }
        return null;
    };

    const parsedData = reportResult ? parseReportData(reportResult) : null;

    // Multilingual Urgency Color Evaluation
    const sevString = (parsedData?.severity || '').toLowerCase();
    const isCritical = sevString.includes('crit') || sevString.includes('तीव्र') || sevString.includes('गंभीर') || sevString.includes('తీవ్రమైన');
    const isWarning = sevString.includes('warn') || sevString.includes('मध्यम') || sevString.includes('सतर्कता') || sevString.includes('హెచ్చరిక');

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Offline Notification Banner */}
            {!isOnline && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
                        <span className="font-semibold">{t('msg_offline_mode', 'Offline Mode: Shell and cached UI active.')}</span>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono uppercase">Offline</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6 pb-4 border-b border-slate-100 min-w-0">
                <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 self-start sm:self-auto shrink-0">
                        <Sparkles className="w-6 h-6 shrink-0" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                            {t('ai_triage_title', 'AI Cattle Disease Triage')}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-0 truncate">
                            {t('ai_triage_subtitle', 'Upload a photo of symptoms (skin, eyes, udder, hoof) for instant AI diagnosis.')}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-3 sm:p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl flex items-center space-x-2 overflow-hidden">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span className="break-words">{error}</span>
                </div>
            )}

            <form onSubmit={handleDiagnosisSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Image Upload & Controls */}
                <div className="space-y-4 min-w-0 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="min-w-0">
                            <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-600 mb-1.5 truncate">
                                {t('lbl_select_cattle_tag', 'Select Cattle Tag')}
                            </label>
                            <select
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                            >
                                <option value="GENERAL-PATIENT">{t('opt_new_cow', 'New Cow (Not in Herd List)')}</option>
                                {herd.map((c) => (
                                    <option key={c.tag} value={c.tag}>
                                        {c.tag} {c.breed ? `(${t(c.breed, c.breed)})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="min-w-0">
                            <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-600 mb-1.5 truncate">
                                {t('lbl_symptom_image', 'Symptom Image')}
                            </label>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 sm:p-4 text-center hover:border-emerald-500 transition relative bg-slate-50 overflow-hidden">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    required
                                    onChange={handleImageChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                />
                                {imagePreview ? (
                                    <div className="space-y-3 p-1">
                                        <img
                                            src={imagePreview}
                                            alt={t('alt_preview', 'Preview')}
                                            className="w-full h-56 object-cover rounded-lg shadow-sm bg-slate-200"
                                        />
                                        <p className="text-[10px] sm:text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 px-3 rounded-lg inline-block truncate max-w-full">
                                            {t('lbl_replace_image', 'Tap to replace or retake photo')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="py-12 sm:py-16 space-y-2 min-w-0">
                                        <div className="flex justify-center items-center gap-2 text-slate-400">
                                            <Camera className="w-8 h-8 shrink-0" />
                                            <UploadCloud className="w-8 h-8 shrink-0" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 truncate">
                                            {t('lbl_snap_photo', 'Tap to snap photo or upload')}
                                        </p>
                                        <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                            {t('lbl_supports_img', 'Supports PNG, JPG, WEBP')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !isOnline}
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 sm:py-3 rounded-xl transition shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden px-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                                <span className="truncate">{t('btn_ai_analyzing', 'AI is Analyzing...')}</span>
                            </>
                        ) : (
                            <>
                                <Activity className="w-5 h-5 shrink-0" />
                                <span className="truncate">
                                    {!isOnline ? t('btn_offline', 'Offline (Reconnect to Run)') : t('btn_run_ai', 'Run AI Diagnosis')}
                                </span>
                            </>
                        )}
                    </button>
                </div>

                {/* Right Column: Framed Card Output */}
                <div className="bg-[#0b1329] text-white rounded-2xl p-4 sm:p-5 flex flex-col border border-slate-800 min-h-[440px] max-h-[560px] min-w-0 shadow-lg">
                    {/* Header Bar */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 shrink-0">
                        <div className="flex items-center space-x-2">
                            <HeartPulse className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-300">
                                {t('lbl_diagnostic_report', 'Diagnostic Report')}
                            </span>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-800/90 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                            SwinV2 + LLM
                        </span>
                    </div>

                    {loading ? (
                        <div className="text-center py-20 flex-1 flex flex-col justify-center items-center space-y-3 min-w-0">
                            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin shrink-0" />
                            <p className="text-xs sm:text-sm text-slate-400 px-4">
                                {t('msg_inspecting_visuals', 'Inspecting visual markers and compiling triage...')}
                            </p>
                        </div>
                    ) : reportResult ? (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {/* Action Row */}
                            <div className="flex justify-between items-center gap-2 mb-3 shrink-0">
                                <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold rounded-lg border border-emerald-500/30">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    {t('badge_farmer_advisory', 'Immediate Farmer Advisory (First Aid)')}
                                </span>

                                <button
                                    onClick={handleDownload}
                                    type="button"
                                    disabled={isDownloading}
                                    className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span>{isDownloading ? t('btn_generating', 'Generating...') : t('btn_save_pdf', 'Save PDF')}</span>
                                </button>
                            </div>

                            {/* Exact Card Template Layout */}
                            <div className="flex-1 overflow-y-auto pr-1 space-y-3 font-sans scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                                {parsedData ? (
                                    <div className="border border-dashed border-slate-700 rounded-xl bg-slate-950/60 divide-y divide-dashed divide-slate-700/80 overflow-hidden">
                                        {/* Row 1: Suspected Condition & Severity Badge */}
                                        <div className="p-3.5 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                    {t('lbl_clinical_diag', 'Suspected Condition')}:
                                                </p>
                                                <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                                                    {parsedData.disease}
                                                </h4>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider shrink-0 border ${isCritical
                                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                                    : isWarning
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                }`}>
                                                [ {parsedData.severity} ]
                                            </span>
                                        </div>

                                        {/* Row 2: Observed Symptoms */}
                                        {parsedData.symptoms && parsedData.symptoms.length > 0 && (
                                            <div className="p-3.5 space-y-2">
                                                <p className="text-xs font-bold text-slate-300 tracking-wide">
                                                    {t('lbl_symptoms', 'Key Symptoms Observed in Cattle')}:
                                                </p>
                                                <ul className="space-y-1.5 pl-1">
                                                    {parsedData.symptoms.map((sym, idx) => (
                                                        <li key={idx} className="text-xs sm:text-sm text-slate-200 flex items-start gap-2">
                                                            <span className="text-slate-400 font-bold leading-tight">•</span>
                                                            <span className="leading-snug">{sym}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Row 3: Immediate Farmer Advisory (First Aid) */}
                                        {parsedData.advisory && parsedData.advisory.length > 0 && (
                                            <div className="p-3.5 space-y-2">
                                                <p className="text-xs font-bold text-slate-300 tracking-wide">
                                                    {t('badge_farmer_advisory', 'Immediate Farmer Advisory (First Aid)')}:
                                                </p>
                                                <ul className="space-y-1.5 pl-1">
                                                    {parsedData.advisory.map((adv, idx) => (
                                                        <li key={idx} className="text-xs sm:text-sm text-emerald-300 flex items-start gap-2 font-medium">
                                                            <span className="text-emerald-400 font-bold leading-tight">✓</span>
                                                            <span className="leading-snug">{adv}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Fallback raw display */
                                    <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 whitespace-pre-wrap break-words text-slate-200 text-xs sm:text-sm">
                                        {reportResult}
                                    </div>
                                )}
                            </div>

                            {/* Veterinary Safety Disclaimer */}
                            <div className="flex items-start space-x-2.5 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-xl mt-3 shrink-0">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] sm:text-[11px] text-amber-200/80 italic leading-snug break-words">
                                    {t('msg_ai_disclaimer', 'This is an AI screening. Always consult your local PashuDhan / Veterinary officer before starting treatments.')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 flex-1 flex flex-col justify-center items-center space-y-3 min-w-0">
                            <FileText className="w-12 h-12 text-slate-700 shrink-0" />
                            <p className="text-xs sm:text-sm text-slate-500 px-4">
                                {t('msg_awaiting_upload', 'Awaiting symptom photo and analysis request.')}
                            </p>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}