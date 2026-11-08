import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Activity,
  Layers,
  Users,
  Megaphone,
  Trash2,
  LogOut,
  ArrowLeft,
  Search,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Send,
  Eye,
  Sliders,
  Power,
  Lock,
  Unlock,
  Clock,
  Sparkles,
  Ban,
  UserCheck,
  X,
  AlertCircle,
  Filter,
  UserX,
  Zap,
} from 'lucide-react';
import { Listing } from '../types/listing';
import { User } from '../types/auth';

export interface SystemSettings {
  allowNewListings: boolean;
  marketplaceMaintenance: boolean;
  allowImageUploads: boolean;
  listingCooldownSeconds: number;
  preventDuplicateTitles: boolean;
  globalAnnouncement: string;
}

interface AdminStats {
  totalUsers: number;
  totalListings: number;
  mm2Count: number;
  adoptMeCount: number;
  bannedCount: number;
  totalCaptchaPassed: number;
  totalCaptchaFailed: number;
  uptimeSeconds: number;
  memoryUsageMb: number;
  allowNewListings?: boolean;
  marketplaceMaintenance?: boolean;
  allowImageUploads?: boolean;
}

interface AdminUserRow {
  id: string;
  username: string;
  discordTag: string;
  role: 'ADMIN' | 'USER';
  isAdmin: boolean;
  isBanned: boolean;
  banReason?: string;
  createdAt: string;
  listingsCount: number;
}

interface SecurityLog {
  id: string;
  timestamp: string;
  action: 'CHALLENGE_CREATED' | 'CHALLENGE_PASSED' | 'CHALLENGE_FAILED';
  ip: string;
  details?: string;
}

interface AdminPanelProps {
  currentUser: User;
  token: string;
  onBackToMarketplace: () => void;
  onLogout: () => void;
  onSelectListingDetail?: (listing: Listing) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  token,
  onBackToMarketplace,
  onLogout,
  onSelectListingDetail,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'users' | 'controls' | 'security' | 'webhook'>('overview');

