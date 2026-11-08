import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { User, AuthResponse } from './src/types/auth';
import { Listing } from './src/types/listing';
import {
  USERNAME_REGEX,
  validateUsername,
  validatePassword,
  validatePasswordConfirm,
  validateDiscordTag,
  validateListingInput,
  calculateRemainingCooldown,
} from './src/utils/validation';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// JSON ve URLencoded yük limiti (Yüklenen fotoğrafların Base64 olarak sunucuya aktarılabilmesi için 15MB)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Uploads ve Data klasörleri
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==========================================
// KALICI VERİ DEPOLAMA (PERSISTENT STORAGE)
// ==========================================
// Sunucu kapansa veya yeniden başlasa dahi kullanıcı hesapları ve ilanlar asla kaybolmaz.
const STORE_FILE = path.join(dataDir, 'alsat_store.json');
const SECRET_FILE = path.join(dataDir, 'session_secret.key');

// Deterministik oturum imzalama anahtarı (Kalıcı olarak dosyada saklanır)
let sessionSecret = 'alsat_secure_session_token_key_2026';
if (fs.existsSync(SECRET_FILE)) {
  try {
    sessionSecret = fs.readFileSync(SECRET_FILE, 'utf8').trim() || sessionSecret;
  } catch {
    // fallback
  }
} else {
  try {
    fs.writeFileSync(SECRET_FILE, sessionSecret, 'utf8');
  } catch {
    // fallback
  }
}

interface StoredUser extends User {
  passwordHash: string;
}

export interface SystemSettings {
  allowNewListings: boolean;
  marketplaceMaintenance: boolean;
  allowImageUploads: boolean;
  listingCooldownSeconds: number;
  preventDuplicateTitles: boolean;
  globalAnnouncement: string;
}

interface StoreData {
  users: StoredUser[];
  listings: Listing[];
  revokedTokens: string[];
  systemSettings?: Partial<SystemSettings>;
}

let usersDb: StoredUser[] = [];
let listingsDb: Listing[] = [];
const revokedTokensSet = new Set<string>();

let systemSettings: SystemSettings = {
  allowNewListings: true,
  marketplaceMaintenance: false,
  allowImageUploads: true,
  listingCooldownSeconds: 60,
  preventDuplicateTitles: true,
  globalAnnouncement: 'Alsat Roblox İlan Pazarı’na hoş geldiniz! Güvenli takas yapınız.',
};

// Veritabanını diskten yükle
function loadStore() {
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      if (raw && raw.trim().length > 0) {
        const data: StoreData = JSON.parse(raw);
        usersDb = Array.isArray(data.users) ? data.users : [];
        listingsDb = Array.isArray(data.listings) ? data.listings : [];
        if (Array.isArray(data.revokedTokens)) {
          data.revokedTokens.forEach((t) => revokedTokensSet.add(t));
        }
        if (data.systemSettings && typeof data.systemSettings === 'object') {
          systemSettings = { ...systemSettings, ...data.systemSettings };
        }
        console.log(`[Depo] ${usersDb.length} kullanıcı ve ${listingsDb.length} ilan yüklendi.`);
      }
    } catch (err) {
      console.error('[Depo Yükleme Hatası]:', err);
    }
  }

  // Vitrinde başlangıçta zengin içerik olması için varsayılan örnek ilanlar
  if (listingsDb.length === 0) {
    const seedTime = new Date().toISOString();
    listingsDb = [
      {
        id: 'list_seed_1',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'Adopt Me!',
        title: 'FR Shadow Dragon - Full Grown Fly Ride',
        description: 'Temiz takas arıyorum. Full grown fly ve ride shadow dragon. Güvenli aracılık ile teslim edilir.',
        offeredItemsText: '1x FR Shadow Dragon (Full Grown)',
        lookingForText: 'Bat Dragon + Frost Dragon veya denk high-tier pets',
        imageUrl: '/assets/adoptme/shadow-dragon.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_2',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'MM2',
        title: 'Harvester Gun - Godly / Ancient',
        description: 'En popüler MM2 silahlarından Harvester. Discord üzerinden doğrudan yazabilirsiniz.',
        offeredItemsText: '1x Harvester Gun (Ancient)',
        lookingForText: 'Corrupt Set + Icebreaker veya teklif',
        imageUrl: '/assets/mm2/harvester.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_3',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'Adopt Me!',
        title: 'Bat Dragon - Fly Ride (FR)',
        description: 'Tertemiz Bat Dragon. Hızlı yanıt için Discord hesabımdan iletişime geçebilirsiniz.',
        offeredItemsText: '1x Bat Dragon Fly Ride',
        lookingForText: 'Giraffe + Mega Turtle veya dengi teklifler',
        imageUrl: '/assets/adoptme/bat-dragon.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_4',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'MM2',
        title: 'Corrupt Knife - Ultra Rare Collectible',
        description: 'MM2 pazarının en nadir ve değerli bıçaklarından biri olan Corrupt.',
        offeredItemsText: '1x Corrupt Knife',
        lookingForText: 'High value godly teklifleri veya Harvester + adds',
        imageUrl: '/assets/mm2/corrupt.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_5',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'Adopt Me!',
        title: 'Mega Neon Frost Dragon - MFR',
        description: 'MFR Frost Dragon. Çok nadir, sadece ciddi alıcılar ve güvenli takas.',
        offeredItemsText: '1x MFR Mega Frost Dragon',
        lookingForText: 'High-tier mega petler veya eşdeğer koleksiyon',
        imageUrl: '/assets/adoptme/frost-dragon.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_6',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'MM2',
        title: 'Icebreaker & Iceblaster Set',
        description: 'Buz seti eksiksiz ve temiz. Discord üzerinden ekleyip teklif iletebilirsiniz.',
        offeredItemsText: '1x Icebreaker Knife + 1x Iceblaster Gun',
        lookingForText: 'Candy Set veya Chroma Luger + adds',
        imageUrl: '/assets/mm2/icebreaker.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_7',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'Adopt Me!',
        title: 'Mega Neon Turtle - MFR',
        description: 'Işıltılı Mega Neon Turtle. Takasa açık, DM atınız.',
        offeredItemsText: '1x MFR Turtle',
        lookingForText: 'Crow / Evil Unicorn + adds',
        imageUrl: '/assets/adoptme/mega-turtle.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
      {
        id: 'list_seed_8',
        ownerId: 'usr_admin_1231321323',
        ownerUsername: '1231321323',
        ownerDiscordTag: '1231321323',
        game: 'MM2',
        title: 'Heartblade Knife - Pink Glow',
        description: 'Çok popüler pembe efektli Heartblade. Temiz ve hızlı takas.',
        offeredItemsText: '1x Heartblade Godly Knife',
        lookingForText: 'Batwing veya Luger',
        imageUrl: '/assets/mm2/heartblade.png',
        status: 'ACTIVE',
        createdAt: seedTime,
      },
    ];
  }
}

