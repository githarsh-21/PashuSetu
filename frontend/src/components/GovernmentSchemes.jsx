import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark, Loader2, Info, CheckCircle2, Lock, Gift, Building2, ShieldAlert, ArrowRight, X, FileText, ExternalLink } from 'lucide-react';
import API from '../services/api';

// Accurate scheme-specific directory for documents and PERMANENT live application links
const SCHEME_DETAILS_DIRECTORY = {
    "Pashu Kisan Credit Card (PKCC)": {
        documents: [
            "Filled KCC Application Form (Animal Husbandry)",
            "Identity & Address Proof (Aadhaar Card, Voter ID, or PAN Card)",
            "Proof of Livestock / Animal Health Certificate (INAPH Ear Tag)",
            "Land Ownership Records (7/12, Khatauni) or Lease Agreement",
            "Bank Passbook Copy & Passport-size Photographs"
        ],
        portalLink: "https://www.jansamarth.in/",
        portalName: "JanSamarth (National Credit Portal)"
    },
    "National Livestock Mission (NLM)": {
        documents: [
            "Applicant Aadhaar & PAN Card",
            "Detailed Project Report (DPR) / Business Plan",
            "Proof of Land Ownership or Registered Lease Agreement",
            "Bank Account KYC & 6-Month Statement",
            "Caste Certificate (if claiming SC/ST subsidy benefits)"
        ],
        portalLink: "https://nlm.udyamimitra.in/",
        portalName: "NLM Udyami Mitra Portal"
    },
    "Rashtriya Gokul Mission (RGM)": {
        documents: [
            "Aadhaar Card",
            "Breed Registration / Pedigree Certificate of Indigenous Cow",
            "Bank Passbook details (Aadhaar linked)",
            "INAPH / Pashu Aadhaar Ear-Tag Number"
        ],
        portalLink: "https://dahd.gov.in/",
        portalName: "National Dairy Portal (DAHD)"
    },
    "Animal Husbandry Infrastructure Development Fund (AHIDF)": {
        documents: [
            "Detailed Techno-Economic Feasibility Report (TEFR)",
            "MSME Udyam Registration Certificate",
            "Land Title / Factory Site Approval Documents",
            "Audited Financial Statements (Last 3 Years) & PAN Card",
            "Bank In-Principle Loan Sanction Letter"
        ],
        portalLink: "https://ahidf.udyamimitra.in/",
        portalName: "AHIDF Udyami Mitra Portal"
    },
    "Dairy Entrepreneurship Development Scheme (DEDS)": {
        documents: [
            "Aadhaar Card & Proof of Identity",
            "Project Proposal for 2–10 Milch Animals",
            "Caste Certificate (for 33.3% SC/ST subsidy)",
            "Land Record (7/12, 8A, or equivalent Title Deed)",
            "Bank Sanction Letter & Savings Account Passbook"
        ],
        portalLink: "https://www.nabard.org/",
        portalName: "NABARD Official Portal"
    },
    "Navinyapurna Yojana (Maharashtra Innovative Dairy Scheme)": {
        documents: [
            "Aadhaar Card & Ration Card",
            "Maharashtra 7/12 and 8A Land Revenue Extracts",
            "Caste Certificate (for SC/ST 75% subsidy rate)",
            "Small/Marginal Farmer Certificate or Educated Unemployed Certificate",
            "Nationalized Bank Account Passbook"
        ],
        portalLink: "https://dahd.maharashtra.gov.in/en/scheme/state-level-innovative-scheme/",
        portalName: "Maha AHD Official Portal"
    },
    "Sharad Pawar Gramin Samridhi Yojana (Cow Shed Construction)": {
        documents: [
            "Aadhaar Card & Active MGNREGA Job Card",
            "7/12 Land Extract in applicant's name",
            "Gram Panchayat Recommendation / Resolution Copy",
            "Livestock Ownership Proof / Ear-Tag List (Minimum 2 cattle)",
            "Bank Passbook linked with Aadhaar/DBT"
        ],
        portalLink: "https://rdd.maharashtra.gov.in/",
        portalName: "Maha Rural Dev Portal"
    },
    "YSR Cheyutha & Jagananna Pala Velluva": {
        documents: [
            "Applicant Aadhaar Card (Women aged 45–60 years)",
            "Integrated Community / Caste Certificate (BC, SC, ST, Minority)",
            "Self-Help Group (SHG) Membership Certificate",
            "Rice Card / BPL Ration Card",
            "Aadhaar-Linked Bank Savings Account Passbook"
        ],
        portalLink: "https://vsws.ap.gov.in/",
        portalName: "AP Grama/Ward Sachivalayam"
    },
    "YSR Pasu Nashta Parihara Padhakam (Livestock Loss Compensation)": {
        documents: [
            "Farmer Aadhaar Card",
            "Official Post-Mortem Certificate issued by Govt. Veterinary Surgeon",
            "Intact Animal Ear Tag / Photo Evidence of Tagged Animal",
            "Rythu Bharosa Kendra (RBK) Registration Slip",
            "Bank Account Passbook"
        ],
        portalLink: "https://ahd.aptonline.in/",
        portalName: "AP Animal Husbandry Portal"
    }
};