  // Fallback token reader: ensure token is never lost across tab navigation or state batches
  const getAuthToken = useCallback(() => {
    if (token && token.trim()) return token.trim();
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alsat_auth_token') || '';
    }
    return '';
  }, [token]);

  // Overview data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);

  // Users data
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState<'ALL' | 'ACTIVE' | 'BANNED'>('ALL');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Listings data
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsSearch, setListingsSearch] = useState('');
  const [selectedGameFilter, setSelectedGameFilter] = useState<'ALL' | 'MM2' | 'Adopt Me!'>('ALL');
  const [isLoadingListings, setIsLoadingListings] = useState(false);

  // Quick Ban Desk State
  const [quickBanUsername, setQuickBanUsername] = useState('');
  const [quickBanReason, setQuickBanReason] = useState('Dolandırıcılık / Scam');
  const [isQuickBanning, setIsQuickBanning] = useState(false);

  // System Settings state
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    allowNewListings: true,
    marketplaceMaintenance: false,
    allowImageUploads: true,
    listingCooldownSeconds: 60,
    preventDuplicateTitles: true,
    globalAnnouncement: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Webhook Test
  const [testWebhookMsg, setTestWebhookMsg] = useState('');
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; text: string } | null>(null);

  // Global alert
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null);
  const [userToBanModal, setUserToBanModal] = useState<{ user: AdminUserRow; action: 'ban' | 'unban' } | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('Spam ilan verme');
  const [userToDeleteModal, setUserToDeleteModal] = useState<AdminUserRow | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Fetch Overview & Settings
  const fetchOverview = useCallback(async () => {
    const currentToken = getAuthToken();
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setSecurityLogs(data.securityLogs || []);
        if (data.systemSettings) {
          setSystemSettings((prev) => ({ ...prev, ...data.systemSettings }));
        }
        // Immediate hydration if local list is empty
        if (Array.isArray(data.recentUsers) && data.recentUsers.length > 0) {
          setUsers((prev) => (prev.length === 0 ? data.recentUsers : prev));
        }
        if (Array.isArray(data.recentListings) && data.recentListings.length > 0) {
          setListings((prev) => (prev.length === 0 ? data.recentListings : prev));
        }
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    }
  }, [getAuthToken]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    const currentToken = getAuthToken();
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [getAuthToken]);

  // Fetch Listings
  const fetchListings = useCallback(async () => {
    setIsLoadingListings(true);
    try {
      const res = await fetch('/api/listings');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setIsLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchUsers();
    fetchListings();
  }, [fetchOverview, fetchUsers, fetchListings]);

  // Quick Ban by Name handler
  const handleQuickBan = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickBanUsername.trim().replace(/^@/, '');
    if (!clean) {
      notify('error', 'Lütfen yasaklanacak Discord kullanıcı adını girin.');
      return;
    }
    if (clean === '1231321323') {
      notify('error', 'Root admin hesabı yasaklanamaz!');
      return;
    }
    setIsQuickBanning(true);
    try {
      const currentToken = getAuthToken();
      const res = await fetch('/api/admin/users/ban-by-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          username: clean,
          reason: quickBanReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify('success', data.message || `@${clean} başarıyla yasaklandı.`);
      setQuickBanUsername('');
      fetchUsers();
      fetchOverview();
    } catch (err: any) {
      notify('error', err.message || 'Kullanıcı yasaklanamadı.');
    } finally {
      setIsQuickBanning(false);
    }
  };

  // İlan Silme İşlemi
  const handleConfirmDeleteListing = async () => {
    if (!listingToDelete) return;
    try {
      const currentToken = getAuthToken();
      const res = await fetch(`/api/admin/listings/${listingToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify('success', data.message || `"${listingToDelete.title}" başarıyla silindi.`);
      setListings((prev) => prev.filter((l) => l.id !== listingToDelete.id));
      setListingToDelete(null);
      fetchOverview();
    } catch (err: any) {
      notify('error', err.message || 'İlan silinemedi.');
    }
  };

  // Kullanıcı Yasaklama / Yasak Kaldırma İşlemi
  const handleConfirmToggleBan = async () => {
    if (!userToBanModal) return;
    const { user, action } = userToBanModal;
    if (user.username === '1231321323') {
      notify('error', 'Ana admin hesabı yasaklanamaz!');
      setUserToBanModal(null);
      return;
    }
    try {
      const currentToken = getAuthToken();
      const res = await fetch(`/api/admin/users/${user.id}/toggle-ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ reason: banReasonInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify('success', data.message || 'Kullanıcı durumu güncellendi.');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                isBanned: action === 'ban',
                banReason: action === 'ban' ? banReasonInput.trim() : undefined,
              }
            : u
        )
      );
      setUserToBanModal(null);
      fetchOverview();
    } catch (err: any) {
      notify('error', err.message || 'İşlem başarısız.');
    }
  };

  // Kullanıcı Silme İşlemi
  const handleConfirmDeleteUser = async () => {
    if (!userToDeleteModal) return;
    if (userToDeleteModal.username === '1231321323') {
      notify('error', 'Ana admin hesabı silinemez!');
      setUserToDeleteModal(null);
      return;
    }
    try {
      const currentToken = getAuthToken();
      const res = await fetch(`/api/admin/users/${userToDeleteModal.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify('success', data.message || 'Kullanıcı silindi.');
      setUsers((prev) => prev.filter((u) => u.id !== userToDeleteModal.id));
      setUserToDeleteModal(null);
      fetchListings();
      fetchOverview();
    } catch (err: any) {
      notify('error', err.message || 'Kullanıcı silinemedi.');
    }
  };

  // Pazar & Güvenlik Ayarlarını Kaydetme
  const handleSaveSystemSettings = async () => {
    setIsSavingSettings(true);
    try {
      const currentToken = getAuthToken();
      const res = await fetch('/api/admin/system/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(systemSettings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify('success', data.message || 'Pazar ve güvenlik ayarları başarıyla kaydedildi.');
      fetchOverview();
    } catch (err: any) {
      notify('error', err.message || 'Ayarlar kaydedilemedi.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Webhook Testi Gönder
  const handleTestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingWebhook(true);
    setWebhookResult(null);
    try {
      const currentToken = getAuthToken();
      const res = await fetch('/api/admin/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ testMessage: testWebhookMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWebhookResult({ success: true, text: data.message || 'Discord webhook bildirimi başarıyla iletildi.' });
      setTestWebhookMsg('');
    } catch (err: any) {
      setWebhookResult({ success: false, text: err.message || 'Webhook gönderimi başarısız.' });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Filtered listings
  const filteredListings = listings.filter((l) => {
    if (selectedGameFilter !== 'ALL' && l.game !== selectedGameFilter) return false;
    if (!listingsSearch.trim()) return true;
    const q = listingsSearch.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.ownerUsername.toLowerCase().includes(q) ||
      l.ownerDiscordTag.toLowerCase().includes(q) ||
      l.offeredItemsText.toLowerCase().includes(q) ||
      l.lookingForText.toLowerCase().includes(q)
    );
  });

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (usersFilter === 'ACTIVE' && u.isBanned) return false;
    if (usersFilter === 'BANNED' && !u.isBanned) return false;
    if (!usersSearch.trim()) return true;
    const q = usersSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.discordTag.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const bannedUsersCount = users.filter((u) => u.isBanned).length;
  const activeUsersCount = users.filter((u) => !u.isBanned).length;
  const mm2ListingsCount = listings.filter((l) => l.game === 'MM2').length;
  const adoptMeListingsCount = listings.filter((l) => l.game === 'Adopt Me!').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Üst Bar / Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo ve Admin Başlığı */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMarketplace}
              className="text-2xl font-normal tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-zinc-100 to-indigo-300 hover:opacity-80 transition-opacity cursor-pointer"
            >
              𝖆𝖑𝖘𝖆𝖙
            </button>
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>ROOT ADMİN KONSOLU</span>
            </span>
          </div>

          {/* Hızlı Butonlar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToMarketplace}
              className="px-3.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Pazar Vitrini</span>
            </button>

            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Oturumu Kapat"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>

        {/* Tab Menüsü */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-zinc-800/80 py-2">
          {[
            { id: 'overview', label: 'Genel Bakış & Hızlı Masa', icon: Activity, count: null },
            { id: 'listings', label: 'İlan Yönetimi', icon: Layers, count: listings.length },
            { id: 'users', label: 'Üye Yönetimi', icon: Users, count: users.length },
            { id: 'controls', label: 'Pazar İzinleri & Güvenlik', icon: Sliders, count: null },
            { id: 'security', label: 'Siber & Robot Logları', icon: ShieldCheck, count: securityLogs.length },
            { id: 'webhook', label: 'Discord & Duyuru', icon: Megaphone, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-purple-500/30 text-purple-200' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Global Bildirim */}
      {actionMessage && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 shadow-lg animate-in fade-in ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        </div>
      )}

      {/* Ana İçerik */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* =========================================================
            TAB 1: GENEL BAKIŞ & HIZLI YÖNETİCİ MASASI (OVERVIEW)
           ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Hızlı Durum Rozetleri */}
            <div className="flex flex-wrap items-center gap-2 bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800">
              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Pazar Durumu:</span>
              </span>

              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  systemSettings.allowNewListings
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-950 text-rose-300 border-rose-500/40'
                }`}
              >
                {systemSettings.allowNewListings ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>İlan Verme: {systemSettings.allowNewListings ? 'Açık' : 'DURDURULDU'}</span>
              </span>

              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  systemSettings.marketplaceMaintenance
                    ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-950 text-zinc-300 border-zinc-700'
                }`}
              >
                <span>Bakım Modu: {systemSettings.marketplaceMaintenance ? 'AKTİF' : 'Kapalı'}</span>
              </span>

              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-zinc-950 text-indigo-300 border border-indigo-500/30">
                Spam Cooldown: {systemSettings.listingCooldownSeconds}s
              </span>

              <button
                onClick={() => setActiveTab('controls')}
                className="ml-auto text-xs font-bold text-purple-300 hover:text-white underline cursor-pointer"
              >
                İzinleri ve Ayarları Değiştir &rarr;
              </button>
            </div>

            {/* Canlı İstatistik Kartları */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-bold">Toplam Üye</span>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {users.length || stats?.totalUsers || 0}
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">{activeUsersCount} Aktif</span>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">{bannedUsersCount} Yasaklı</span>
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-bold">Aktif İlanlar</span>
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {listings.length || stats?.totalListings || 0}
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                  <span className="text-rose-400 font-bold">MM2: {mm2ListingsCount}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">Adopt Me: {adoptMeListingsCount}</span>
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-bold">Robot Koruması</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                  {stats?.totalCaptchaPassed ?? 0}
                </div>
                <div className="text-[10px] text-rose-400 font-bold">
                  {stats?.totalCaptchaFailed ?? 0} Engellenen Bot / Hata
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-bold">Sunucu Durumu</span>
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {stats?.memoryUsageMb ?? 0} MB RAM
                </div>
                <div className="text-[10px] text-zinc-500">
                  Uptime: {Math.floor((stats?.uptimeSeconds ?? 0) / 60)} dk
                </div>
              </div>
            </div>

            {/* ⚡ HIZLI KULLANICI YASAKLAMA & GÜVENLİK MASASI (DOĞRUDAN OVERVIEW ÜZERİNDE) */}
            <div className="bg-gradient-to-r from-rose-950/50 via-zinc-900/90 to-zinc-900/90 border border-rose-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400" />
                    <span>⚡ Hızlı Kullanıcı Yasaklama &amp; Kara Liste Masası</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Discord kullanıcı adını yazarak üyenin oturumunu ve ilan verme yetkisini saniyeler içinde askıya alın.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-rose-300 bg-rose-950 px-2.5 py-1 rounded-lg border border-rose-500/30 w-fit">
                  Anında Etkili Yaptırım
                </span>
              </div>

              <form onSubmit={handleQuickBan} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={quickBanUsername}
                    onChange={(e) => setQuickBanUsername(e.target.value)}
                    placeholder="Yasaklanacak Discord kullanıcı adı (örn: scammer99)"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-5">
                  <select
                    value={quickBanReason}
                    onChange={(e) => setQuickBanReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Dolandırıcılık / Scam">Dolandırıcılık / Scam Şüphesi</option>
                    <option value="Spam İlan Yayını">Spam İlan Yayını (Cooldown İhlali)</option>
                    <option value="Hile / Bot / Multi-Hesap">Hile / Bot / Multi-Hesap</option>
                    <option value="Uygunsuz / Hakaret İçeren Başlık">Uygunsuz / Hakaret İçeren Başlık</option>
                    <option value="Sahte Eşya Vaadi">Sahte Eşya Vaadi</option>
                    <option value="Yönetici Tarafından Doğrudan Askıya Alındı">Yönetici Tarafından Doğrudan Askıya Alındı</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={isQuickBanning}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isQuickBanning ? 'Yasaklanıyor...' : '🚫 Anında Yasakla'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 🗑️ CANLI İLANLAR & HIZLI SİLME MASASI */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-black text-white">Canlı İlanlar &amp; Hızlı Silme Masası</h3>
                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">
                    {listings.length} ilan yayında
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchListings}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-zinc-800"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Yenile</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="text-xs font-bold text-purple-300 hover:text-white underline cursor-pointer"
                  >
                    Tüm İlanları Gör &rarr;
                  </button>
                </div>
              </div>

              {listings.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">Vitrinde henüz ilan bulunmuyor.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {listings.slice(0, 6).map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-3.5 flex flex-col justify-between space-y-3 shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                              listing.game === 'MM2'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {listing.game}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {new Date(listing.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {listing.imageUrl && (
                          <div className="h-24 w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80">
                            <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="text-xs font-black text-white line-clamp-1">{listing.title}</div>
                        <div className="text-[11px] text-zinc-400">
                          Sahip: <span className="text-indigo-300 font-mono">@{listing.ownerUsername}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                        {onSelectListingDetail && (
                          <button
                            onClick={() => onSelectListingDetail(listing)}
                            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-zinc-800"
                          >
                            <Eye className="w-3 h-3" /> İncele
                          </button>
                        )}
                        <button
                          onClick={() => setListingToDelete(listing)}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>İlanı Sil</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 👥 KAYITLI ÜYELER & HIZLI YAPTIRIM MASASI */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-black text-white">Kayıtlı Üyeler &amp; Hızlı Yaptırım Masası</h3>
                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">
                    {users.length} üye
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchUsers}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-zinc-800"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Yenile</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="text-xs font-bold text-purple-300 hover:text-white underline cursor-pointer"
                  >
                    Tüm Üyeleri Yönet &rarr;
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Üye</th>
                      <th className="py-2.5 px-3">Rol</th>
                      <th className="py-2.5 px-3">İlanlar</th>
                      <th className="py-2.5 px-3">Durum</th>
                      <th className="py-2.5 px-3 text-right">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {users.slice(0, 5).map((user) => {
                      const isMainAdmin = user.username === '1231321323';
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{user.username}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{user.discordTag}</div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {isMainAdmin ? (
                              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-mono text-[9px] font-bold">
                                ROOT ADMİN
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[10px]">STANDART</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                            {user.listingsCount} ilan
                          </td>
                          <td className="py-2.5 px-3">
                            {user.isBanned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 font-mono text-[9px] font-bold">
                                <Ban className="w-2.5 h-2.5" /> YASAKLI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono text-[9px] font-bold">
                                <CheckCircle className="w-2.5 h-2.5" /> AKTİF
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isMainAdmin ? (
                              <span className="text-zinc-500 text-[10px] italic">Korumalı</span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    setUserToBanModal({
                                      user,
                                      action: user.isBanned ? 'unban' : 'ban',
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                    user.isBanned
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                                  }`}
                                >
                                  {user.isBanned ? (
                                    <>
                                      <UserCheck className="w-3 h-3" />
                                      <span>Yasağı Kaldır</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3" />
                                      <span>Yasakla</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => setUserToDeleteModal(user)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-transparent hover:border-rose-500/40 cursor-pointer"
                                  title="Kullanıcıyı ve ilanlarını sil"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hızlı Son Güvenlik Olayları */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>Son Güvenlik &amp; Denetim Hareketleri</span>
                </h3>
                <button
                  onClick={fetchOverview}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" /> Yenile
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto font-mono text-xs">
                {securityLogs.length === 0 ? (
                  <div className="text-zinc-500 text-center py-4">Kayıtlı güvenlik olayı bulunamadı.</div>
                ) : (
                  securityLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action === 'CHALLENGE_PASSED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : log.action === 'CHALLENGE_FAILED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-zinc-300 font-sans">{log.details || '-'}</span>
                      </div>
                      <div className="text-zinc-500 text-[10px]">
                        {log.ip} • {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* =========================================================
            TAB 2: PROFESYONEL İLAN YÖNETİMİ (LISTINGS MANAGER)
           ========================================================= */}
        {activeTab === 'listings' && (
          <div className="space-y-4">
            
            {/* Üst Bilgi ve Arama Çubuğu */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'MM2', 'Adopt Me!'] as const).map((game) => (
                  <button
                    key={game}
                    onClick={() => setSelectedGameFilter(game)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedGameFilter === game
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {game === 'ALL' ? `Tümü (${listings.length})` : `${game} (${listings.filter(l => l.game === game).length})`}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={listingsSearch}
                  onChange={(e) => setListingsSearch(e.target.value)}
                  placeholder="İlan başlığı, eşya veya kullanıcı ara..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* İlanlar Kartları */}
            {isLoadingListings ? (
              <div className="py-20 text-center text-zinc-500 text-xs">İlanlar taranıyor...</div>
            ) : filteredListings.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center space-y-2">
                <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-zinc-400 text-sm font-bold">Kriterlere uygun ilan bulunamadı.</div>
                <p className="text-xs text-zinc-500">Arama filtrenizi temizleyebilir veya yeni ilan eklenmesini bekleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-4 flex flex-col justify-between space-y-3 shadow-lg"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                            listing.game === 'MM2'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {listing.game}
                        </span>

                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Görsel Thumbnail Önizleme */}
                      {listing.imageUrl && (
                        <div className="h-32 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
                          <img
                            src={listing.imageUrl}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <h4 className="text-sm font-black text-white line-clamp-1">{listing.title}</h4>

                      <div className="text-xs text-zinc-300 space-y-1">
                        <div>
                          <span className="text-emerald-400 font-bold">Verilen: </span>
                          <span className="line-clamp-1 text-zinc-400">{listing.offeredItemsText}</span>
                        </div>
                        <div>
                          <span className="text-purple-400 font-bold">Aranan: </span>
                          <span className="line-clamp-1 text-zinc-400">{listing.lookingForText}</span>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-indigo-300 bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                        <span>Sahip: @{listing.ownerUsername}</span>
                        <span className="text-zinc-500">({listing.ownerDiscordTag})</span>
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      {onSelectListingDetail && (
                        <button
                          onClick={() => onSelectListingDetail(listing)}
                          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer py-1.5 px-2.5 rounded-xl hover:bg-zinc-800"
                        >
                          <Eye className="w-3.5 h-3.5" /> İncele
                        </button>
                      )}

                      <button
                        onClick={() => setListingToDelete(listing)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-rose-600/30 ml-auto"
                        title="İlanı kalıcı olarak sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>🗑️ İlanı Sistemden Sil</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* =========================================================
            TAB 3: PROFESYONEL ÜYE YÖNETİMİ (USERS MANAGER)
           ========================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            
            {/* Hızlı Kullanıcı Yasaklama Masası */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Ban className="w-3.5 h-3.5 text-rose-400" />
                  <span>Kullanıcı Adı İle Doğrudan Yasaklama Masası</span>
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Kara Liste Yaptırımı</span>
              </div>

              <form onSubmit={handleQuickBan} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={quickBanUsername}
                    onChange={(e) => setQuickBanUsername(e.target.value)}
                    placeholder="Discord kullanıcı adı (örn: scammer99)"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    value={quickBanReason}
                    onChange={(e) => setQuickBanReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Dolandırıcılık / Scam">Dolandırıcılık / Scam</option>
                    <option value="Spam İlan Yayını">Spam İlan Yayını</option>
                    <option value="Hile / Bot / Multi-Hesap">Hile / Bot / Multi-Hesap</option>
                    <option value="Uygunsuz / Hakaret İçeren Başlık">Uygunsuz / Hakaret İçeren Başlık</option>
                    <option value="Sahte Eşya Vaadi">Sahte Eşya Vaadi</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={isQuickBanning}
                    className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1 shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isQuickBanning ? 'Yasaklanıyor...' : '🚫 Anında Yasakla'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Filtre ve Arama Çubuğu */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUsersFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    usersFilter === 'ALL'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Tümü ({users.length})
                </button>
                <button
                  onClick={() => setUsersFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    usersFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Aktif ({activeUsersCount})
                </button>
                <button
                  onClick={() => setUsersFilter('BANNED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    usersFilter === 'BANNED'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Yasaklı ({bannedUsersCount})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  placeholder="Discord ismi veya ID ile ara..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            {/* Kullanıcı Listesi Tablosu */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Discord Üyesi</th>
                      <th className="py-3.5 px-4">Rol / Yetki</th>
                      <th className="py-3.5 px-4">İlan Sayısı</th>
                      <th className="py-3.5 px-4">Durum &amp; Yasak Nedeni</th>
                      <th className="py-3.5 px-4">Kayıt Tarihi</th>
                      <th className="py-3.5 px-4 text-right">Profesyonel Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredUsers.map((user) => {
                      const isMainAdmin = user.username === '1231321323';
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-inner shrink-0">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{user.username}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{user.discordTag}</div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isMainAdmin ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-500/40 font-mono text-[10px] font-bold">
                                ROOT ADMİN
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[11px]">STANDART</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                            {user.listingsCount} ilan
                          </td>

                          <td className="py-3 px-4">
                            {user.isBanned ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-500/40 font-mono text-[10px] font-bold">
                                  <Ban className="w-3 h-3" /> YASAKLI
                                </span>
                                {user.banReason && (
                                  <div className="text-[10px] text-rose-400 font-sans italic max-w-xs truncate">
                                    {user.banReason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3" /> AKTİF
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isMainAdmin ? (
                              <span className="text-zinc-500 text-[10px] italic">Korumalı Hesap</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() =>
                                    setUserToBanModal({
                                      user,
                                      action: user.isBanned ? 'unban' : 'ban',
                                    })
                                  }
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm flex items-center gap-1 ${
                                    user.isBanned
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                                  }`}
                                  title={user.isBanned ? 'Yasağı Aç' : 'Kullanıcıyı Yasakla'}
                                >
                                  {user.isBanned ? (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Yasağı Kaldır</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>Yasakla</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => setUserToDeleteModal(user)}
                                  className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-transparent hover:border-rose-500/40 transition-colors cursor-pointer"
                                  title="Kullanıcıyı ve ilanlarını sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================
            TAB 4: PAZAR İZİNLERİ & GÜVENLİK AYARLARI (CONTROLS & SETTINGS)
           ========================================================= */}
        {activeTab === 'controls' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="space-y-1 border-b border-zinc-800 pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  <span>Pazar İzinleri &amp; Siber Güvenlik Ayarları</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  İlan verme iznini anında durdurabilir, bakım modunu tetikleyebilir ve spam cooldown sürelerini yapılandırabilirsiniz.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. İLAN VERME İZNİ */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    systemSettings.allowNewListings
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {systemSettings.allowNewListings ? (
                          <Unlock className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Lock className="w-5 h-5 text-rose-400" />
                        )}
                        <h3 className="text-sm font-black text-white">İlan Verme İzni</h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {systemSettings.allowNewListings
                          ? 'Üyeler vitrinde serbestçe yeni ilan yayınlayabilir.'
                          : 'İlan verme durduruldu! Yalnızca root yöneticiler ilan ekleyebilir, standart üyelerin ilan vermesi engellenir.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          allowNewListings: !prev.allowNewListings,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shrink-0 ${
                        systemSettings.allowNewListings
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                      }`}
                    >
                      {systemSettings.allowNewListings ? 'İlan Verme Açık' : 'İLAN VERME DURDURULDU'}
                    </button>
                  </div>
                </div>

                {/* 2. PAZAR BAKIM MODU */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    systemSettings.marketplaceMaintenance
                      ? 'bg-amber-950/30 border-amber-500/60'
                      : 'bg-zinc-950/60 border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Power className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-black text-white">Pazar Bakım Modu</h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {systemSettings.marketplaceMaintenance
                          ? 'Bakım modu aktif. Ziyaretçilere bakım uyarısı gösterilir.'
                          : 'Pazar yeri herkese açık ve normal çalışıyor.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          marketplaceMaintenance: !prev.marketplaceMaintenance,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shrink-0 ${
                        systemSettings.marketplaceMaintenance
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {systemSettings.marketplaceMaintenance ? 'Bakım Aktif' : 'Normal Mod'}
                    </button>
                  </div>
                </div>

                {/* 3. GÖRSEL YÜKLEME İZNİ */}
                <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white">Görsel Yükleme İzni</h3>
                      <p className="text-xs text-zinc-400">
                        İlan verirken cihazdan fotoğraf ekleme özelliğini açıp kapatır.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          allowImageUploads: !prev.allowImageUploads,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        systemSettings.allowImageUploads
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {systemSettings.allowImageUploads ? 'İzin Verildi' : 'Kapalı'}
                    </button>
                  </div>
                </div>

                {/* 4. MÜKERRER BAŞLIK KORUMASI */}
                <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white">Mükerrer Başlık Koruması</h3>
                      <p className="text-xs text-zinc-400">
                        Bir kullanıcının aynı başlıkta birden fazla aktif ilan oluşturmasını engeller.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          preventDuplicateTitles: !prev.preventDuplicateTitles,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        systemSettings.preventDuplicateTitles
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {systemSettings.preventDuplicateTitles ? 'Koruma Aktif' : 'Devre Dışı'}
                    </button>
                  </div>
                </div>

              </div>

              {/* 5. SPAM BEKLEME SÜRESİ (COOLDOWN) */}
              <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>İlan Verme Cooldown (Spam Bekleme Süresi)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Bir üyenin ardı ardına ilan vermesini engellemek için iki ilan arasındaki zorunlu bekleme süresi.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-black text-purple-300 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-500/40">
                    {systemSettings.listingCooldownSeconds} Saniye
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {[0, 15, 30, 60, 120, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          listingCooldownSeconds: sec,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                        systemSettings.listingCooldownSeconds === sec
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {sec === 0 ? 'Süresiz (0s)' : `${sec} sn`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. CANLI DUYURU METNİ */}
              <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-purple-400" />
                  <span>Global Pazar Duyurusu Metni</span>
                </h3>
                <input
                  type="text"
                  value={systemSettings.globalAnnouncement}
                  onChange={(e) =>
                    setSystemSettings((prev) => ({
                      ...prev,
                      globalAnnouncement: e.target.value,
                    }))
                  }
                  placeholder="Sitede en üstte kayan/görünen canlı bildiri metni..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {/* Kaydet Butonu */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSystemSettings}
                  disabled={isSavingSettings}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Ayarlar Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Tüm Pazar ve Güvenlik Ayarlarını Kaydet</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: SİBER GÜVENLİK & ROBOT LOGLARI (SECURITY)
           ========================================================= */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Siber Güvenlik, Captcha ve Denetim Günlüğü</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Oturum açma, robot doğrulama ve kullanıcı yaptırım logları anlık olarak listelenir.
                  </p>
                </div>

                <button
                  onClick={fetchOverview}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Günlüğü Tazele</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[32rem] overflow-y-auto font-mono text-xs">
                {securityLogs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">Henüz kaydedilmiş güvenlik logu yok.</div>
                ) : (
                  securityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                            log.action === 'CHALLENGE_PASSED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : log.action === 'CHALLENGE_FAILED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-zinc-200 font-sans text-xs">{log.details || '-'}</span>
                      </div>

                      <div className="text-zinc-500 text-[10px] flex items-center gap-2">
                        <span>IP: {log.ip}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 6: DISCORD ENTEGRASYONU & TEST
           ========================================================= */}
        {activeTab === 'webhook' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="space-y-1 border-b border-zinc-800 pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-400" />
                  <span>Discord Webhook &amp; Bildirim Entegrasyonu</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Yeni ilanlar yayınlandığında Discord sunucunuzdaki takas kanalına otomatik ve şık embed mesaj iletilir.
                </p>
              </div>

              {/* Webhook Test Formu */}
              <form onSubmit={handleTestWebhook} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                    <span>Test Bildirimi Gönder</span>
                  </label>
                  <input
                    type="text"
                    value={testWebhookMsg}
                    onChange={(e) => setTestWebhookMsg(e.target.value)}
                    placeholder="Örn: Alsat Admin Paneli Discord bağlantı testi başarılı!"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-zinc-500">
                    💡 İlan verildiğinde yüklenen fotoğraflar Discord kanalına iliştirilerek gönderilir.
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingWebhook}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSendingWebhook ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>İletiliyor...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Test Webhook Gönder</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Webhook Test Sonucu */}
              {webhookResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-in fade-in ${
                    webhookResult.success
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {webhookResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <span>{webhookResult.text}</span>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* =========================================================
          PROFESYONEL ONAY MODALLARI (window.confirm YERİNE)
         ========================================================= */}

      {/* 1. İLAN SİLME ONAY MODALI */}
      {listingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-rose-500/50 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-black text-sm">
                <Trash2 className="w-4 h-4" />
                <span>İlanı Kalıcı Olarak Sil</span>
              </div>
              <button
                onClick={() => setListingToDelete(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {listingToDelete.imageUrl && (
                <div className="h-32 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
                  <img
                    src={listingToDelete.imageUrl}
                    alt={listingToDelete.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-purple-400 uppercase font-bold">
                  {listingToDelete.game} İLAN VİTRİNİ
                </div>
                <div className="text-sm font-black text-white">{listingToDelete.title}</div>
                <div className="text-xs text-zinc-400">
                  İlan Sahibi: <span className="text-indigo-300 font-mono">@{listingToDelete.ownerUsername}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Bu işlem geri alınamaz. İlan vitrinden ve sunucudan tamamen temizlenir.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setListingToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteListing}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Evet, İlanı Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. KULLANICI YASAKLAMA / YASAK KALDIRMA MODALI */}
      {userToBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 font-black text-sm text-white">
                {userToBanModal.action === 'ban' ? (
                  <>
                    <Ban className="w-4 h-4 text-rose-400" />
                    <span>Üyeyi Yasakla (Banla)</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Üye Yasağını Kaldır</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setUserToBanModal(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                  {userToBanModal.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-black text-white">@{userToBanModal.user.username}</div>
                  <div className="text-xs text-indigo-300 font-mono">{userToBanModal.user.discordTag}</div>
                  <div className="text-[10px] text-zinc-500">{userToBanModal.user.listingsCount} aktif ilanı var</div>
                </div>
              </div>

              {userToBanModal.action === 'ban' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300">Yasaklama Gerekçesi Belirtin:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Spam ilan verme', 'Dolandırıcılık / Scam', 'Şüpheli takas davranışı', 'Kural ihlali / Hakaret', 'Sahte eşya vaadi'].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBanReasonInput(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            banReasonInput === preset
                              ? 'bg-rose-950 text-rose-200 border border-rose-500/50'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={banReasonInput}
                    onChange={(e) => setBanReasonInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                    placeholder="Özel gerekçe notu girin..."
                  />
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                    ⚠️ Yasaklanan üyenin oturumu derhal geçersiz kılınır ve ilan vermesi engellenir.
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs">
                  ✅ Bu üyenin yasağı kaldırılacak ve platforma yeniden güvenli giriş yapabilecektir.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToBanModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleBan}
                className={`px-4 py-2 rounded-xl text-xs font-black text-white shadow-lg cursor-pointer ${
                  userToBanModal.action === 'ban'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {userToBanModal.action === 'ban' ? 'Kullanıcıyı Yasakla' : 'Yasağı Kaldır ve Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. KULLANICIYI VE İLANLARINI SİLME MODALI */}
      {userToDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-rose-500/50 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-black text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Kullanıcıyı ve Tüm İlanlarını Sil</span>
              </div>
              <button
                onClick={() => setUserToDeleteModal(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-1">
              <div className="text-sm font-black text-white">@{userToDeleteModal.username}</div>
              <div className="text-xs text-zinc-400">Discord: {userToDeleteModal.discordTag}</div>
              <div className="text-xs text-rose-300 font-mono">
                {userToDeleteModal.listingsCount} ilan kalıcı olarak silinecek.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
              Bu kullanıcı hesabı ve açmış olduğu tüm vitrin ilanları diskten kalıcı olarak silinecektir.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDeleteModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Kullanıcıyı ve İlanlarını Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