// Veritabanını diske kaydet
function saveStore() {
  try {
    const data: StoreData = {
      users: usersDb,
      listings: listingsDb,
      revokedTokens: Array.from(revokedTokensSet).slice(-500),
      systemSettings,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Depo Kaydetme Hatası]:', err);
  }
}

loadStore();

// ==========================================
// KALICI VE GÜVENLİ TOKEN SİSTEMİ (30 GÜN GEÇERLİ, PERSISTENT SESSION)
// ==========================================
// Rastgele string veya uuid KULLANILMAZ; HMAC-SHA256 imzalı deterministik token kullanılır.
interface TokenPayload {
  uid: string;
  u: string;
  d: string;
  exp: number;
}

function createAuthToken(user: StoredUser): string {
  const payload: TokenPayload = {
    uid: user.id,
    u: user.username,
    d: user.discordTag,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 gün boyunca geçerli
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifyAuthToken(token: string): StoredUser | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  if (revokedTokensSet.has(token)) return null;

  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('base64url');
  if (signature !== expectedSignature) return null;

  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.uid || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return usersDb.find((u) => u.id === payload.uid) || null;
  } catch {
    return null;
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_alsat_roblox_market_2026').digest('hex');
}

// ------------------------------------------
// ÖZEL ADMİN HESABI TANIMLAMA (1231321323 / 1231321323)
// ------------------------------------------
function ensureAdminUser() {
  const adminNick = '1231321323';
  const adminPass = '1231321323';
  const existing = usersDb.find(
    (u) =>
      u.username.toLowerCase() === adminNick.toLowerCase() ||
      u.discordTag.toLowerCase() === adminNick.toLowerCase()
  );

  if (!existing) {
    const adminUser: StoredUser = {
      id: `usr_admin_${adminNick}`,
      username: adminNick,
      discordTag: adminNick,
      passwordHash: hashPassword(adminPass),
      role: 'ADMIN',
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };
    usersDb.unshift(adminUser);
    saveStore();
    console.log(`[Admin] Özel admin hesabı (${adminNick}) başarıyla oluşturuldu.`);
  } else {
    existing.role = 'ADMIN';
    existing.isAdmin = true;
    existing.passwordHash = hashPassword(adminPass);
    saveStore();
    console.log(`[Admin] Özel admin hesabı (${adminNick}) yetkileri ve şifresi senkronize edildi.`);
  }
}
ensureAdminUser();

// ==========================================
// SİBER GÜVENLİK & GERÇEK ROBOT DOĞRULAMASI STATE
// ==========================================
interface CaptchaChallenge {
  id: string;
  type: 'math' | 'code';
  code: string;
  mathPrompt?: string;
  solution: string;
  seed: number;
  createdAt: number;
}

const activeChallenges = new Map<string, CaptchaChallenge>();

interface SecurityLog {
  id: string;
  timestamp: string;
  action: 'CHALLENGE_CREATED' | 'CHALLENGE_PASSED' | 'CHALLENGE_FAILED';
  ip: string;
  details: string;
}
const securityLogs: SecurityLog[] = [];
let totalCaptchaPassed = 0;
let totalCaptchaFailed = 0;

function addSecurityLog(action: 'CHALLENGE_CREATED' | 'CHALLENGE_PASSED' | 'CHALLENGE_FAILED', req: express.Request, details: string) {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  securityLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    ip: ip.split(',')[0].trim(),
    details,
  });
  if (securityLogs.length > 100) securityLogs.pop();
}

