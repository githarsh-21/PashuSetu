import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Users, Activity, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // 👈 1. IMPORT TRANSLATION HOOK

export default function AdminDashboard({ user }) {
    const { t } = useTranslation(); // 👈 2. INITIALIZE TRANSLATION FUNCTION

    const [activeTab, setActiveTab] = useState('radar');
    const [outbreakData, setOutbreakData] = useState({ active_clusters: [] });
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [outbreakRes, usersRes] = await Promise.all([
                API.get('/admin/outbreak-radar'),
                API.get('/admin/users'),
            ]);
            setOutbreakData(outbreakRes.data);
            setUsers(usersRes.data.users);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        {t('admin_title', 'Admin Command Center')} {/* 👈 TRANSLATED */}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {t('admin_subtitle', 'Manage Users and Monitor Outbreaks.')}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                <button onClick={() => setActiveTab('radar')} className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition ${activeTab === 'radar' ? 'bg-rose-100 text-rose-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <Activity className="w-4 h-4" />
                    {t('tab_outbreak_radar', 'Outbreak Radar')}
                </button>
                <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition ${activeTab === 'users' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <Users className="w-4 h-4" />
                    {t('tab_user_directory', 'User Directory')}
                </button>
            </div>

            {/* TAB 1: Outbreak Radar */}
            {activeTab === 'radar' && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {outbreakData.active_clusters.length === 0 ? (
                        <div className="col-span-2 p-8 bg-white border rounded-xl text-center text-slate-500 font-bold">
                            🟢 {t('no_active_clusters', 'No active disease clusters detected in the last 30 days.')}
                        </div>
                    ) : (
                        outbreakData.active_clusters.map((cluster, idx) => (
                            <div key={idx} className={`p-5 rounded-xl border shadow-sm ${cluster.severity === 'critical' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider ${cluster.severity === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                                        {cluster.severity === 'critical' ? '🔴 Critical Zone' : '🟡 Emerging Alert'}
                                    </span>
                                    <span className="text-sm font-black text-slate-900">{cluster.case_count} Cases</span>
                                </div>
                                <h4 className="font-bold text-slate-900 text-lg leading-tight">{cluster.disease}</h4>
                                <p className="text-xs text-slate-600 font-medium mt-1">📍 {cluster.location}</p>
                                <div className="mt-4 pt-3 border-t border-black/5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Protocol:</p>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{cluster.recommended_action}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}


            {/* TAB 2: User Directory */}
            {activeTab === 'users' && (
                <div className="animate-in fade-in duration-300 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">{t('lbl_full_name', 'Full Name')}</th>
                                    <th className="px-4 py-3">{t('lbl_role', 'Role')}</th>
                                    <th className="px-4 py-3">{t('lbl_contact', 'Contact')}</th>
                                    <th className="px-4 py-3">{t('lbl_location_pin', 'Location (PIN)')}</th>
                                    <th className="px-4 py-3">{t('lbl_license_vets', 'License (Vets)')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{u.full_name} <br /><span className="text-xs text-slate-400 font-normal">@{u.username}</span></td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'veterinarian' ? 'bg-blue-100 text-blue-800' : u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                                        <td className="px-4 py-3 text-slate-600">{u.pincode || 'N/A'}</td>
                                        <td className="px-4 py-3 text-slate-600">{u.license_no || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}