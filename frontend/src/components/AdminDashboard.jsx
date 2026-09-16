import React, { useState, useEffect } from 'react';
import API from '../services/api';
import {
    Users, Activity, ShieldCheck, Download,
    Search, Filter, Eye, Ban, CheckCircle,
    ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminDashboard({ user }) {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState('radar');
    const [outbreakData, setOutbreakData] = useState({ active_clusters: [] });
    const [users, setUsers] = useState([]);
    const [kpiStats, setKpiStats] = useState({ farmers: 0, vets: 0, cattle: 0, diagnoses: 0 });

    // --- NEW: Search, Filter, & Pagination State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // --- NEW: Modal State ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userSummary, setUserSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    // Reset pagination when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter]);

    const fetchData = async () => {
        try {
            const [outbreakRes, usersRes, statsRes] = await Promise.all([
                API.get('/admin/outbreak-radar'),
                API.get('/admin/users'),
                API.get('/admin/stats/admin')
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

    // --- NEW: Filter and Paginate Logic ---
    const filteredUsers = users.filter(u => {
        const matchesSearch =
            (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (u.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (u.phone || '').includes(searchTerm);

        const matchesRole = roleFilter === 'All' ||
            (roleFilter === 'Farmers' && u.role?.toLowerCase().includes('farmer')) ||
            (roleFilter === 'Vets' && u.role?.toLowerCase() === 'veterinarian') ||
            (roleFilter === 'Admins' && u.role?.toLowerCase() === 'admin');

        return matchesSearch && matchesRole;
    });

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage) || 1;
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // --- NEW: Action Functions ---
    const toggleUserStatus = async (username) => {
        try {
            const res = await API.put(`/admin/users/${username}/toggle-status`);
            if (res.data.status === 'success') {
                // Update the local state to reflect the change instantly
                setUsers(users.map(u =>
                    u.username === username ? { ...u, is_active: res.data.is_active } : u
                ));
            }
        } catch (error) {
            console.error("Failed to toggle status:", error);
            alert(t('error_status_update', 'Failed to update user status.'));
        }
    };

    const viewUserProfile = async (u) => {
        setSelectedUser(u);
        setIsModalOpen(true);
        setLoadingSummary(true);
        setUserSummary(null);

        try {
            const res = await API.get(`/admin/users/${u.username}/summary?role=${u.role}`);
            if (res.data.status === 'success') {
                setUserSummary(res.data.summary);
            }
        } catch (error) {
            console.error("Failed to fetch user summary:", error);
        } finally {
            setLoadingSummary(false);
        }
    };

    // CSV Export (Updated to use filteredUsers so you can export specific lists)
    const exportToCSV = () => {
        const headers = ["Full Name", "Role", "Contact", "Location (PIN)", "License (VETS)", "Status"];
        const csvRows = [headers.join(",")];
        filteredUsers.forEach(u => {
            const row = [
                `"${u.full_name || u.username}"`,
                `"${u.role}"`,
                `"${u.phone || 'N/A'}"`,
                `"${u.pincode || 'N/A'}"`,
                `"${u.license_no || '-'}"`,
                `"${u.is_active ? 'Active' : 'Suspended'}"`
            ];
            csvRows.push(row.join(","));
        });
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `PashuSetu_Users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 relative">
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

            {/* KPI Stat Cards */}
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

            {/* Tabs Container */}
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
                <div className="animate-in fade-in duration-300 space-y-4">
                    {/* Controls Bar: Search, Filters, and Export */}
                    <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t('placeholder_search_users', 'Search name or phone...')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer">
                                    <option value="All">{t('filter_all', 'All Roles')}</option>
                                    <option value="Farmers">{t('role_farmer', 'Farmers')}</option>
                                    <option value="Vets">{t('role_veterinarian', 'Veterinarians')}</option>
                                    <option value="Admins">{t('role_admin', 'Admins')}</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-lg shadow-sm text-sm transition-all w-full md:w-auto">
                            <Download className="w-4 h-4" />
                            {t('btn_export_csv', 'Export CSV')}
                        </button>
                    </div>

                    {/* The Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">{t('lbl_full_name', 'Full Name')}</th>
                                        <th className="px-4 py-3">{t('lbl_role', 'Role')}</th>
                                        <th className="px-4 py-3">{t('lbl_contact', 'Contact')}</th>
                                        <th className="px-4 py-3">{t('lbl_status', 'Status')}</th>
                                        <th className="px-4 py-3 text-right">{t('lbl_actions', 'Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedUsers.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-8 text-slate-500">{t('no_users_found', 'No users found.')}</td></tr>
                                    ) : paginatedUsers.map(u => (
                                        <tr key={u.id} className={`transition ${!u.is_active ? 'bg-rose-50/30 opacity-75' : 'hover:bg-slate-50'}`}>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{u.full_name} <br /><span className="text-xs text-slate-400 font-normal">@{u.username}</span></td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'veterinarian' ? 'bg-blue-100 text-blue-800' : u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                                            <td className="px-4 py-3">
                                                {u.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded uppercase">
                                                        <CheckCircle className="w-3 h-3" /> {t('status_active', 'Active')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded uppercase">
                                                        <Ban className="w-3 h-3" /> {t('status_suspended', 'Suspended')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button onClick={() => viewUserProfile(u)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition" title={t('btn_view_profile', 'View Profile')}>
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {u.role !== 'admin' && (
                                                    <button onClick={() => toggleUserStatus(u.username)} className={`p-1.5 rounded transition ${u.is_active ? 'text-rose-600 hover:bg-rose-100' : 'text-emerald-600 hover:bg-emerald-100'}`} title={u.is_active ? t('btn_suspend', 'Suspend') : t('btn_restore', 'Restore')}>
                                                        {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                                <span className="text-sm text-slate-500">
                                    {t('lbl_page', 'Page')} <span className="font-bold text-slate-800">{currentPage}</span> {t('lbl_of', 'of')} <span className="font-bold text-slate-800">{totalPages}</span>
                                </span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- NEW: User Profile Modal --- */}
            {isModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-emerald-600" />
                                {t('modal_user_profile', 'User Profile')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-3">
                                    {selectedUser.full_name.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">{selectedUser.full_name}</h2>
                                <p className="text-sm text-slate-500">@{selectedUser.username}</p>
                                <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                    {selectedUser.role}
                                </span>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[100px] flex flex-col justify-center">
                                {loadingSummary ? (
                                    <div className="flex justify-center items-center gap-2 text-slate-500 font-medium">
                                        <Activity className="w-4 h-4 animate-spin" />
                                        {t('lbl_loading', 'Loading Activity Data...')}
                                    </div>
                                ) : userSummary ? (
                                    <>
                                        <div className="text-center mb-4">
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">{t('lbl_total_activity', 'Total Activity Index')}</p>
                                            <p className="text-3xl font-black text-emerald-600">{userSummary.total_activity}</p>
                                        </div>
                                        <div className="space-y-2 border-t border-slate-200 pt-3">
                                            {Object.entries(userSummary.details).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600 font-medium">{key}:</span>
                                                    <span className="text-slate-900 font-bold">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-slate-500">{t('error_no_summary', 'No summary data available.')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}