let globalAnnouncement: string = 'Alsat Roblox İlan Pazarı’na hoş geldiniz! Güvenli takas yapınız.';

// Anti-Spam Rate Limit Haritası: userId -> son ilan ekleme timestamp'i
const listingRateLimitMap = new Map<string, number>();
const LISTING_COOLDOWN_MS = 60 * 1000; // Kullanıcı başına dakikada en fazla 1 ilan

function getAuthUser(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  return verifyAuthToken(token);
}

// ==========================================
// ARKA PLAN DISCORD WEBHOOK GÖNDERİCİ
// ==========================================
// Sitede hiçbir metin olarak görünmez, sadece arka planda yeni ilan oluşunca tetiklenir.
const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ||
  'https://discord.com/api/webhooks/1568320481369530518/tUXZnP8axZaVSIukU_Dmh2FFqg3EG7P1sC6UfJ8JEf5KtivP738rBHAIwg630TUxDZib';

async function sendDiscordWebhookWithImage(options: {
  content?: string;
  embed: any;
  fileBuffer?: Buffer;
  fileName?: string;
}): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    let bodyData: any;
    let headers: Record<string, string> = {};

    if (options.fileBuffer && options.fileName) {
      // Discord Webhook Multipart Form-Data (Görsel dosyası ekleme)
      const boundary = '----AlsatBoundary' + Date.now();
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;

      const payloadJson = JSON.stringify({
        content: options.content,
        embeds: [options.embed],
      });

      const preJson = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${payloadJson}\r\n`;
      const preFile = `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${options.fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`;
      const postFile = `\r\n--${boundary}--\r\n`;

      bodyData = Buffer.concat([
        Buffer.from(preJson, 'utf8'),
        Buffer.from(preFile, 'utf8'),
        options.fileBuffer,
        Buffer.from(postFile, 'utf8'),
      ]);
    } else {
      headers['Content-Type'] = 'application/json';
      bodyData = JSON.stringify({
        content: options.content,
        embeds: [options.embed],
      });
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: bodyData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Discord Webhook Hatası HTTP ${response.status}]:`, errText);
      return { success: false, status: response.status, error: errText };
    }

    console.log(`[Discord Webhook] Başarıyla iletildi (HTTP ${response.status})`);
    return { success: true, status: response.status };
  } catch (err: any) {
    console.error('[Discord Webhook İstisnası]:', err.message || err);
    return { success: false, error: err.message || 'Ağ bağlantı hatası' };
  }
}

// ==========================================
// REST API ROTALARI
// ==========================================

