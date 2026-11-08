import React, { useState } from 'react';
import {
  LogOut,
  LogIn,
  PlusCircle,
  Sparkles,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { User } from '../types/auth';

interface NavbarProps {
  selectedGame: 'Adopt Me!' | 'MM2' | 'ALL';
  onSelectGame: (game: 'Adopt Me!' | 'MM2') => void;
  mm2Count?: number;
  adoptMeCount?: number;
  currentUser: User | null;
  isLoggingOut?: boolean;
  isAdminView?: boolean;
  allowNewListings?: boolean;
  onOpenAdmin?: () => void;
  onOpenAuth: () => void;
  onOpenCreateListing: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedGame,
  onSelectGame,
  mm2Count = 0,
  adoptMeCount = 0,
  currentUser,
  isLoggingOut = false,
  isAdminView = false,
  allowNewListings = true,
  onOpenAdmin,
  onOpenAuth,
  onOpenCreateListing,
  onLogout,
}) => {
  const [isBtnAnimating, setIsBtnAnimating] = useState(false);

  const handleCreateClick = () => {
    if (isLoggingOut) return;
    setIsBtnAnimating(true);
    setTimeout(() => {
      setIsBtnAnimating(false);
      if (currentUser) {
        onOpenCreateListing();
      } else {
        onOpenAuth();
      }
    }, 220);
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/90 shadow-[0_4px_30px_rgba(0,0,0,0.7)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
          
          {/* Sol Üst: 𝖆𝖑𝖘𝖆𝖙 Wordmark */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => onSelectGame('MM2')}
              className="focus:outline-none cursor-pointer py-1 text-left inline-flex items-center group transition-transform hover:scale-[1.02]"
              title="𝖆𝖑𝖘𝖆𝖙"
            >
              <span className="text-3xl sm:text-4xl font-normal tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-zinc-100 to-indigo-200 group-hover:from-purple-300 group-hover:to-emerald-300 transition-all select-none drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                𝖆𝖑𝖘𝖆𝖙
              </span>
            </button>
          </div>

          {/* SADECE GİRİŞ YAPILDIKTAN SONRA GÖRÜNEN MM2 VE ADOPT ME! KATEGORİLERİ */}
          {currentUser ? (
            <nav className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900/90 p-1 sm:p-1.5 rounded-2xl border border-zinc-700/80 shadow-[0_0_25px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-x-auto no-scrollbar">
              {/* 1. MM2 Butonu */}
              <button
                onClick={() => onSelectGame('MM2')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-black rounded-xl flex items-center gap-1.5 sm:gap-2.5 transition-all duration-200 cursor-pointer shrink-0 ${
                  selectedGame === 'MM2'
                    ? 'bg-gradient-to-r from-rose-950 via-rose-900/80 to-zinc-950 text-rose-100 border border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.45)] ring-1 ring-rose-400 scale-[1.03]'
                    : 'text-zinc-400 hover:text-rose-300 border border-transparent hover:border-rose-900/50 hover:bg-rose-950/20'
                }`}
              >
                <span className="font-['Orbitron'] font-black tracking-wider text-[10px] sm:text-[11px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                  MM2
                </span>
                <span className="font-['Rajdhani'] font-bold text-xs sm:text-sm tracking-wide">
                  Murder Mystery 2
                </span>
                <span
                  className={`text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-mono font-bold transition-colors ${
                    selectedGame === 'MM2'
                      ? 'bg-rose-950 text-rose-200 border border-rose-500/40'
                      : 'bg-zinc-950/80 text-zinc-400'
                  }`}
                >
                  {mm2Count}
                </span>
              </button>

              {/* 2. Adopt Me! Butonu */}
              <button
                onClick={() => onSelectGame('Adopt Me!')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-black rounded-xl flex items-center gap-1.5 sm:gap-2.5 transition-all duration-200 cursor-pointer shrink-0 ${
                  selectedGame === 'Adopt Me!'
                    ? 'bg-gradient-to-r from-emerald-950 via-emerald-900/80 to-zinc-950 text-emerald-100 border border-emerald-500 shadow-[0_0_22px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400 scale-[1.03]'
                    : 'text-zinc-400 hover:text-emerald-300 border border-transparent hover:border-emerald-900/50 hover:bg-emerald-950/20'
                }`}
              >
                <span className="font-['Orbitron'] font-black tracking-wider text-[10px] sm:text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  PETS
                </span>
                <span className="font-['Rajdhani'] font-bold text-xs sm:text-sm tracking-wide">
                  Adopt Me!
                </span>
                <span
                  className={`text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-mono font-bold transition-colors ${
                    selectedGame === 'Adopt Me!'
                      ? 'bg-emerald-950 text-emerald-200 border border-emerald-500/40'
                      : 'bg-zinc-950/80 text-zinc-400'
                  }`}
                >
                  {adoptMeCount}
                </span>
              </button>
            </nav>
          ) : null}

          {/* Sağ Aksiyon Alanı */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* İlan Ver Butonu: Tıklanınca Animasyonlu Pop & Pulse */}
            <button
              data-testid="navbar-create-listing-btn"
              onClick={handleCreateClick}
              disabled={isLoggingOut}
              className={`px-4 py-2 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                !allowNewListings && !currentUser?.isAdmin && currentUser?.username !== '1231321323'
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/80 shadow-none hover:bg-zinc-750'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
              } ${isBtnAnimating ? 'scale-110 ring-4 ring-purple-400/50 brightness-125' : 'hover:scale-[1.02]'}`}
            >
              {!allowNewListings && !currentUser?.isAdmin && currentUser?.username !== '1231321323' ? (
                <>
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>İlan Verme Askıda</span>
                </>
              ) : (
                <>
                  <PlusCircle className={`w-4 h-4 text-purple-200 ${isBtnAnimating ? 'animate-spin' : ''}`} />
                  <span>İlan Ver</span>
                </>
              )}
            </button>

            {/* Kullanıcı Giriş Durumu */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-inner">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-white leading-tight">
                      {currentUser.username}
                    </div>
                    <div className="text-[10px] text-indigo-300 font-mono leading-tight">
                      {currentUser.discordTag || currentUser.username}
                    </div>
                  </div>
                </div>

                {/* Admin Butonu (Sadece 1231321323 veya Admin Yetkisi Olanlar Görür) */}
                {(currentUser.isAdmin || currentUser.username === '1231321323') && onOpenAdmin && (
                  <button
                    onClick={onOpenAdmin}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                      isAdminView
                        ? 'bg-rose-950 text-rose-200 border border-rose-500 shadow-rose-900/30 ring-1 ring-rose-400'
                        : 'bg-zinc-900/90 text-rose-300 hover:text-white border border-rose-500/40 hover:bg-rose-950/40'
                    }`}
                    title="Yönetim Konsolunu Aç"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Admin Paneli</span>
                  </button>
                )}

                {/* Çıkış Yap Butonu */}
                <button
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-semibold"
                  title="Oturumu Kapat"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] text-zinc-400">Çıkılıyor...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline text-[11px]">Çıkış</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                disabled={isLoggingOut}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>Giriş Yap</span>
              </button>
            )}
          </div>

        </div>

        {/* Mobil Oyun Seçimi: Sadece giriş yapıldığında görünür */}
        {currentUser ? (
          <div className="md:hidden flex items-center gap-2 pb-3 overflow-x-auto text-xs no-scrollbar justify-center">
            <button
              onClick={() => onSelectGame('MM2')}
              className={`px-3.5 py-1.5 rounded-xl shrink-0 font-bold flex items-center gap-2 transition-all cursor-pointer ${
                selectedGame === 'MM2'
                  ? 'bg-gradient-to-r from-rose-950 to-zinc-900 text-rose-200 border border-rose-500 shadow-md ring-1 ring-rose-400'
                  : 'text-zinc-400 bg-zinc-900/90 border border-zinc-800 hover:text-rose-300'
              }`}
            >
              <span className="font-['Orbitron'] font-black text-[10px] text-rose-400">MM2</span>
              <span>({mm2Count})</span>
            </button>
            <button
              onClick={() => onSelectGame('Adopt Me!')}
              className={`px-3.5 py-1.5 rounded-xl shrink-0 font-bold flex items-center gap-2 transition-all cursor-pointer ${
                selectedGame === 'Adopt Me!'
                  ? 'bg-gradient-to-r from-emerald-950 to-zinc-900 text-emerald-200 border border-emerald-500 shadow-md ring-1 ring-emerald-400'
                  : 'text-zinc-400 bg-zinc-900/90 border border-zinc-800 hover:text-emerald-300'
              }`}
            >
              <span className="font-['Orbitron'] font-black text-[10px] text-emerald-400">ADOPT ME</span>
              <span>({adoptMeCount})</span>
            </button>
          </div>
        ) : null}

      </div>
    </header>
  );
};
