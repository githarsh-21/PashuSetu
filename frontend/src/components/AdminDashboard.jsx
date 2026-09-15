import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Users, Activity, ShieldCheck, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminDashboard({ user }) {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState('radar');
    const [outbreakData, setOutbreakData] = useState({ active_clusters: [] });
    const [users, setUsers] = useState([]);

    // 1. ADDED: State to hold our top KPI numbers
    const [kpiStats, setKpiStats] = useState({ farmers: 0, vets: 0, cattle: 0, diagnoses: 0 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 2. ADDED: Fetch stats concurrently with the other data
            const [outbreakRes, usersRes, statsRes] = await Promise.all([
                API.get('/admin/outbreak-radar'),
                API.get('/admin/users'),
                API.get('/admin/stats/admin') // Assuming "admin" is the username, adjust if needed
            ]);

            setOutbreakData(outbreakRes.data);
            setUsers(usersRes.data.users);

            if (statsRes.data && statsRes.data.status === "success") {
                setKpiStats(statsRes.data.stats);
            }
        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
    };

    // 3. ADDED: CSV Export Logic
    const exportToCSV = () => {
        const headers = ["Full Name", "Role", "Contact", "Location (PIN)", "License (VETS)"];
        const csvRows = [headers.join(",")];

        users.forEach(user => {
            const row = [
                `"${user.full_name || user.username}"`,
                `"${user.role}"`,
                `"${user.phone || 'N/A'}"`,
                `"${user.pincode || 'N/A'}"`,
                `"${user.license_no || '-'}"`
            ];
            csvRows.push(row.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "PashuSetu_User_Directory.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        {t('admin_title', 'Admin Command Center')}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {t('admin_subtitle', 'Manage Users and Monitor Outbreaks.')}
                    </p>
                </div>
            </div>

            {/* 4. ADDED: KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('kpi_farmers', 'Total Farmers')}</span>
                    <span className="text-3xl font-black text-slate-800 mt-1">{kpiStats.farmers}</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('kpi_vets', 'Registered Vets')}</span>
                    <span className="text-3xl font-black text-emerald-600 mt-1">{kpiStats.vets}</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('kpi_cattle', 'Tagged Cattle')}</span>
                    <span className="text-3xl font-black text-blue-600 mt-1">{kpiStats.cattle}</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('kpi_diagnoses', 'AI Diagnoses')}</span>
                    <span className="text-3xl font-black text-rose-600 mt-1">{kpiStats.diagnoses}</span>
                </div>
            </div>

            {/* Tabs & Export Button Container */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 overflow-x-auto">
                <div className="flex space-x-2">
                    <button onClick={() => setActiveTab('radar')} className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition ${activeTab === 'radar' ? 'bg-rose-100 text-rose-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <Activity className="w-4 h-4" />
                        {t('tab_outbreak_radar', 'Outbreak Radar')}
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition ${activeTab === 'users' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <Users className="w-4 h-4" />
                        {t('tab_user_directory', 'User Directory')}
                    </button>
                </div>

                {/* 5. ADDED: CSV Export Button (Only visible on Users tab) */}
                {activeTab === 'users' && (
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-lg shadow-sm text-sm transition-all">
                        <Download className="w-4 h-4" />
                        {t('btn_export_csv', 'Export CSV')}
                    </button>
                )}
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