// Sağlık kontrolü
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Alsat - Roblox Adopt Me! & MM2 İlan Pazarı',
    totalUsers: usersDb.length,
    totalListings: listingsDb.length,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { password, passwordConfirm } = req.body;
  const rawName = (req.body.name || req.body.username || req.body.discordTag || '').toString().trim();

  // 1. İsim Doğrulaması: Kesinlikle etiket (#) yok, maksimum 10 karakter
  const nameCheck = validateUsername(rawName);
  if (!nameCheck.isValid) {
    return res.status(400).json({ error: nameCheck.error });
  }
  const cleanName = rawName.replace(/^@/, '');

  // 2. Şifre Kriteri: En az 6 karakter
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  // 2.1 Şifre Tekrarı Kontrolü
  if (passwordConfirm !== undefined && password !== passwordConfirm) {
    return res.status(400).json({ error: 'Girdiğiniz şifreler birbiriyle eşleşmiyor.' });
  }

  // Benzersiz isim kontrolü
  const existingUser = usersDb.find(
    (u) =>
      u.username.toLowerCase() === cleanName.toLowerCase() ||
      u.discordTag.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingUser) {
    return res.status(400).json({
      error: 'Bu Discord ismiyle kayıtlı bir hesap zaten var. Lütfen başka bir Discord ismi seçin veya giriş yapın.',
    });
  }

  // Deterministik Kullanıcı ID
  const userId = `usr_${cleanName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

  const newUser: StoredUser = {
    id: userId,
    username: cleanName,
    passwordHash: hashPassword(password),
    discordTag: cleanName,
    createdAt: new Date().toISOString(),
  };

  usersDb.unshift(newUser);
  saveStore();

  const token = createAuthToken(newUser);
  const { passwordHash, ...safeUser } = newUser;

  res.status(201).json({
    success: true,
    user: safeUser,
    token,
  });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = (req.body.name || req.body.username || req.body.discordTag || req.body.identifier || '').toString().trim();
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Lütfen Discord isminizi ve şifrenizi girin.' });
  }

  const user = usersDb.find(
    (u) =>
      u.username.toLowerCase() === identifier.toLowerCase() ||
      u.discordTag.toLowerCase() === identifier.toLowerCase()
  );

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Hatalı Discord ismi veya şifre.' });
  }

  if (user.isBanned) {
    return res.status(403).json({ error: 'Bu Discord hesabı yönetici tarafından askıya alınmıştır.' });
  }

  const token = createAuthToken(user);
  const { passwordHash, ...safeUser } = user;

  res.json({
    success: true,
    user: safeUser,
    token,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    revokedTokensSet.add(token);
    saveStore();
  }
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Oturum bulunamadı veya süresi doldu.' });
  }
  if (user.isBanned) {
    return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.' });
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ------------------------------------------
// İLAN PAZARI (MARKETPLACE) VE ANTH-SPAM SİSTEMİ
// ------------------------------------------

// İlanları listeleme (Oyun ve arama filtresi)
app.get('/api/listings', (req, res) => {
  const { game, search } = req.query;

  let results = [...listingsDb];

  if (game && (game === 'MM2' || game === 'Adopt Me!')) {
    results = results.filter((l) => l.game === game);
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.ownerUsername.toLowerCase().includes(q) ||
        l.ownerDiscordTag.toLowerCase().includes(q) ||
        l.offeredItemsText.toLowerCase().includes(q) ||
        l.lookingForText.toLowerCase().includes(q)
    );
  }

  res.json({ listings: results, count: results.length });
});

// Tekil ilan getirme
app.get('/api/listings/:id', (req, res) => {
  const listing = listingsDb.find((l) => l.id === req.params.id);
  if (!listing) {
    return res.status(404).json({ error: 'İlan bulunamadı.' });
  }
  res.json({ listing });
});

// YENİ İLAN YAYINLAMA (CİHAZDAN FOTOĞRAF YÜKLEME & ARKA PLAN DISCORD WEBHOOK)
app.post('/api/listings', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'İlan verebilmek için giriş yapmalısınız.' });
  }

  // 0. YASAKLI KULLANICI KONTROLÜ
  if (user.isBanned) {
    return res.status(403).json({ error: 'Hesabınız yönetici tarafından yasaklandığı için yeni ilan oluşturamazsınız.' });
  }

  // 1. İLAN VERME İZNİ & BAKIM MODU KONTROLÜ
  const isSuperAdmin = user.isAdmin || user.username === '1231321323';
  if (!systemSettings.allowNewListings && !isSuperAdmin) {
    return res.status(403).json({ error: 'İlan verme işlemleri şu anda yönetici tarafından geçici olarak durdurulmuştur.' });
  }
  if (systemSettings.marketplaceMaintenance && !isSuperAdmin) {
    return res.status(503).json({ error: 'Pazar yeri şu anda planlı bakım modundadır. İlan verilemez.' });
  }

  // 2. KATI ANTI-SPAM & COOLDOWN KORUMASI
  const now = Date.now();
  const lastListingTime = listingRateLimitMap.get(user.id) || 0;
  const cooldownSec = typeof systemSettings.listingCooldownSeconds === 'number' ? systemSettings.listingCooldownSeconds : 60;
  const cooldownMs = cooldownSec * 1000;

  if (!isSuperAdmin && cooldownMs > 0) {
    const remainingCooldown = calculateRemainingCooldown(lastListingTime, now, cooldownMs);
    if (remainingCooldown > 0) {
      return res.status(429).json({
        error: `Spam koruması aktif! Yeni bir ilan vermeden önce lütfen ${remainingCooldown} saniye bekleyin.`,
        remainingSeconds: remainingCooldown,
      });
    }
  }

  const { game, title, description, offeredItemsText, lookingForText, imageBase64 } = req.body;

  // Görsel yükleme izni kontrolü
  if (!systemSettings.allowImageUploads && imageBase64 && !isSuperAdmin) {
    return res.status(400).json({ error: 'Görsel yükleme özelliği yönetici tarafından geçici olarak durdurulmuştur.' });
  }

  // Girdi doğrulamaları
  const validation = validateListingInput({ game, title, description, offeredItemsText, lookingForText });
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  // 3. KOPYA İLAN KONTROLÜ (Aynı kullanıcının aynı başlıkta aktif ilanı var mı?)
  if (systemSettings.preventDuplicateTitles) {
    const normalizedTitle = (title as string).trim().replace(/\s+/g, ' ').toLowerCase();
    const isDuplicate = listingsDb.some(
      (l) =>
        l.ownerId === user.id &&
        l.status === 'ACTIVE' &&
        l.title.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTitle
    );
    if (isDuplicate) {
      return res.status(400).json({
        error: 'Zaten bu başlığa sahip aktif bir ilanınız bulunuyor. Lütfen farklı veya daha açıklayıcı bir başlık belirleyin.',
      });
    }
  }

  // Deterministik İlan ID'si
  const listingId = `LIST-${Date.now()}`;
  const isoTime = new Date().toISOString();

  // Dosyadan yüklenen Base64 görseli sunucuya kaydetme
  let savedImageUrl: string | undefined = undefined;
  let fileBuffer: Buffer | undefined = undefined;
  let uploadFileName: string | undefined = undefined;

  if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.includes('base64,')) {
    try {
      const parts = imageBase64.split(';base64,');
      const mime = parts[0].replace('data:', '');
      const rawData = parts[1];
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

      uploadFileName = `${listingId}.${ext}`;
      const filePath = path.join(uploadsDir, uploadFileName);
      fileBuffer = Buffer.from(rawData, 'base64');
      fs.writeFileSync(filePath, fileBuffer);

      savedImageUrl = `/uploads/${uploadFileName}`;
    } catch (err) {
      console.error('[Upload Parse Error]:', err);
    }
  }

  const newListing: Listing = {
    id: listingId,
    ownerId: user.id,
    ownerUsername: user.username,
    ownerDiscordTag: user.discordTag,
    game,
    title: (title as string).trim(),
    description: (description as string).trim(),
    offeredItemsText: (offeredItemsText as string).trim(),
    lookingForText: (lookingForText as string).trim(),
    imageUrl: savedImageUrl,
    status: 'ACTIVE',
    createdAt: isoTime,
  };

  listingsDb.unshift(newListing);
  listingRateLimitMap.set(user.id, now);
  saveStore();

  // 3. ARKA PLANDA DISCORD WEBHOOK GÖNDERİMİ (Sitede hiçbir metin olarak görünmez)
  const webhookEmbed: any = {
    title: `📢 YENİ İLAN YAYINLANDI! [${game}]`,
    description: `**${newListing.title}**\n\n${newListing.description}`,
    color: game === 'MM2' ? 0xe11d48 : 0x10b981,
    fields: [
      {
        name: '👤 İlan Sahibi',
        value: `**${user.username}**`,
        inline: true,
      },
      {
        name: '💬 Discord İletişim',
        value: `\`${user.discordTag}\``,
        inline: true,
      },
      {
        name: '🎮 Oyun',
        value: game,
        inline: true,
      },
      {
        name: '🎁 Verdiği / Sunduğu',
        value: newListing.offeredItemsText,
        inline: false,
      },
      {
        name: '🎯 Aradığı / İstediği',
        value: newListing.lookingForText,
        inline: false,
      },
    ],
    footer: {
      text: 'Alsat İlan Pazarı • Discord Üzerinden İletişim',
    },
    timestamp: isoTime,
  };

  if (fileBuffer && uploadFileName) {
    webhookEmbed.image = { url: `attachment://${uploadFileName}` };
  }

  sendDiscordWebhookWithImage({
    content: `📢 **Yeni İlan Yayınlandı!** [${game}] - İlan Sahibi: **${user.username}** (Discord: \`${user.discordTag}\`)`,
    embed: webhookEmbed,
    fileBuffer,
    fileName: uploadFileName,
  }).catch((err) => console.error('[Listing Webhook Error]:', err));

  res.status(201).json({
    success: true,
    listing: newListing,
    message: 'İlanınız başarıyla vitrinde yayınlandı!',
  });
});

