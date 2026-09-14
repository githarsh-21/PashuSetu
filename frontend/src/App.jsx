import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import API from './services/api';
import Navbar from './components/Navbar';
import CattleCard from './components/CattleCard';
import Cattle360Modal from './components/Cattle360Modal';
import AIDiagnosisScanner from './components/AIDiagnosisScanner';
import GovernmentSchemes from './components/GovernmentSchemes';
import MilkAnalytics from './components/MilkAnalytics';
import SplashScreen from './components/SplashScreen';
import UserProfileModal from './components/UserProfileModal';
import VetDashboard from './components/VetDashboard';
import AdminDashboard from './components/AdminDashboard';
import { PlusCircle, List, Sparkles, Landmark, TrendingUp, AlertTriangle, Download } from 'lucide-react';

export default function App() {
  const { t } = useTranslation();

  const [showSplash, setShowSplash] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pashusetu_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error('Failed to parse cached user:', e);
      }
    }
    return null;
  });

  const [herd, setHerd] = useState(() => {
    const cachedHerd = localStorage.getItem('pashusetu_herd_cache');
    return cachedHerd ? JSON.parse(cachedHerd) : [];
  });

  const [vaccineAlerts, setVaccineAlerts] = useState(() => {
    const cachedAlerts = localStorage.getItem('pashusetu_alerts_cache');
    return cachedAlerts ? JSON.parse(cachedAlerts) : [];
  });

  const [selectedTag, setSelectedTag] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');

  const [regData, setRegData] = useState({
    fullName: '',
    phone: '',
    address: '',
    pincode: '',
    role: 'Farmer',
    gender: 'Male',
    category: 'General',
    licenseNo: '',
    certificateImg: null
  });

  const [vaccineLogTag, setVaccineLogTag] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newBreed, setNewBreed] = useState('Gir');
  const [newGender, setNewGender] = useState('Female');
  const [ageYears, setAgeYears] = useState(3);
  const [ageMonths, setAgeMonths] = useState(0);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA installation outcome: ${outcome}`);
      setDeferredPrompt(null);
    }
  };

  const fetchHerd = async (uName) => {
    try {
      const res = await API.get(`/cattle/${uName}`);
      const herdData = res.data.herd || [];
      setHerd(herdData);
      localStorage.setItem('pashusetu_herd_cache', JSON.stringify(herdData));

      const alertRes = await API.get(`/vaccinations/all/${uName}`);
      const alertData = alertRes.data.vaccinations || [];
      setVaccineAlerts(alertData);
      localStorage.setItem('pashusetu_alerts_cache', JSON.stringify(alertData));
    } catch (err) {
      console.warn('Network offline or error fetching herd, loading cached records:', err);
    }
  };

  useEffect(() => {
    if (user && user.role?.toLowerCase() === 'farmer') {
      fetchHerd(user.username);
    }
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await API.post('/auth/login', { username, password });
      const loggedUser = res.data.user;
      setUser(loggedUser);
      localStorage.setItem('pashusetu_user', JSON.stringify(loggedUser));
    } catch (err) {
      // 👇 CHANGED: Now using i18next translation key!
      setAuthError(t('err_invalid_login', 'Invalid username or password.'));
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pashusetu_user');
    localStorage.removeItem('pashusetu_herd_cache');
    localStorage.removeItem('pashusetu_alerts_cache');
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    setAuthError('');
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setExpectedOtp(mockOtp);
    setShowOtpScreen(true);
    alert(`${t('msg_mock_sms', '📲 MOCK SMS: Your PashuSetu verification code is')} ${mockOtp}`);
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (otpInput !== expectedOtp) {
      setAuthError('Invalid OTP. Please try again.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('full_name', regData.fullName);
      formData.append('phone', regData.phone);
      formData.append('address', regData.address);
      formData.append('pincode', regData.pincode);
      formData.append('role', regData.role);
      formData.append('gender', regData.gender);
      formData.append('category', regData.category);

      if (regData.role === 'Veterinarian') {
        formData.append('license_no', regData.licenseNo);
        if (regData.certificateImg) {
          formData.append('certificate_img', regData.certificateImg);
        }
      }

      await API.post('/auth/register', formData);

      setIsRegistering(false);
      setShowOtpScreen(false);
      setOtpInput('');
      setAuthError('Registration successful! Please log in.');
      setRegData({ fullName: '', phone: '', address: '', pincode: '', role: 'Farmer', gender: 'Male', category: 'General', licenseNo: '', certificateImg: null });
      setPassword('');
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Registration failed');
    }
  };

  const handleRegisterCattle = async (e) => {
    e.preventDefault();

    const payload = {
      username: user.username,
      tag: newTag.trim().toUpperCase(),
      breed: newBreed,
      gender: newGender,
      age_years: parseInt(ageYears, 10) || 0,
      age_months: parseInt(ageMonths, 10) || 0,
      status: 'Active'
    };

    try {
      const res = await API.post('/cattle/register', payload);
      alert(res.data?.message || 'Cattle registered successfully.');
      setShowAddModal(false);
      setNewTag('');
      setAgeYears(3);
      setAgeMonths(0);
      fetchHerd(user.username);
    } catch (err) {
      if (err.response && err.response.status === 422) {
        const errorDetails = err.response.data.detail
          .map(errorItem => `${errorItem.loc[errorItem.loc.length - 1]}: ${errorItem.msg}`)
          .join('\n');
        alert(`Validation Failed:\n${errorDetails}`);
      } else {
        alert(err.response?.data?.detail || 'Failed to register cattle.');
      }
    }
  };

  const handleLogVaccine = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    try {
      await API.post('/vaccination/log', {
        username: user.username,
        cattle_tag: vaccineLogTag,
        vaccine_name: data.get('vaccineName'),
        admin_date: data.get('adminDate')
      });
      setVaccineLogTag(null);
      alert('Vaccine logged successfully!');
      fetchHerd(user.username);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to log vaccine.');
    }
  };

  const today = new Date();
  const pendingActions = vaccineAlerts.filter(v => {
    if (!v.next_due) return false;
    const dueDate = new Date(v.next_due);
    const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  });

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-6">
            <span className="text-4xl sm:text-5xl">🐄</span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">{t('login_title', 'PashuSetu Portal')}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isRegistering ? t('auth_create', 'Create your PashuSetu profile account') : t('auth_signin', 'Sign in to your PashuSetu dashboard')}
            </p>
          </div>

          {authError && (
            <div className={`mb-4 p-3 border text-xs sm:text-sm rounded-lg ${authError.includes('successful')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
              {authError}
            </div>
          )}

          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-600 mb-1">{t('auth_username', 'Username / Phone')}</label>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('auth_username', 'Enter username or phone')} className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm appearance-none" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-600 mb-1">{t('auth_password', 'Password')}</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm appearance-none" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-2.5 rounded-xl transition shadow-md cursor-pointer mt-2">
                {t('btn_signin', 'Sign In')}
              </button>
              <p className="text-center text-xs sm:text-sm text-slate-500 mt-4">
                {t('auth_no_account', "Don't have an account?")}{' '}
                <button type="button" onClick={() => { setIsRegistering(true); setAuthError(''); }} className="text-emerald-600 font-bold hover:underline cursor-pointer">
                  {t('auth_register_link', 'Register here')}
                </button>
              </p>
            </form>
          ) : (
            <div className="animate-in fade-in duration-300">
              {showOtpScreen ? (
                <form onSubmit={handleVerifyAndRegister} className="space-y-4 text-center py-4">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">📱</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{t('title_verify_phone', 'Verify your phone')}</h3>
                  <p className="text-sm text-slate-500 mb-6">{t('msg_mock_code', 'We sent a mock code to')} {regData.phone}</p>
                  <div>
                    <input type="text" maxLength="4" required value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} placeholder={t('ph_enter_otp', 'Enter 4-digit OTP')} className="w-full text-center tracking-widest text-2xl px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button type="button" onClick={() => setShowOtpScreen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm cursor-pointer transition">{t('btn_back', 'Back')}</button>
                    <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md transition">{t('btn_verify_register', 'Verify & Register')}</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSendOtp} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_full_name', 'Full Name')}</label>
                      <input type="text" required value={regData.fullName} onChange={(e) => setRegData({ ...regData, fullName: e.target.value })} placeholder={t('ph_full_name', 'e.g. Ramesh Kumar')} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_select_role', 'Select Role')}</label>
                      <select value={regData.role} onChange={(e) => setRegData({ ...regData, role: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none">
                        <option value="Farmer">{t('role_farmer_ext', 'Farmer (Pashu Palak)')}</option>
                        <option value="Veterinarian">{t('role_vet_ext', 'Veterinarian (Doctor)')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_phone_number', 'Phone Number')}</label>
                      <input type="tel" maxLength="10" pattern="^[6-9]\d{9}$" required value={regData.phone} onChange={(e) => setRegData({ ...regData, phone: e.target.value })} placeholder={t('ph_10_digit', '10-digit no.')} title="Enter a valid 10-digit Indian phone number" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                    </div>
                    <div className="grid grid-cols-2 sm:col-span-2 gap-3">
                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_gender', 'Gender')}</label>
                        <select value={regData.gender} onChange={(e) => setRegData({ ...regData, gender: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white appearance-none">
                          <option value="Male">{t('gender_male', 'Male')}</option>
                          <option value="Female">{t('gender_female', 'Female')}</option>
                          <option value="Other">{t('gender_other', 'Other')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_category', 'Category')}</label>
                        <select value={regData.category} onChange={(e) => setRegData({ ...regData, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white appearance-none">
                          <option value="General">{t('category_general', 'General')}</option>
                          <option value="OBC">{t('category_obc', 'OBC')}</option>
                          <option value="SC">{t('category_sc', 'SC')}</option>
                          <option value="ST">{t('category_st', 'ST')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_user_email', 'Username / Email (For Login)')}</label>
                    <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('ph_user_email', 'e.g. user@gmail.com or user123')} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_full_address', 'Full Address (Village, District, State)')}</label>
                      <input type="text" required value={regData.address} onChange={(e) => setRegData({ ...regData, address: e.target.value })} placeholder={t('ph_address', 'e.g. Gram Panchayat Road...')} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_pincode', 'Pincode')}</label>
                      <input type="tel" maxLength="6" pattern="^\d{6}$" required value={regData.pincode} onChange={(e) => setRegData({ ...regData, pincode: e.target.value.replace(/\D/g, '') })} placeholder={t('ph_pincode', '6-digit pin')} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                    </div>
                  </div>

                  {regData.role === 'Veterinarian' && (
                    <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 mt-2">
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wide">{t('lbl_vet_credentials', '🩺 Vet Credentials & AI KYC')}</span>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_license_no', 'License / Registration Number')}</label>
                        <input type="text" required value={regData.licenseNo} onChange={(e) => setRegData({ ...regData, licenseNo: e.target.value })} placeholder={t('ph_license_no', 'VET-REG-XXXX')} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white appearance-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_upload_cert', 'Upload Certificate (For Verification)')}</label>
                        <input type="file" accept="image/*" onChange={(e) => setRegData({ ...regData, certificateImg: e.target.files[0] })} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] sm:file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer" />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">{t('lbl_create_password', 'Create Password')}</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-2.5 mt-2 rounded-xl transition shadow-md cursor-pointer">
                    {t('btn_send_otp', 'Send OTP to Verify')}
                  </button>
                  <p className="text-center text-xs sm:text-sm text-slate-500 mt-2">
                    {t('msg_already_account', 'Already have an account?')} {' '}
                    <button type="button" onClick={() => { setIsRegistering(false); setAuthError(''); }} className="text-emerald-600 font-bold hover:underline cursor-pointer">
                      {t('btn_log_in', 'Log in')}
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} onOpenProfile={() => setShowProfileModal(true)} />

      {deferredPrompt && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm shadow-md">
          <div className="flex items-center space-x-2">
            <span>📱</span>
            <span className="font-semibold">Install PashuSetu App for full offline diagnosis access</span>
          </div>
          <button
            onClick={handleInstallApp}
            className="flex items-center space-x-1 bg-white text-emerald-800 px-3 py-1 rounded-lg font-bold hover:bg-emerald-50 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-1">
        {user.role?.toLowerCase() === 'admin' ? (
          <AdminDashboard user={user} />
        ) : user.role?.toLowerCase() === 'veterinarian' ? (
          <VetDashboard user={user} />
        ) : (
          <>
            <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center space-x-2 px-4 sm:px-5 py-2.5 font-bold rounded-xl transition cursor-pointer whitespace-nowrap text-sm sm:text-base ${activeTab === 'inventory' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <List className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>{t('tab_inventory', 'Herd Inventory')}</span>
              </button>
              <button
                onClick={() => setActiveTab('ai-triage')}
                className={`flex items-center space-x-2 px-4 sm:px-5 py-2.5 font-bold rounded-xl transition cursor-pointer whitespace-nowrap text-sm sm:text-base ${activeTab === 'ai-triage' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>{t('tab_ai', 'AI Diagnosis Triage')}</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center space-x-2 px-4 sm:px-5 py-2.5 font-bold rounded-xl transition cursor-pointer whitespace-nowrap text-sm sm:text-base ${activeTab === 'analytics' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>{t('tab_analytics', 'Yield Analytics')}</span>
              </button>
              <button
                onClick={() => setActiveTab('schemes')}
                className={`flex items-center space-x-2 px-4 sm:px-5 py-2.5 font-bold rounded-xl transition cursor-pointer whitespace-nowrap text-sm sm:text-base ${activeTab === 'schemes' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Landmark className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>{t('tab_schemes', 'Govt. Schemes')}</span>
              </button>
            </div>

            {activeTab === 'inventory' && (
              <div className="animate-in fade-in duration-300">
                {pendingActions.length > 0 && (
                  <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm sm:text-base leading-tight">
                        {t('alert_vaccine_title', 'Action Required: Upcoming Vaccinations')}
                      </h4>
                      <p className="text-xs sm:text-sm text-amber-700 mt-1 leading-snug">
                        {t('alert_vaccine_desc', `You have ${pendingActions.length} vaccination task(s) due soon or overdue. Please check the highlighted buttons on your cattle cards below.`)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4 sm:gap-0">
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{t('dashboard_title', 'Herd Inventory')}</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{t('dashboard_subtitle', 'Manage and monitor all cattle registered to your farm.')}</p>
                  </div>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm sm:text-base w-full sm:w-auto shrink-0"
                  >
                    <PlusCircle className="w-5 h-5 shrink-0" />
                    <span className="truncate">{t('btn_register_new_cow', 'Register New Cow')}</span>
                  </button>
                </div>

                {herd.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm mx-4 sm:mx-0 min-w-0">
                    <span className="text-5xl sm:text-6xl shrink-0">🏷️</span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 mt-4 truncate">{t('empty_herd_title', 'No cattle in herd')}</h3>
                    <p className="text-sm text-slate-500 mb-6 mt-1 truncate">{t('empty_herd_desc', 'Register your first cow to activate health tracking and analytics.')}</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md hover:bg-emerald-700 transition truncate"
                    >
                      {t('btn_add_first_cattle', 'Add First Cattle')}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {herd
                      .filter((c) => c.status === 'Active')
                      .map((c) => (
                        <CattleCard
                          key={c.tag}
                          cattle={c}
                          username={user.username}
                          alerts={vaccineAlerts.filter(v => v.tag === c.tag)}
                          onOpenProfile={(tag) => setSelectedTag(tag)}
                          onLogVaccine={(tag) => setVaccineLogTag(tag)}
                          onRefresh={() => fetchHerd(user.username)}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai-triage' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AIDiagnosisScanner username={user.username} herd={herd} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <MilkAnalytics username={user.username} herdData={herd} />
              </div>
            )}

            {activeTab === 'schemes' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <GovernmentSchemes username={user.username} />
              </div>
            )}
          </>
        )}
      </main>

      {showProfileModal && (
        <UserProfileModal user={user} onClose={() => setShowProfileModal(false)} />
      )}

      {selectedTag && (
        <Cattle360Modal
          username={user.username}
          tag={selectedTag}
          onClose={() => setSelectedTag(null)}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden shrink-0"></div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4 sm:mb-5 truncate">{t('title_register_cattle', 'Register Cattle')}</h2>
            <form onSubmit={handleRegisterCattle} className="space-y-4">
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_cattle_tag', 'Cattle Tag / Ear ID')}</label>
                <input type="text" required value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={t('ph_cattle_tag', 'e.g. COW-092')} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_breed', 'Breed')}</label>
                <select value={newBreed} onChange={(e) => setNewBreed(e.target.value)} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none bg-white">
                  <option value="Gir">{t('breed_gir', 'Gir')}</option>
                  <option value="Sahiwal">{t('breed_sahiwal', 'Sahiwal')}</option>
                  <option value="Murrah (Buffalo)">{t('breed_murrah', 'Murrah (Buffalo)')}</option>
                  <option value="Holstein Friesian (HF)">{t('breed_hf', 'Holstein Friesian (HF)')}</option>
                  <option value="Jersey">{t('breed_jersey', 'Jersey')}</option>
                  <option value="Crossbreed (Generic)">{t('breed_crossbreed', 'Crossbreed (Generic)')}</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_gender', 'Gender')}</label>
                <select value={newGender} onChange={(e) => setNewGender(e.target.value)} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none">
                  <option value="Female">{t('opt_female_cow', 'Female (Cow / Heifer)')}</option>
                  <option value="Male">{t('opt_male_bull', 'Male (Bull / Steer)')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_age_years', 'Age (Years)')}</label>
                  <input type="number" min="0" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_age_months', 'Age (Months)')}</label>
                  <input type="number" min="0" max="11" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 sm:pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 sm:py-3 rounded-xl font-bold text-sm cursor-pointer transition truncate px-2">
                  {t('btn_cancel', 'Cancel')}
                </button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 sm:py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md transition truncate px-2">
                  {t('btn_save_cattle', 'Save Cattle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {vaccineLogTag && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden shrink-0"></div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4 sm:mb-5 leading-tight truncate">
              {t('title_log_vaccine_for', 'Log Vaccine for')} {vaccineLogTag}
            </h2>
            <form onSubmit={handleLogVaccine} className="space-y-4">
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_vaccine_name', 'Vaccine Name')}</label>
                <select name="vaccineName" className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500">
                  <option value="FMD (Foot & Mouth)">{t('vac_fmd', 'FMD (Foot & Mouth)')}</option>
                  <option value="HS (Hemorrhagic Septicemia)">{t('vac_hs', 'HS (Hemorrhagic Septicemia)')}</option>
                  <option value="Brucellosis">{t('vac_brucellosis', 'Brucellosis')}</option>
                  <option value="Lumpy Skin Disease (LSD)">{t('vac_lsd', 'Lumpy Skin Disease (LSD)')}</option>
                  <option value="Rabies">{t('vac_rabies', 'Rabies')}</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 truncate">{t('lbl_admin_date', 'Administration Date')}</label>
                <input type="date" name="adminDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
              <div className="flex space-x-3 pt-4 sm:pt-2">
                <button type="button" onClick={() => setVaccineLogTag(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 sm:py-3 rounded-xl font-bold text-sm cursor-pointer transition truncate px-2">
                  {t('btn_cancel', 'Cancel')}
                </button>
                <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3.5 sm:py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md transition truncate px-2">
                  {t('btn_save_vaccine', 'Save Vaccine')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}