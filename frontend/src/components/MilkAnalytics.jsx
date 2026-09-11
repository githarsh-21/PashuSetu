import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Award, Droplets, PieChart as PieIcon, Calendar } from 'lucide-react';
import API from '../services/api';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export default function MilkAnalytics({ username, herdData }) {
    const { t, i18n } = useTranslation();

    const [data, setData] = useState({
        trend: [],
        contributions: [],
        topPerformer: { tag: 'N/A', total: 0 }
    });

    const [kpis, setKpis] = useState({ totalYield: '0.0', avgDaily: '0.0' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!username) return;

        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const res = await API.get(`/milk/analytics/${username}?days=7`);

                if (res.data) {
                    const trend = res.data.trend || [];

                    // 1. Robust Contribution Parser (Handles Dicts, Lists of Lists, or Objects)
                    let rawContribs = res.data.contributions || res.data.individual_yields || res.data.breakdown || [];
                    let parsedContribs = [];

                    if (Array.isArray(rawContribs)) {
                        if (rawContribs.length > 0 && Array.isArray(rawContribs[0])) {
                            // Format: [['COW-100', 37.0]]
                            parsedContribs = rawContribs.map(item => ({ tag: item[0], total: Number(item[1]) || 0 }));
                        } else {
                            // Format: [{tag: 'COW-100', total: 37.0}]
                            parsedContribs = rawContribs;
                        }
                    } else if (typeof rawContribs === 'object' && rawContribs !== null) {
                        // Format: {'COW-100': 37.0}
                        parsedContribs = Object.entries(rawContribs).map(([tag, total]) => ({
                            tag: tag,
                            total: Number(total) || 0
                        }));
                    }

                    // Sort highest yield to lowest for accurate leaderboard & top performer
                    parsedContribs.sort((a, b) => b.total - a.total);

                    // 2. Auto-Calculate Top Performer if backend doesn't send it cleanly
                    let topPerf = res.data.top_performer;
                    if (!topPerf || !topPerf.tag || topPerf.tag === 'N/A') {
                        topPerf = parsedContribs.length > 0
                            ? parsedContribs[0]
                            : { tag: 'N/A', total: 0 };
                    }

                    setData({
                        trend: trend,
                        contributions: parsedContribs,
                        topPerformer: topPerf
                    });

                    // 3. Set KPIs safely
                    const total = res.data.weekly_total !== undefined
                        ? Number(res.data.weekly_total)
                        : trend.reduce((sum, d) => sum + (Number(d.yield) || 0), 0);

                    const avg = res.data.avg_daily !== undefined
                        ? Number(res.data.avg_daily)
                        : (trend.length > 0 ? total / trend.length : 0);

                    setKpis({
                        totalYield: total.toFixed(1),
                        avgDaily: avg.toFixed(1)
                    });
                }
            } catch (err) {
                console.error("Analytics Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [username, herdData, i18n.language]);

    // Localized Date Formatter for Axis & Tooltip
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(i18n.language || 'en-IN', {
            day: 'numeric',
            month: 'short'
        });
    };

    const totalContribSum = data.contributions.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

    if (loading && data.trend.length === 0) {
        return <div className="text-center py-16 text-slate-500 font-bold animate-pulse">{t('msg_syncing', 'Syncing telemetry data...')}</div>;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">{t('analytics_title', 'Herd Yield Analytics')}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{t('analytics_subtitle', 'Real-time daily production trends & performance telemetry')}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {t('badge_7day_snapshot', '7-Day Overview')}
                    </span>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center space-x-3">
                    <div className="p-3 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                        <Droplets className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpi_weekly_total', '7-Day Total Yield')}</p>
                        <p className="text-2xl font-black text-slate-900">{kpis.totalYield} <span className="text-xs font-semibold text-slate-500">{t('kpi_litres', 'Litres')}</span></p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center space-x-3">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpi_avg_daily', 'Daily Herd Average')}</p>
                        <p className="text-2xl font-black text-slate-900">{kpis.avgDaily} <span className="text-xs font-semibold text-slate-500">{t('kpi_l_day', 'L / day')}</span></p>
                    </div>
                </div>

                {/* Top Performer Card */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center space-x-3">
                    <div className="p-3 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                        <Award className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">{t('kpi_top_performer', 'Top Performer')}</p>
                        <p className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                            {data.topPerformer.tag}
                        </p>
                        <p className="text-xs font-bold text-amber-700 truncate">
                            {data.topPerformer.total} {t('kpi_litres', 'Litres')} ({totalContribSum > 0 ? Math.round((data.topPerformer.total / totalContribSum) * 100) : 0}% share)
                        </p>
                    </div>
                </div>
            </div>

            {/* Side-by-Side Dual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* 7-Day Production Area Chart */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                            {t('chart_title_milk', '7-Day Milk Yield Curve (Total Litres)')}
                        </h3>
                        <span className="text-xs font-medium text-slate-500">{t('lbl_unit_litres', 'Volume in Litres')}</span>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={8} tickFormatter={formatDate} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit="L" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff', border: 'none', fontSize: '12px' }}
                                    labelFormatter={formatDate}
                                    formatter={(val) => [`${val} ${t('kpi_litres', 'Litres')}`, t('chart_total_yield', 'Total Production')]}
                                />
                                <Area type="monotone" dataKey="yield" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#yieldGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Herd Contribution Donut + Cow Breakdown */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center">
                            <PieIcon className="w-4 h-4 mr-2 text-indigo-600" />
                            {t('chart_title_contribution', 'Herd Contribution (Active Cattle)')}
                        </h3>
                    </div>

                    {data.contributions.length > 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1">
                            <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.contributions}
                                            dataKey="total"
                                            nameKey="tag"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            stroke="none"
                                        >
                                            {data.contributions.map((entry, idx) => (
                                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff', border: 'none', fontSize: '12px' }}
                                            formatter={(value, name) => [`${value} L`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Clean Leaderboard List */}
                            <div className="w-full mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {data.contributions.map((c, idx) => {
                                    const pct = totalContribSum > 0 ? ((c.total / totalContribSum) * 100).toFixed(0) : 0;
                                    return (
                                        <div key={c.tag} className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-xs">
                                            <div className="flex items-center space-x-2 truncate">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                                <span className="font-semibold text-slate-800 truncate">
                                                    {c.tag}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2 shrink-0">
                                                <span className="font-bold text-slate-900">{c.total} L</span>
                                                <span className="text-[10px] text-slate-400 font-medium">({pct}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-medium">
                            {t('msg_no_data', 'No yield records available')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}