// ==========================================
// GERÇEK ROBOT DOĞRULAMASI (CAPTCHA API)
// ==========================================

// 1. Yeni meydan okuma oluştur
app.get('/api/security/captcha/challenge', (req, res) => {
  const challengeId = `ch_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  const types: ('code' | 'math')[] = ['code', 'math'];
  const type = types[Math.floor(Math.random() * types.length)];
  const seed = Math.floor(Math.random() * 900000) + 100000;

  let code = '';
  let solution = '';
  let mathPrompt = '';

  if (type === 'math') {
    const n1 = Math.floor(Math.random() * 25) + 8;
    const n2 = Math.floor(Math.random() * 20) + 4;
    const isAdd = Math.random() > 0.35;
    if (isAdd) {
      mathPrompt = `${n1} + ${n2} = ?`;
      solution = (n1 + n2).toString();
    } else {
      mathPrompt = `${n1 + n2} - ${n2} = ?`;
      solution = n1.toString();
    }
    code = mathPrompt;
  } else {
    // Okunabilir 5 karakterli anti-bot kodu
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    solution = code;
  }

  activeChallenges.set(challengeId, {
    id: challengeId,
    type,
    code,
    mathPrompt,
    solution,
    seed,
    createdAt: Date.now(),
  });

  addSecurityLog('CHALLENGE_CREATED', req, `Tip: ${type}, Soru: ${code}`);

  res.json({
    challengeId,
    type,
    code,
    mathPrompt,
    seed,
    expiresInSeconds: 300,
  });
});

// 2. Robot doğrulamasını çöz ve onayla
app.post('/api/security/captcha/verify', (req, res) => {
  const { challengeId, answer, humanMetrics } = req.body;

  if (!challengeId || typeof answer !== 'string') {
    return res.status(400).json({ success: false, error: 'Doğrulama parametreleri eksik.' });
  }

  const challenge = activeChallenges.get(challengeId);
  if (!challenge) {
    totalCaptchaFailed++;
    addSecurityLog('CHALLENGE_FAILED', req, 'Geçersiz veya süresi dolmuş challenge.');
    return res.status(400).json({ success: false, error: 'Doğrulama oturumu zaman aşımına uğramış. Yeni kod üretildi.' });
  }

  // Tek kullanımlık güvenlik prensibi: Yeniden denemeleri ve replay saldırılarını engelle
  activeChallenges.delete(challengeId);

  // Süre aşımı (5 dakika)
  if (Date.now() - challenge.createdAt > 5 * 60 * 1000) {
    totalCaptchaFailed++;
    addSecurityLog('CHALLENGE_FAILED', req, 'Süre aşımı (> 5 dk).');
    return res.status(400).json({ success: false, error: 'Süre doldu. Lütfen sayfadaki yeni kodu girin.' });
  }

  // İnsan Telemetrisi: Otomatik scriptlerin anlık (< 300ms) yanıtlarını engelle
  if (humanMetrics && typeof humanMetrics.durationMs === 'number' && humanMetrics.durationMs < 300) {
    totalCaptchaFailed++;
    addSecurityLog('CHALLENGE_FAILED', req, `Bot şüphesi: ${humanMetrics.durationMs}ms sürede yanıtlandı.`);
    return res.status(400).json({ success: false, error: 'Otomatik robot davranışı algılandı. Lütfen normal hızda yanıtlayın.' });
  }

  const cleanAns = answer.trim().toUpperCase();
  const cleanExpected = challenge.solution.trim().toUpperCase();

  if (cleanAns !== cleanExpected) {
    totalCaptchaFailed++;
    addSecurityLog('CHALLENGE_FAILED', req, `Hatalı yanıt: "${cleanAns}" (Beklenen: "${cleanExpected}")`);
    return res.status(400).json({ success: false, error: 'Güvenlik kodu hatalı. Lütfen yeni kodu dikkatlice girin.' });
  }

  totalCaptchaPassed++;
  addSecurityLog('CHALLENGE_PASSED', req, `İnsan doğrulaması onaylandı (${humanMetrics?.durationMs || 0}ms)`);

  const captchaToken = `cap_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
  res.json({
    success: true,
    token: captchaToken,
    message: 'Robot doğrulaması başarıyla tamamlandı.',
  });
});

