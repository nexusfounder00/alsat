import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  Sparkles,
} from 'lucide-react';
import { AuthResponse } from '../types/auth';
import { validateUsername } from '../utils/validation';

interface LandingPortalProps {
  onAuthSuccess: (data: AuthResponse) => void;
}

export const LandingPortal: React.FC<LandingPortalProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Canlı Doğrulama (Maksimum 10 karakter, etiket kesinlikle yok)
  const nameValidation = validateUsername(name);
  const isNameValid = nameValidation.isValid;
  const isPasswordValid = password.length >= 6;
  const isPasswordConfirmValid =
    passwordConfirm.length >= 6 && password === passwordConfirm;

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMsg(null);
    setPasswordConfirm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();

    // Discord İsmi Doğrulama (Maks 10 harf, kesinlikle etiket yok)
    const nameCheck = validateUsername(cleanName);
    if (!nameCheck.isValid) {
      setErrorMsg(nameCheck.error || 'Discord ismi en fazla 10 karakter olmalıdır (Örn: oyuncu).');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Şifre alanı zorunludur ve en az 6 karakter olmalıdır.');
      return;
    }

    if (mode === 'register') {
      if (!passwordConfirm) {
        setErrorMsg('Lütfen şifrenizi tekrar girerek onaylayın.');
        return;
      }
      if (password !== passwordConfirm) {
        setErrorMsg('Girdiğiniz şifreler uyuşmuyor.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? {
              name: cleanName,
              password,
              passwordConfirm,
            }
          : {
              name: cleanName,
              password,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'İşlem gerçekleştirilemedi.');
      }

      onAuthSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full flex flex-col items-center justify-center text-center">
      
      {/* Üst Karşılama Başlığı & 𝖆𝖑𝖘𝖆𝖙 Logosu */}
      <div className="space-y-4 mb-8 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold tracking-wider shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>ROBLOX TİCARET &amp; İLAN TERMİNALİ</span>
        </div>

        <div>
          <span className="text-5xl sm:text-7xl font-normal tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-zinc-100 to-indigo-200 select-none drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            𝖆𝖑𝖘𝖆𝖙
          </span>
        </div>

        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-medium">
          Roblox pazar ağına katılmak ve ilanları incelemek için Discord isminizle doğrudan giriş yapın.
        </p>
      </div>

      {/* Şık Giriş & Kayıt Terminal Kartı */}
      <div className="w-full max-w-md relative">
        <div className="relative rounded-3xl bg-zinc-900/90 border border-zinc-700/80 shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-6 sm:p-8 overflow-hidden text-left">
          
          {/* Arka plan süzülen neon rengi */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Terminal Başlığı & Mod Butonları */}
          <div className="relative z-10 pb-4 mb-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">
                  {mode === 'login' ? 'Giriş Terminali' : 'Hesap Oluştur'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {mode === 'login'
                    ? 'Discord isminiz ve şifrenizle giriş yapın.'
                    : 'Discord isminizle tek adımda hızlıca kayıt olun (etiketsiz).'}
                </p>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Giriş / Kayıt Tab Butonları */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl mt-4 border border-zinc-800">
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('register')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Kayıt Ol
              </button>
            </div>
          </div>

          {/* Hata Bildirimi */}
          {errorMsg && (
            <div className="p-3 mb-4 bg-red-950/80 border border-red-500/50 text-red-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form: Sadece Discord İsmi (Maks 10 harf) ve Şifre ile Çalışır */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs relative z-10">
            
            {/* 1. Discord İsmi (Kesinlikle etiket yok, maks 10 karakter) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-zinc-300">
                  Discord İsmi <span className="text-purple-400">*</span>
                </label>
                {name.trim() && (
                  <span
                    className={`text-[10px] font-medium flex items-center gap-1 ${
                      isNameValid ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isNameValid ? <Check className="w-3 h-3" /> : 'Maksimum 10 harf'}
                  </span>
                )}
              </div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Discord isminiz (maks. 10 harf)"
                  className={`w-full bg-zinc-950 border rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                    name.trim() && !isNameValid
                      ? 'border-amber-500/80 focus:border-amber-400'
                      : name.trim() && isNameValid
                      ? 'border-emerald-500/80 focus:border-emerald-400'
                      : 'border-zinc-700 focus:border-purple-500'
                  }`}
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                {name.trim() && !isNameValid
                  ? nameValidation.error || 'Maks. 10 harf, kesinlikle etiket (#) yok'
                  : 'Maksimum 10 harf (etiketsiz, sadece Discord ismi)'}
              </p>
            </div>

            {/* 2. Şifre */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-zinc-300">
                  Şifre <span className="text-purple-400">*</span>
                </label>
                {password && (
                  <span
                    className={`text-[10px] font-medium flex items-center gap-1 ${
                      isPasswordValid ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isPasswordValid ? <Check className="w-3 h-3" /> : `${password.length}/6 karakter`}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  minLength={6}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 3. Şifre Tekrarı (Sadece Kayıt Modunda) */}
            {mode === 'register' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-300">
                    Şifre Tekrarı <span className="text-purple-400">*</span>
                  </label>
                  {passwordConfirm && (
                    <span
                      className={`text-[10px] font-medium flex items-center gap-1 ${
                        isPasswordConfirmValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPasswordConfirmValid ? <Check className="w-3 h-3" /> : 'Eşleşmiyor'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Şifrenizi tekrar girin"
                    minLength={6}
                    className={`w-full bg-zinc-950 border rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                      passwordConfirm && !isPasswordConfirmValid
                        ? 'border-rose-500/80 focus:border-rose-400'
                        : passwordConfirm && isPasswordConfirmValid
                        ? 'border-emerald-500/80 focus:border-emerald-400'
                        : 'border-zinc-700 focus:border-purple-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Gönder Butonu */}
            <button
              type="submit"
              disabled={
                isLoading ||
                !isNameValid ||
                !isPasswordValid ||
                (mode === 'register' && !isPasswordConfirmValid)
              }
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Giriş Yap ve Pazara Gir' : 'Hesabı Oluştur ve Giriş Yap'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
};