export default function GovernmentSchemes({ username }) {
    const { t } = useTranslation();
    const [schemesData, setSchemesData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedScheme, setSelectedScheme] = useState(null);

    useEffect(() => {
        async function fetchSchemes() {
            if (!username) return;

            try {
                setLoading(true);
                // Parallel fetch to guarantee we grab both the schemes payload and the active cattle count
                const [schemesRes, cattleRes] = await Promise.all([
                    API.get(`/schemes/${username}`),
                    API.get(`/cattle/${username}`).catch(() => ({ data: { herd: [] } }))
                ]);

                const apiData = schemesRes.data;
                const contentData = apiData.content || {};
                const activeCattleCount = cattleRes.data.herd?.filter(c => c.status === 'Active').length || 0;

                // Safely merge the demographic profile we attached in api.py with the AI content
                const mergedData = {
                    ...contentData,
                    profile: {
                        ...(contentData.profile || {}),
                        ...(apiData.profile || {}),
                        cows: activeCattleCount
                    }
                };

                // 📡 CACHE IT: Save to local storage for offline access
                localStorage.setItem(`pashusetu_schemes_cache_${username}`, JSON.stringify(mergedData));

                setSchemesData(mergedData);
                setError('');
            } catch (err) {
                // 📡 OFFLINE FALLBACK: Try to load from cache
                console.warn("Network offline or fetch error, loading cached schemes...");
                const cachedData = localStorage.getItem(`pashusetu_schemes_cache_${username}`);

                if (cachedData) {
                    setSchemesData(JSON.parse(cachedData));
                    setError('');
                } else {
                    setError(t('err_fetch_schemes', 'Failed to fetch government schemes. Please check your internet connection.'));
                }
            } finally {
                setLoading(false);
            }
        }

        fetchSchemes();
    }, [username]);

    const getSchemeDetails = (schemeName) => {
        return SCHEME_DETAILS_DIRECTORY[schemeName] || {
            documents: [
                "Applicant Aadhaar Card",
                "Active Bank Account Passbook",
                "Cattle Health / Ear-Tag Certificate",
                "Passport-sized Photograph"
            ],
            portalLink: "https://www.jansamarth.in/",
            portalName: "JanSamarth / DAHD Portal"
        };
    };

    const handleApplyClick = (scheme) => {
        const extraDetails = getSchemeDetails(scheme.name);
        setSelectedScheme({ ...scheme, ...extraDetails });
    };

    const closeModal = () => setSelectedScheme(null);

    // --- TRANSLATION INTERCEPTORS ---
    const translateGender = (gender) => {
        if (!gender) return 'N/A';
        const lower = String(gender).toLowerCase();
        if (lower === 'male') return t('gender_male', 'Male');
        if (lower === 'female') return t('gender_female', 'Female');
        return gender;
    };

    const translateCategory = (cat) => {
        if (!cat) return 'N/A';
        const lower = String(cat).toLowerCase();
        if (lower === 'general') return t('category_general', 'General');
        if (lower === 'sc') return t('category_sc', 'SC');
        if (lower === 'st') return t('category_st', 'ST');
        if (lower === 'obc') return t('category_obc', 'OBC');
        return cat;
    };

    const tDynamic = (text) => {
        if (!text) return '';
        const exactKey = String(text).trim();
        return t(exactKey, { defaultValue: text, keySeparator: false });
    };

    if (loading && !schemesData) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 max-w-4xl mx-auto text-center space-y-3 mx-4 sm:mx-auto">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                <p className="text-sm text-slate-500">{t('msg_checking_schemes', 'Checking eligibility for State and Central schemes...')}</p>
            </div>
        );
    }

    if (error || (schemesData && schemesData.error)) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 max-w-4xl mx-auto mx-4 sm:mx-auto">
                <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>{error || schemesData.error}</span>
                </div>
            </div>
        );
    }

    const profile = schemesData?.profile || {};
    const eligible = schemesData?.eligible || [];
    const future = schemesData?.future || [];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 max-w-4xl mx-auto relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 mb-5 sm:mb-6 pb-4 border-b border-slate-100">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600 self-start shrink-0">
                    <Landmark className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{t('schemes_title', 'Government Schemes & Subsidies')}</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">{t('schemes_subtitle', 'Personalized livestock welfare programs based on your profile.')}</p>
                </div>
            </div>

            {/* Profile Overview Banner */}
            <div className="flex items-start space-x-3 mb-6 sm:mb-8 text-blue-800 bg-blue-50 p-4 rounded-xl text-xs sm:text-sm border border-blue-100">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold mb-1 leading-snug">
                        {t('msg_welcome', 'Welcome')}, {profile.name || 'Farmer'}! {t('msg_calibrated', 'Your dashboard is calibrated to your profile.')}
                    </p>
                    <p className="text-blue-600/80 leading-snug">
                        {t('lbl_audited_profile', 'Audited Profile:')} <span className="font-bold text-blue-800">{profile.cows || 0} {t('lbl_cattle', 'Cattle')}</span> | {t('lbl_category', 'Category:')} <span className="font-bold text-blue-800">{translateCategory(profile.category)} / {translateGender(profile.gender)}</span>
                    </p>
                </div>
            </div>

            {/* Eligible Schemes Section */}
            <div className="mb-8 sm:mb-10">
                <h3 className="text-base sm:text-lg font-black text-slate-800 mb-4 flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>{t('title_eligible_schemes', 'Currently Eligible Schemes')}</span>
                </h3>

                {eligible.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eligible.map((s, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition hover:border-emerald-200 flex flex-col justify-between">
                                <div>
                                    <div className="mb-3">
                                        <h4 className="font-bold text-slate-800 text-sm sm:text-[15px] leading-tight">{tDynamic(s.name)}</h4>
                                    </div>
                                    <div className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-600 text-[10px] sm:text-xs px-2.5 py-1 rounded-md mb-3 font-semibold">
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>{tDynamic(s.provider)}</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-500 mb-4 line-clamp-2 leading-relaxed">{tDynamic(s.overview)}</p>
                                    <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-[11px] sm:text-sm font-semibold flex items-start space-x-2 border border-emerald-100/50 mb-4">
                                        <Gift className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span className="leading-snug">{tDynamic(s.benefit)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleApplyClick(s)}
                                    className="w-full mt-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 sm:py-2.5 rounded-lg flex items-center justify-center space-x-2 transition shadow-sm cursor-pointer"
                                >
                                    <span>{t('btn_learn_apply', 'Learn How to Apply')}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
                        {t('msg_no_eligible', 'You currently do not meet the minimum requirements for the tracked schemes.')}
                    </p>
                )}
            </div>

            {/* Future Opportunities Section */}
            <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 mb-4 flex items-center space-x-2">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <span>{t('title_future_opps', 'Future Opportunities')}</span>
                </h3>

                {future.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {future.map((s, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 border-dashed">
                                <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-bold text-slate-700 text-xs sm:text-sm leading-tight">{tDynamic(s.name)}</h4>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                                    <span className="font-semibold text-rose-500 block sm:inline mb-0.5 sm:mb-0">{t('lbl_how_to_unlock', 'How to unlock:')} </span>
                                    {tDynamic(s.reason)}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
                        {t('msg_max_eligibility', 'Congratulations! You are maximizing your eligibility.')}
                    </p>
                )}
            </div>

            {/* Detailed Scheme Modal Overlay (Bottom-Sheet on Mobile) */}
            {selectedScheme && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">

                        {/* Mobile Drag Handle */}
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden shrink-0"></div>

                        {/* Modal Header */}
                        <div className="bg-white sm:bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-100 sm:border-slate-200 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-slate-800 text-base sm:text-lg flex items-center space-x-2">
                                <Landmark className="w-5 h-5 text-blue-600 shrink-0" />
                                <span>{t('modal_app_details', 'Application Details')}</span>
                            </h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-rose-500 transition cursor-pointer bg-slate-50 sm:bg-transparent p-1.5 sm:p-0 rounded-full">
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Modal Body (Scrollable) */}
                        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
                            <div>
                                <h4 className="text-lg sm:text-xl font-bold text-blue-900 mb-2 leading-tight">{tDynamic(selectedScheme.name)}</h4>
                                <span className="inline-flex items-center space-x-1.5 bg-blue-100 text-blue-700 text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-semibold">
                                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tDynamic(selectedScheme.provider)}</span>
                                </span>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <h5 className="text-[10px] sm:text-xs font-bold uppercase text-emerald-600 mb-1 tracking-wider">{t('lbl_approved_benefit', 'Your Approved Benefit')}</h5>
                                <p className="font-medium text-emerald-900 text-sm">{tDynamic(selectedScheme.benefit)}</p>
                            </div>

                            <div>
                                <h5 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center space-x-2 mb-3">
                                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                                    <span>{t('lbl_req_docs', 'Required Documents')}</span>
                                </h5>
                                <ul className="space-y-2.5">
                                    {selectedScheme.documents.map((doc, i) => (
                                        <li key={i} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-600 leading-snug">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
                                            <span>{tDynamic(doc)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Modal Footer / Call to Action */}
                        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 shrink-0">
                            <p className="text-[10px] sm:text-xs text-slate-500 mb-3 text-center">{t('msg_gov_portal', 'Applications are processed via the official government portal.')}</p>
                            <a
                                href={selectedScheme.portalLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 sm:py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-sm text-sm sm:text-base"
                            >
                                <span>{t('btn_visit', 'Visit')} {tDynamic(selectedScheme.portalName)}</span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}