// ==========================================
// TAM TAKIR ADMİN PANELİ ROTALARI
// ==========================================

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Oturum açmanız gerekmektedir.' });
  }
  const isAdm = user.isAdmin || user.role === 'ADMIN' || user.username === '1231321323';
  if (!isAdm) {
    return res.status(403).json({ error: 'Yetkisiz erişim. Bu alan sadece yöneticilere özeldir.' });
  }
  (req as any).adminUser = user;
  next();
}

// 1. Admin Genel Bakış & Sistem Metrikleri
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const mm2Count = listingsDb.filter((l) => l.game === 'MM2').length;
  const adoptMeCount = listingsDb.filter((l) => l.game === 'Adopt Me!').length;
  const bannedCount = usersDb.filter((u) => u.isBanned).length;

  res.json({
    success: true,
    stats: {
      totalUsers: usersDb.length,
      totalListings: listingsDb.length,
      mm2Count,
      adoptMeCount,
      bannedCount,
      totalCaptchaPassed,
      totalCaptchaFailed,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      allowNewListings: systemSettings.allowNewListings,
      marketplaceMaintenance: systemSettings.marketplaceMaintenance,
      allowImageUploads: systemSettings.allowImageUploads,
    },
    systemSettings,
    announcement: systemSettings.globalAnnouncement,
    securityLogs: securityLogs.slice(0, 50),
    recentListings: listingsDb.slice(0, 10),
    recentUsers: usersDb.map((u) => ({
      id: u.id,
      username: u.username,
      discordTag: u.discordTag,
      role: u.role || (u.username === '1231321323' ? 'ADMIN' : 'USER'),
      isAdmin: Boolean(u.isAdmin || u.username === '1231321323'),
      isBanned: Boolean(u.isBanned),
      banReason: u.banReason,
      createdAt: u.createdAt,
      listingsCount: listingsDb.filter((l) => l.ownerId === u.id).length,
    })).slice(0, 10),
  });
});

