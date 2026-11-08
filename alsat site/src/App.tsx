import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Flame,
  PlusCircle,
  Megaphone,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ListingCard } from './components/ListingCard';
import { LandingPortal } from './components/LandingPortal';
import { CreateListingModal } from './components/CreateListingModal';
import { AuthModal } from './components/AuthModal';
import { LogoutModal } from './components/LogoutModal';
import { LoginAnimationModal } from './components/LoginAnimationModal';
import { ListingDetailModal } from './components/ListingDetailModal';
import { LiveBackground } from './components/LiveBackground';
import { CaptchaGate } from './components/CaptchaGate';
import { AdminPanel } from './components/AdminPanel';
import { CategoryShowcase } from './components/CategoryShowcase';
import { User, AuthResponse } from './types/auth';
import { Listing } from './types/listing';

const TOKEN_KEY = 'alsat_auth_token';
const CAPTCHA_KEY = 'alsat_captcha_verified';

export default function App() {
  // Her siteye girişte ilk olarak robot doğrulaması kapısı açılır (?autostart=1 ile test için geçilebilir)
  const [isCaptchaVerified, setIsCaptchaVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('skipCaptcha') === '1') {
        return true;
      }
    }
    return false; // Her girişte ve yenilemede daima ilk doğrulama ekranı çıkar!
  });

  // Admin Paneli vs Pazar Vitrini modu
  const [viewMode, setViewMode] = useState<'marketplace' | 'admin'>('marketplace');

  // Canlı global sistem duyurusu
  const [globalAnnouncement, setGlobalAnnouncement] = useState<string>('');

  // Sistem pazar ayarları (İlan izni, bakım modu, cooldown vs.)
  const [systemSettings, setSystemSettings] = useState<{
    allowNewListings: boolean;
    marketplaceMaintenance: boolean;
    allowImageUploads: boolean;
    listingCooldownSeconds: number;
    globalAnnouncement: string;
  }>({
    allowNewListings: true,
    marketplaceMaintenance: false,
    allowImageUploads: true,
    listingCooldownSeconds: 60,
    globalAnnouncement: '',
  });

  const fetchSystemSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system/settings');
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setSystemSettings(data.settings);
          if (data.settings.globalAnnouncement) {
            setGlobalAnnouncement(data.settings.globalAnnouncement);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSystemSettings();
  }, [fetchSystemSettings]);

  // Giriş yapmış kullanıcı için MM2 ve Adopt Me! kategorileri
  const [selectedGame, setSelectedGame] = useState<'Adopt Me!' | 'MM2' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateListingOpen, setIsCreateListingOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [selectedListingForDetail, setSelectedListingForDetail] = useState<Listing | null>(null);

  // İlan Verme Butonu Tıklama Animasyonu
  const [isOpeningCreate, setIsOpeningCreate] = useState(false);

  // Giriş Animasyonu State'leri
  const [isLoginAnimating, setIsLoginAnimating] = useState(false);
  const [pendingAuthData, setPendingAuthData] = useState<AuthResponse | null>(null);

  // Global toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'alert' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'alert' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Global duyuruyu çek
  useEffect(() => {
    fetch('/api/announcement')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.announcement) {
          setGlobalAnnouncement(data.announcement);
        }
      })
      .catch(() => {});
  }, []);

  // Verify stored auth token (persistent session)
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setCurrentUser(data.user);
            // 1231321323 kullanıcısı için doğrudan admin paneli açılır
            if (data.user.username === '1231321323' || data.user.isAdmin) {
              setViewMode('admin');
            }
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setCurrentUser(null);
          }
        })
        .catch(() => {});
    }
  }, [token]);

  // Giriş / Kayıt Başarılı Olduğunda: Önce Animasyon Başlatılır
  const handleAuthSuccess = (data: AuthResponse) => {
    setPendingAuthData(data);
    setIsLoginAnimating(true);
  };

  // Animasyon Tamamlandığında: Pazar Oturumu Açılır
  const handleLoginAnimationComplete = () => {
    if (pendingAuthData) {
      localStorage.setItem(TOKEN_KEY, pendingAuthData.token);
      setToken(pendingAuthData.token);
      setCurrentUser(pendingAuthData.user);

      // Kullanıcı isteği: 1231321323 nickli hesapla girildiğinde tam takır admin paneli açılsın
      const isAdm = pendingAuthData.user.username === '1231321323' || pendingAuthData.user.isAdmin;
      if (isAdm) {
        setViewMode('admin');
        showToast('success', 'Yönetici girişi başarılı. Admin Konsolu açıldı.');
      } else {
        setViewMode('marketplace');
        showToast('success', `Hoş geldin, ${pendingAuthData.user.username}! Alsat Roblox Pazarı'na bağlandın.`);
      }
      fetchListings();
    }
    setIsLoginAnimating(false);
    setPendingAuthData(null);
  };

  // İlan Ver Tıklama Animasyonu
  const handleOpenCreateWithAnimation = () => {
    if (isOpeningCreate) return;
    const isRootOrAdmin = currentUser?.username === '1231321323' || currentUser?.isAdmin;
    if (!systemSettings.allowNewListings && !isRootOrAdmin) {
      showToast('alert', 'İlan verme işlemleri şu anda yönetici tarafından geçici olarak durdurulmuştur.');
      return;
    }
    if (currentUser?.isBanned) {
      showToast('error', 'Hesabınız yasaklandığı için yeni ilan veremezsiniz.');
      return;
    }
    setIsOpeningCreate(true);
    setTimeout(() => {
      setIsOpeningCreate(false);
      setIsCreateListingOpen(true);
    }, 220);
  };

  const handleLogout = () => {
    if (isLogoutModalOpen) return;
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
    setViewMode('marketplace');
    setIsLogoutModalOpen(false);
    showToast('info', 'Oturumunuz başarıyla kapatıldı.');
  };

  // Fetch listings from backend
  const fetchListings = useCallback(async () => {
    try {
      setIsLoadingListings(true);
      const res = await fetch('/api/listings');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setIsLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleListingCreated = (newListing: Listing) => {
    setListings((prev) => [newListing, ...prev]);
    showToast('success', `"${newListing.title}" ilanınız başarıyla vitrinde yayınlandı!`);
  };

  // Filter listings by selected game and search query
  const filteredListings = listings.filter((l) => {
    if (selectedGame !== 'ALL' && l.game !== selectedGame) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = l.title.toLowerCase().includes(q);
    const matchesOwner = l.ownerUsername.toLowerCase().includes(q) || l.ownerDiscordTag.toLowerCase().includes(q);
    const matchesOffered = l.offeredItemsText.toLowerCase().includes(q);
    const matchesLooking = l.lookingForText.toLowerCase().includes(q);
    return matchesTitle || matchesOwner || matchesOffered || matchesLooking;
  });

  const mm2ListingsCount = listings.filter((l) => l.game === 'MM2').length;
  const adoptMeListingsCount = listings.filter((l) => l.game === 'Adopt Me!').length;

  // Sitenin en başında gerçek robot doğrulaması kapısı
  if (!isCaptchaVerified) {
    return (
      <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
        <LiveBackground />
        <CaptchaGate onVerified={() => setIsCaptchaVerified(true)} />
      </div>
    );
  }

  // 1231321323 nickli hesapla girildiğinde doğrudan tam takır admin paneli açılır
  if (viewMode === 'admin' && (currentUser?.username === '1231321323' || currentUser?.isAdmin)) {
    return (
      <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
        <LiveBackground />
        <AdminPanel
          currentUser={currentUser}
          token={token || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : '') || ''}
          onBackToMarketplace={() => setViewMode('marketplace')}
          onLogout={handleLogout}
          onSelectListingDetail={(selected) => setSelectedListingForDetail(selected)}
        />
        {/* Full-Screen Listing Detail Modal */}
        <ListingDetailModal
          listing={selectedListingForDetail}
          isOpen={!!selectedListingForDetail}
          onClose={() => setSelectedListingForDetail(null)}
        />
        {/* Logout Modal */}
        <LogoutModal
          isOpen={isLogoutModalOpen}
          currentUser={currentUser}
          onConfirmLogout={handleConfirmLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Live Background Video (https://files.catbox.moe/901ofh.mp4) */}
      <LiveBackground />

      {/* Canlı Global Sistem Duyurusu */}
      {globalAnnouncement && (
        <div className="bg-gradient-to-r from-purple-950/90 via-zinc-900/90 to-indigo-950/90 border-b border-purple-500/30 px-4 py-2 text-center text-xs font-mono font-medium text-purple-200 flex items-center justify-center gap-2 relative z-30 shadow-md backdrop-blur-md">
          <Megaphone className="w-3.5 h-3.5 text-purple-400 shrink-0 animate-pulse" />
          <span>{globalAnnouncement}</span>
        </div>
      )}

      {/* Toast Bildirimi */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-sm font-medium backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
                : toastMessage.type === 'alert'
                ? 'bg-amber-950/90 text-amber-200 border-amber-500/40'
                : toastMessage.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-500/40'
                : 'bg-zinc-900/95 text-zinc-200 border-zinc-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        selectedGame={selectedGame}
        onSelectGame={(game) => {
          setSelectedGame(game);
        }}
        mm2Count={mm2ListingsCount}
        adoptMeCount={adoptMeListingsCount}
        currentUser={currentUser}
        isLoggingOut={isLogoutModalOpen}
        isAdminView={viewMode === 'admin'}
        allowNewListings={systemSettings.allowNewListings}
        onOpenAdmin={() => setViewMode((prev) => (prev === 'admin' ? 'marketplace' : 'admin'))}
        onOpenAuth={() => {
          if (!isLogoutModalOpen) setIsAuthOpen(true);
        }}
        onOpenCreateListing={() => {
          if (!isLogoutModalOpen) {
            if (currentUser) {
              handleOpenCreateWithAnimation();
            } else {
              setIsAuthOpen(true);
            }
          }
        }}
        onLogout={handleLogout}
      />

      {/* Bakım Modu Uyarısı (Yönetici Olmayanlar İçin) */}
      {systemSettings.marketplaceMaintenance && !currentUser?.isAdmin && currentUser?.username !== '1231321323' && (
        <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-2.5 text-center text-xs font-mono font-bold text-amber-200 flex items-center justify-center gap-2 relative z-20 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>PAZAR YERİ BAKIM MODUNDA: Yeni ilan verme ve bazı işlemler sistem yöneticisi tarafından geçici olarak kısıtlanmıştır.</span>
        </div>
      )}

      {/* =========================================================
          1. GİRİŞ EKRANI / PORTAL BÖLÜMÜ (GİRİŞ YAPMAMIŞ KULLANICI)
         ========================================================= */}
      {!currentUser ? (
        <main className="relative z-10 flex-1 flex flex-col justify-center">
          <LandingPortal onAuthSuccess={handleAuthSuccess} />
        </main>
      ) : (
        /* =========================================================
            2. GİRİŞ YAPAN KULLANICI İÇİN ŞIK VE ÖZEL PAZAR ALANI
           ========================================================= */
        <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
          
          {/* Şık Oyun Başlık Sahnesi (MM2 vs Adopt Me - Emojisiz, Şık Fontlu) */}
          <div
            className={`relative rounded-3xl overflow-hidden p-6 sm:p-8 border transition-all duration-300 shadow-2xl ${
              selectedGame === 'MM2'
                ? 'bg-gradient-to-br from-rose-950/80 via-zinc-950 to-zinc-950 border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
                : selectedGame === 'Adopt Me!'
                ? 'bg-gradient-to-br from-emerald-950/80 via-zinc-950 to-zinc-950 border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.2)]'
                : 'bg-gradient-to-br from-purple-950/80 via-zinc-950 to-zinc-950 border-purple-500/60 shadow-[0_0_35px_rgba(168,85,247,0.2)]'
            }`}
          >
            {/* Arka plan süzülen neon rengi */}
            <div
              className={`absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-40 ${
                selectedGame === 'MM2' ? 'bg-rose-600' : selectedGame === 'Adopt Me!' ? 'bg-emerald-600' : 'bg-purple-600'
              }`}
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              
              {/* Sol Taraf: Oyun Başlığı, Açıklama & İlan Sayısı */}
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                      selectedGame === 'MM2'
                        ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                        : selectedGame === 'Adopt Me!'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                        : 'bg-purple-950 text-purple-300 border-purple-500/40'
                    }`}
                  >
                    <span className="font-['Orbitron'] font-black text-[10px] text-white">
                      {selectedGame === 'MM2' ? 'MM2' : selectedGame === 'Adopt Me!' ? 'PETS' : 'ROBLOX'}
                    </span>
                    <span className="font-['Rajdhani'] font-bold text-xs tracking-wide">
                      {selectedGame === 'MM2' ? 'Murder Mystery 2' : selectedGame === 'Adopt Me!' ? 'Adopt Me!' : 'Tüm Kategoriler'}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {filteredListings.length} Aktif İlan Yayında
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {selectedGame === 'MM2' ? (
                    <>MM2 Bıçak, Silah &amp; Set Pazarı</>
                  ) : selectedGame === 'Adopt Me!' ? (
                    <>Adopt Me! Pet &amp; İksir Pazarı</>
                  ) : (
                    <>Roblox MM2 &amp; Adopt Me! Takas Pazarı</>
                  )}
                </h1>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {selectedGame === 'MM2'
                    ? 'Corrupt, Harvester, Batwing, Icepiercer, Candy ve Chroma Godly takasları için doğrudan hemen anlaşın.'
                    : selectedGame === 'Adopt Me!'
                    ? 'Shadow Dragon, Bat Dragon, Frost Dragon, Mega Neon petler ve Fly/Ride iksirleri için doğrudan güvenli takas.'
                    : 'MM2 Godly bıçakları, Harvester, Corrupt ve Adopt Me! Shadow Dragon, Bat Dragon gibi en değerli eşyaları keşfedin.'}
                </p>

                {/* Popüler Eşya Etiketleri */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(selectedGame === 'MM2'
                    ? ['#Godly', '#Ancient', '#Chroma', '#Batwing', '#CorruptSet']
                    : selectedGame === 'Adopt Me!'
                    ? ['#Legendary', '#MegaNeon', '#FlyRide', '#ShadowDragon', '#FrostDragon']
                    : ['#MM2', '#AdoptMe', '#Godly', '#Legendary', '#MegaNeon', '#Ancient']
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sağ Taraf: Sadece Bu Kategoriye İlan Ver Butonu (Animasyonlu) */}
              <div className="flex items-center gap-3 shrink-0">
                {(!systemSettings.allowNewListings && !currentUser?.isAdmin && currentUser?.username !== '1231321323') ? (
                  <button
                    onClick={handleOpenCreateWithAnimation}
                    className="px-6 py-3.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-not-allowed opacity-90"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>İlan Verme Askıda</span>
                  </button>
                ) : (
                  <button
                    onClick={handleOpenCreateWithAnimation}
                    className={`px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 transition-all cursor-pointer ${
                      isOpeningCreate ? 'scale-105 ring-4 ring-purple-400/50 brightness-125' : 'hover:scale-[1.02]'
                    }`}
                  >
                    <PlusCircle className={`w-4 h-4 ${isOpeningCreate ? 'animate-spin' : ''}`} />
                    <span>{selectedGame === 'ALL' ? 'İlan Ver' : `${selectedGame} İçin İlan Ver`}</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* 🎮 ÖNE ÇIKAN OYUN KATEGORİLERİ VİTRİNİ */}
          <CategoryShowcase
            selectedGame={selectedGame}
            onSelectGame={(g) => setSelectedGame(g)}
            listings={listings}
          />

          {/* Arama Konsolu */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/90 p-3.5 sm:p-4 rounded-2xl border border-zinc-800/90 shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>
                {selectedGame === 'ALL' ? 'Tüm Kategoriler' : selectedGame} Pazar Vitrini ({filteredListings.length} İlan)
              </span>
            </div>
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`${selectedGame} eşyası veya ilan ara...`}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          {/* İlanlar Grid'i */}
          {isLoadingListings ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 space-y-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">İlanlar yükleniyor...</span>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto shadow-inner">
                <span className="font-['Orbitron'] font-black text-xs text-purple-400">
                  {selectedGame === 'MM2' ? 'MM2' : 'PETS'}
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                {selectedGame} İçin Henüz İlan Bulunmuyor
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Sitede hiçbir bot veya sahte ilan yoktur. {selectedGame} kategorisindeki ilk gerçek ilanı vererek vitrinde öne çıkın!
              </p>
              <button
                onClick={handleOpenCreateWithAnimation}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>İlk İlanı Siz Verin</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onSelect={(selected) => setSelectedListingForDetail(selected)}
                />
              ))}
            </div>
          )}

        </main>
      )}

      {/* Giriş Animasyonu Modalı */}
      <LoginAnimationModal
        isOpen={isLoginAnimating}
        username={pendingAuthData?.user.username || ''}
        discordTag={pendingAuthData?.user.discordTag || ''}
        onComplete={handleLoginAnimationComplete}
      />

      {/* Auth Modal (Gerekirse açılır) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Create Listing Modal */}
      {currentUser && token && (
        <CreateListingModal
          isOpen={isCreateListingOpen}
          onClose={() => setIsCreateListingOpen(false)}
          currentUser={currentUser}
          token={token}
          game={selectedGame}
          existingListings={listings}
          allowNewListings={systemSettings.allowNewListings}
          allowImageUploads={systemSettings.allowImageUploads}
          onListingCreated={handleListingCreated}
        />
      )}

      {/* Full-Screen Listing Detail Modal */}
      <ListingDetailModal
        listing={selectedListingForDetail}
        isOpen={!!selectedListingForDetail}
        onClose={() => setSelectedListingForDetail(null)}
      />

      {/* Cool & Expandable Logout Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        currentUser={currentUser}
        onConfirmLogout={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
}