// Doğrudan Kullanıcı Adı ile Yasaklama (Manuel Ban Masası)
app.post('/api/admin/users/ban-by-name', requireAdmin, (req, res) => {
  const { username, reason } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Lütfen yasaklanacak Discord kullanıcı adını girin.' });
  }
  const cleanName = username.trim();
  if (cleanName === '1231321323') {
    return res.status(400).json({ error: 'Root admin hesabı yasaklanamaz!' });
  }
  let target = usersDb.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());
  if (!target) {
    target = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanName,
      discordTag: cleanName,
      passwordHash: hashPassword('banned_default_pwd_2026'),
      role: 'USER',
      isAdmin: false,
      isBanned: true,
      banReason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Yönetici tarafından doğrudan kara listeye alındı',
      createdAt: new Date().toISOString(),
    };
    usersDb.push(target);
  } else {
    target.isBanned = true;
    target.banReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Yönetici tarafından yasaklandı';
  }
  saveStore();
  addSecurityLog('CHALLENGE_FAILED', req, `DİREKT YASAKLAMA: @${cleanName} (Sebep: ${target.banReason})`);
  res.json({ success: true, message: `@${cleanName} başarıyla yasaklandı.`, user: target });
});

// 2. Tüm Kullanıcılar Listesi
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const userList = usersDb.map((u) => {
    const userListings = listingsDb.filter((l) => l.ownerId === u.id);
    return {
      id: u.id,
      username: u.username,
      discordTag: u.discordTag,
      role: u.role || (u.username === '1231321323' ? 'ADMIN' : 'USER'),
      isAdmin: Boolean(u.isAdmin || u.username === '1231321323'),
      isBanned: Boolean(u.isBanned),
      banReason: u.banReason,
      createdAt: u.createdAt,
      listingsCount: userListings.length,
    };
  });
  res.json({ success: true, users: userList });
});

// 3. Kullanıcıyı Yasakla / Yasağı Kaldır (Profesyonel Gerekçe Desteği)
app.post('/api/admin/users/:id/toggle-ban', requireAdmin, (req, res) => {
  const targetId = req.params.id;
  const { reason } = req.body || {};
  const user = usersDb.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  if (user.username === '1231321323') {
    return res.status(400).json({ error: 'Ana admin hesabı yasaklanamaz!' });
  }
  user.isBanned = !user.isBanned;
  if (user.isBanned) {
    user.banReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Yönetici tarafından yasaklandı';
    addSecurityLog('CHALLENGE_FAILED', req, `KULLANICI YASAKLANDI: @${user.username} (Sebep: ${user.banReason})`);
  } else {
    delete user.banReason;
    addSecurityLog('CHALLENGE_PASSED', req, `KULLANICI YASAĞI KALDIRILDI: @${user.username}`);
  }
  saveStore();
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      isBanned: user.isBanned,
      banReason: user.banReason,
    },
    message: user.isBanned ? `${user.username} başarıyla yasaklandı.` : `${user.username} kullanıcısının yasağı kaldırıldı.`,
  });
});

// 4. Kullanıcıyı Tamamen Sil (ve ilanlarını temizle)
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const targetId = req.params.id;
  const userIdx = usersDb.findIndex((u) => u.id === targetId);
  if (userIdx === -1) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  if (usersDb[userIdx].username === '1231321323') {
    return res.status(400).json({ error: 'Ana admin hesabı silinemez!' });
  }

  const deletedUsername = usersDb[userIdx].username;
  usersDb.splice(userIdx, 1);
  listingsDb = listingsDb.filter((l) => l.ownerId !== targetId);
  addSecurityLog('CHALLENGE_FAILED', req, `KULLANICI VE İLANLARI SİLİNDİ: @${deletedUsername}`);
  saveStore();

  res.json({ success: true, message: `${deletedUsername} ve tüm ilanları kalıcı olarak silindi.` });
});

// 5. İlanı Kaldır / Sil (Görsel Temizliği ile Birlikte)
app.delete('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const listingId = req.params.id;
  const idx = listingsDb.findIndex((l) => l.id === listingId);
  if (idx === -1) {
    return res.status(404).json({ error: 'İlan bulunamadı.' });
  }
  const deletedListing = listingsDb.splice(idx, 1)[0];
  if (deletedListing.imageUrl && deletedListing.imageUrl.startsWith('/uploads/')) {
    const filename = path.basename(deletedListing.imageUrl);
    const diskPath = path.join(uploadsDir, filename);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch {}
    }
  }
  addSecurityLog('CHALLENGE_FAILED', req, `İLAN SİLİNDİ: "${deletedListing.title}" [${deletedListing.game}] (${deletedListing.ownerUsername})`);
  saveStore();
  res.json({ success: true, message: `"${deletedListing.title}" ilanı kalıcı olarak silindi.` });
});

// 6. Sistem Pazar Ayarları (İlan verme izni, bakım modu, cooldown, spam koruması)
app.get('/api/system/settings', (req, res) => {
  res.json({
    success: true,
    settings: {
      allowNewListings: systemSettings.allowNewListings,
      marketplaceMaintenance: systemSettings.marketplaceMaintenance,
      allowImageUploads: systemSettings.allowImageUploads,
      listingCooldownSeconds: systemSettings.listingCooldownSeconds,
      globalAnnouncement: systemSettings.globalAnnouncement,
    },
  });
});

app.post('/api/admin/system/settings', requireAdmin, (req, res) => {
  const {
    allowNewListings,
    marketplaceMaintenance,
    allowImageUploads,
    listingCooldownSeconds,
    preventDuplicateTitles,
    globalAnnouncement,
  } = req.body;

  if (typeof allowNewListings === 'boolean') systemSettings.allowNewListings = allowNewListings;
  if (typeof marketplaceMaintenance === 'boolean') systemSettings.marketplaceMaintenance = marketplaceMaintenance;
  if (typeof allowImageUploads === 'boolean') systemSettings.allowImageUploads = allowImageUploads;
  if (typeof listingCooldownSeconds === 'number') systemSettings.listingCooldownSeconds = Math.max(0, listingCooldownSeconds);
  if (typeof preventDuplicateTitles === 'boolean') systemSettings.preventDuplicateTitles = preventDuplicateTitles;
  if (typeof globalAnnouncement === 'string') systemSettings.globalAnnouncement = globalAnnouncement.trim();

  saveStore();
  addSecurityLog('CHALLENGE_CREATED' as any, req, `Sistem pazar ayarları güncellendi: İlan İzni=${systemSettings.allowNewListings ? 'Açık' : 'DURDURULDU'}`);

  res.json({
    success: true,
    settings: systemSettings,
    message: 'Pazar ve güvenlik ayarları başarıyla kaydedildi.',
  });
});

// 7. Global Duyuru Metni Ayarlama
app.post('/api/admin/announcement', requireAdmin, (req, res) => {
  const { announcement } = req.body;
  systemSettings.globalAnnouncement = (announcement || '').toString().trim();
  saveStore();
  res.json({ success: true, announcement: systemSettings.globalAnnouncement });
});

// 8. Herkese Açık Duyuru Alma
app.get('/api/announcement', (req, res) => {
  res.json({ announcement: systemSettings.globalAnnouncement });
});

// 8. Discord Webhook Test Bildirimi
app.post('/api/admin/test-webhook', requireAdmin, async (req, res) => {
  const { testMessage } = req.body;
  const result = await sendDiscordWebhookWithImage({
    content: `🛠️ **[ADMİN PANELİ SİSTEM TESTİ]**\n${testMessage || 'Admin panelinden webhook entegrasyonu başarıyla tetiklendi!'}`,
    embed: {
      title: '🛡️ Alsat Admin Paneli • Discord Webhook Testi',
      description: 'Webhook bağlantısı kusursuz şekilde çalışıyor.',
      color: 0x8b5cf6,
      fields: [
        { name: 'Yetkili Admin', value: '1231321323', inline: true },
        { name: 'Sistem Durumu', value: '🟢 Çevrimiçi', inline: true },
        { name: 'Zaman Damgası', value: new Date().toLocaleString('tr-TR'), inline: false },
      ],
      footer: { text: 'Alsat Siber Güvenlik ve Denetim Terminali' },
    },
  });
  if (result.success) {
    res.json({ success: true, message: 'Test bildirimi Discord kanalına iletildi.' });
  } else {
    res.status(500).json({ success: false, error: result.error || 'Discord webhook hatası.' });
  }
});

// Vite & Server Start
async function startServer() {
  // Statik yüklenen dosyalar servisi
  app.use('/uploads', express.static(uploadsDir));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Alsat İlan Pazarı Sunucusu Port ${port} üzerinde hazır!`);
  });
}

startServer();
