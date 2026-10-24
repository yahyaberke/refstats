# RefStats — Hakem İstatistik ve Kariyer Platformu

RefStats, futbol hakemlerinin görev aldıkları maçları, kart kararlarını ve gelişim notlarını kaydettiği; görev türü, kategori ve sezon bazında istatistiklerini, takvimini ve kariyer özetini gördüğü kişisel bir platformdur.

> RefStats bağımsız bir kişisel kayıt aracıdır. Herhangi bir federasyon, il temsilciliği veya resmî atama sistemiyle bağlantısı yoktur; yalnızca kullanıcının kendi girdiği verilerle çalışır.

## İçindekiler

- [Teknoloji yığını](#teknoloji-yığını)
- [Hızlı başlangıç](#hızlı-başlangıç)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Komutlar](#komutlar)
- [Demo verisi ve yönetici hesabı](#demo-verisi-ve-yönetici-hesabı)
- [Testler](#testler)
- [Özellikler](#özellikler)
- [Kart sayım kuralları](#kart-sayım-kuralları)
- [Güvenlik ve gizlilik](#güvenlik-ve-gizlilik)
- [Proje yapısı](#proje-yapısı)
- [Dağıtım (deployment)](#dağıtım-deployment)
- [Bilinen sınırlamalar](#bilinen-sınırlamalar)

## Teknoloji yığını

| Katman | Seçim |
|---|---|
| Arayüz | React 18 + TypeScript + Vite 5, Tailwind CSS 3, Recharts, TanStack Query, React Router, lucide ikonları |
| Sunucu | Node.js 20+ / Express 4 (TypeScript, `tsx` ile çalışır) |
| Veritabanı | PostgreSQL 16 + Prisma 6 (migration'lar `server/prisma/migrations`) |
| Doğrulama | Zod — şemalar `shared/` paketinde, istemci ve sunucu **aynı** kuralları kullanır |
| Kimlik doğrulama | Veritabanında tutulan, iptal edilebilir oturumlar (httpOnly çerez; token'ın yalnızca SHA-256 özeti saklanır), bcrypt parola özeti |
| Test | Vitest + Supertest (gerçek PostgreSQL test veritabanına karşı) |

**Neden JWT değil de veritabanı oturumu?** Oturumlar sunucuda iptal edilebilir: parola değişince diğer cihazlar kapanır, askıya alınan hesap anında düşer, kullanıcı “açık oturumlar” listesinden cihaz kapatabilir.

**Neden `shared/` paketi?** Maç formu kuralları (ör. “ikinci sarı için önce ilk sarı girilmeli”, “gelecek tarihli maç tamamlandı olamaz”) hem formda anında hem sunucuda aynı kodla denetlenir.

## Hızlı başlangıç

Gereksinimler: **Node.js 20+**, **npm 10+**, **Docker** (yerel PostgreSQL için; kendi PostgreSQL sunucunuzu da kullanabilirsiniz).

```bash
# 1) Bağımlılıklar
npm install
npm run generate -w server          # Prisma istemcisini üret

# 2) Ortam değişkenleri
cp .env.example server/.env         # Windows PowerShell: Copy-Item .env.example server/.env

# 3) PostgreSQL (Docker) — ilk açılışta "refstats" ve "refstats_test" veritabanları oluşur
npm run db:up

# 4) Şema + temel veri (kategoriler)
npm run db:migrate                  # prisma migrate dev
npm run db:seed

# 5) (İsteğe bağlı) Demo hesabı ve örnek maçlar
npm run db:demo                     # demo@refstats.local / Demo12345

# 6) Geliştirme sunucuları (API :4000, arayüz :5173)
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini açın. Vite, `/api` ve `/uploads` isteklerini API'ye yönlendirir.

### Kendi PostgreSQL sunucunuzu kullanmak

Docker yerine mevcut bir PostgreSQL kullanacaksanız iki veritabanı oluşturun ve `server/.env` içindeki bağlantıları güncelleyin:

```sql
CREATE USER refstats WITH PASSWORD 'güçlü-bir-parola';
CREATE DATABASE refstats OWNER refstats;
CREATE DATABASE refstats_test OWNER refstats;   -- yalnızca testler için
```

```env
DATABASE_URL="postgresql://refstats:güçlü-bir-parola@localhost:5432/refstats?schema=public"
TEST_DATABASE_URL="postgresql://refstats:güçlü-bir-parola@localhost:5432/refstats_test?schema=public"
```

Parolada özel karakter varsa URL kodlaması yapın (ör. `@` → `%40`).

## Ortam değişkenleri

Tümü `.env.example` içinde açıklamalıdır; dosya `server/.env` olarak kopyalanır. `.env` dosyaları `.gitignore` ile depodan hariç tutulur.

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Uygulama veritabanı bağlantısı (zorunlu) |
| `TEST_DATABASE_URL` | Test veritabanı. Adı `_test` ile bitmeli; testler bu veritabanını **boşaltır** |
| `NODE_ENV` | `development` / `production` |
| `PORT` | API portu (varsayılan 4000) |
| `APP_URL` | Kullanıcıların gördüğü adres; parola sıfırlama bağlantılarında kullanılır |
| `SESSION_TTL_DAYS` | Oturum süresi (gün, varsayılan 30) |
| `UPLOAD_DIR` | Profil fotoğraflarının klasörü (varsayılan `server/uploads`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Parola sıfırlama e-postaları için SMTP |
| `MAIL_DEV_LOG` | `true` ise ve SMTP yoksa sıfırlama bağlantısı **yalnızca geliştirmede** sunucu konsoluna yazılır; production'da devre dışıdır |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `npm run db:seed` sırasında ilk yöneticiyi oluşturur (parola en az 12 karakter) |

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | API ve arayüzü birlikte izleme modunda çalıştırır |
| `npm run build` | Arayüzü derler (`client/dist`) ve sunucuyu tip denetiminden geçirir |
| `npm start` | API'yi başlatır; `client/dist` varsa arayüzü de aynı adresten sunar |
| `npm test` | Sunucu (entegrasyon) ve istemci (birim) testleri |
| `npm run typecheck` | Üç paketin TypeScript denetimi |
| `npm run db:up` / `db:down` | Docker PostgreSQL'i başlat / durdur |
| `npm run db:migrate` | Geliştirmede migration oluştur/uygula (`prisma migrate dev`) |
| `npm run migrate:deploy -w server` | Production'da bekleyen migration'ları uygula |
| `npm run db:seed` | Sistem kategorilerini (ve tanımlıysa yöneticiyi) yükler; tekrar çalıştırılabilir |
| `npm run db:demo` | Demo hesabını sıfırdan oluşturur |
| `npm run create-admin -- <e-posta>` | Mevcut kullanıcıyı yönetici yapar |

## Demo verisi ve yönetici hesabı

**Demo hesabı:** `npm run db:demo` → `demo@refstats.local` / `Demo12345`. Hesap `isDemo` olarak işaretlenir, arayüzde uyarı bandı gösterir ve komut her çalıştığında yalnızca bu hesap silinip yeniden oluşturulur; gerçek kullanıcılar etkilenmez. Production'da demo hesabı oluşturmayın ya da işiniz bitince silin.

**Yönetici:** Yönetici rolü API üzerinden alınamaz; yalnızca sunucuya erişimi olan kişi verebilir:

```bash
# Seçenek A: kayıtlı bir kullanıcıyı yükselt
npm run create-admin -- ornek@alanadi.com

# Seçenek B: server/.env içinde ADMIN_EMAIL ve ADMIN_PASSWORD tanımlayıp
npm run db:seed
```

Yönetici menüsü (`/app/admin`) yalnızca yönetici rolündeki kullanıcıya görünür; asıl kontrol sunucudadır (`/api/admin/*` uç noktaları rol kontrolü olmadan 403 döner).

## Testler

```bash
npm run db:up      # test veritabanı Docker ile otomatik oluşur
npm test
```

- **Sunucu (26 test):** kayıt/giriş, zayıf parola, aynı kullanıcı adı, hatalı girişte aynı mesaj, çıkış, CSRF başlığı, tek kullanımlık parola sıfırlama, askıya alınan hesap; maç ekleme/düzenleme/silme, sunucu tarafında kart toplamı hesabı, ikinci sarı kuralı, özet kart modu, gelecek tarih kuralı, yinelenen kayıt uyarısı, filtre/arama/CSV; **kullanıcılar arası izolasyon** (başkasının maçını okuma/değiştirme/silme 404), başkasının özel kategorisi, herkese açık profilde sicil no/e-posta sızmaması; dashboard ve analiz hesapları, planlanan maçların sayılmaması, hedef ilerlemesi; yönetici yetkisi ve rol yükseltme denemesi.
- **İstemci (9 test):** sezon hesaplama, kart toplamları, form şeması, yardımcılar.

Test kurulumu (`server/test/global-setup.ts`) `prisma migrate deploy` ile şemayı uygular ve test veritabanındaki tabloları boşaltır. Güvenlik için yalnızca adı `_test` ile biten ve `DATABASE_URL`'den farklı bir veritabanında çalışır.

## Özellikler

**Hesap ve profil** — Kayıt, giriş, parolamı unuttum (tek kullanımlık, 1 saat geçerli bağlantı), parola değiştirme, açık oturumları görme/kapatma, profil fotoğrafı (JPG/PNG/WEBP, en fazla 2 MB, içerik imzası denetlenir), bölge, kurum, klasman, başlangıç yılı, **özel** lisans/sicil no, biyografi, alan alan gizlilik ayarları, hesap kapatma talebi (geri çekilebilir; yönetici onayıyla kalıcı silinir).

**Dashboard** — Toplam / orta / yardımcı / dördüncü hakem maçları, sarı ve kırmızı kartlar, kart ortalaması, farklı kategori sayısı, bu yılın maçları, son maç tarihi, bekleyen raporlar, sıradaki görev, son 30 gün, aylık dağılım (görev türüne göre), kategori ve görev dağılımı, kart grafikleri, hedefler, son aktiviteler. Boş hesaplar için yönlendirici başlangıç ekranı. Bölümler Ayarlar → Dashboard'dan açılıp kapatılabilir.

**Akıllı maç formu** — Yalnızca tarih, takımlar, kategori ve görev zorunlu; ayrıntılar katlanır bölümde. Önceki maçtan kopyalama, takım/saha/organizasyon otomatik tamamlama, favori takım ve saha kısayolları, en sık kullanılan kategori/görevi ön seçme, saha seçilince il/ilçe doldurma, sezonu tarihten otomatik hesaplama, gelecek tarih seçilince durumu “Planlandı” yapma, yinelenen kayıt uyarısı, veri uyarıları (skor yok, dakika eksik, sezon-tarih uyuşmazlığı), **taslağın cihazda otomatik saklanması** ve çevrimdışı uyarısı, `Ctrl+Enter` ile kaydetme.

**Kart ve disiplin** — Olay bazlı giriş (kart türü, kişi türü, ad, forma no, takım, dakika, ek süre, açıklama) veya yalnızca özet sayılar. Toplamlar sunucuda hesaplanır; kayıt yöntemi maçta ve CSV'de açıkça belirtilir.

**Maç geçmişi** — Tablo/kart görünümü, arama, tarih/sezon/kategori/görev/lig/takım/şehir/durum/rapor/kart sayısı filtreleri (URL'de saklanır, paylaşılabilir), sıralama, sayfalama, ayrıntı sayfası, silme onayı, filtreye uygun CSV dışa aktarma (Türkçe Excel uyumlu, formül enjeksiyonuna karşı korumalı), yazdırılabilir liste ve maç dökümü.

**İstatistik merkezi** — Görev/kategori/sezon/tarih filtreleri; görev ve kategori bazında sayılar ve kart ortalamaları, orta hakemlik–yardımcı hakemlik karşılaştırması, sezon karşılaştırması, aylık yoğunluk, yıllık yoğunluk, kart trendi, haftanın günleri, en sık takımlar (ev/deplasman), maç sonuçları dağılımı, gözlemci puanı trendi, hedef–gerçekleşen grafiği. Veri yoksa boş durum gösterilir; tahmini değer üretilmez.

**Takvim** — Aylık/haftalık görünüm, tamamlanan/planlanan/ertelenen/iptal maçların görsel ayrımı, günden maç ekleme, maç ayrıntısına geçiş, sezon hedefi ilerlemesi.

**Kariyer** — Yıllara göre geçmiş, görev ve kategori dağılımı, sezon özeti, kişisel hedefler (toplam / orta / yardımcı / dördüncü hakemlik veya manuel kişisel hedef; sezon ya da yıl bazında), 12 başarı rozeti, yazdırılabilir CV, isteğe bağlı herkese açık profil (`/u/kullanıcı-adı`).

**Ayarlar** — Gizlilik, güvenlik, dashboard düzeni, form varsayılanları, özel kategoriler, takım/saha kütüphanesi (favoriler), geri bildirim gönderme ve yanıtları görme, CSV ve tam JSON yedeği, hesap kapatma.

**Yönetici paneli** — Genel sayısal özet, kullanıcı arama/filtreleme, askıya alma/yeniden etkinleştirme (oturumlar anında kapanır), kapatma talebi olan hesapları kalıcı silme, sistem kategorilerini ekleme/sıralama/pasifleştirme, geri bildirimleri durumlandırma ve yanıtlama. Gizlilik gereği yönetici kullanıcıların maç içeriklerini veya notlarını görmez.

**Erişilebilirlik** — Etiketli form alanları ve hata bağlantıları (`aria-describedby`), klavye ile kullanılabilen modallar (odak tuzağı, Esc), “içeriğe geç” bağlantısı, `N` kısayolu ile yeni maç, azaltılmış hareket tercihi desteği, renk körlüğü testinden geçirilmiş grafik paleti (renk tek başına anlam taşımaz; etiket ve açıklamalarla desteklenir).

## Kart sayım kuralları

Her kart olayı sahada yaşanan **tek** bir disiplin kararıdır:

| Olay | Sarı toplamı | Kırmızı toplamı |
|---|---|---|
| Sarı kart | +1 | — |
| İkinci sarıdan kırmızı | +1 (ikinci sarı) | +1 |
| Doğrudan kırmızı | — | +1 |

İkinci sarıdan ihraç edilen bir oyuncu için ilk sarı “Sarı kart”, ikincisi “İkinci sarıdan kırmızı” olarak girilir: **2 sarı, 1 kırmızı**. Bu nedenle sistem, ikinci sarı sayısının ilk sarılardan fazla olmasına izin vermez. Özet modunda “toplam sarı” ikinci sarıları içerir ve ikinci sarı sayısının en az iki katı olmalıdır. Toplamlar her zaman sunucuda hesaplanır; istemcinin gönderdiği toplamlar yok sayılır.

İstatistiklere yalnızca **Tamamlandı** durumundaki maçlar girer. Planlanan, ertelenen ve iptal edilen maçlar listelenir ama toplamları etkilemez.

## Güvenlik ve gizlilik

- Parolalar bcrypt (maliyet 12) ile özetlenir; kullanıcı yoksa da sahte karşılaştırma yapılarak zamanlama farkı azaltılır. Giriş hatasında hesabın var olup olmadığı açıklanmaz.
- Oturum token'ı yalnızca `httpOnly`, `SameSite=Lax` (production'da `Secure`) çerezde; veritabanında SHA-256 özeti tutulur. Parola sıfırlama/değiştirme diğer oturumları kapatır.
- CSRF: durum değiştiren tüm isteklerde özel `X-Requested-With` başlığı zorunlu; sunucu CORS'a izin vermez.
- Yetkilendirme sunucuda: her sorgu `userId` filtresi içerir; başkasının kaydı tahmin edilen ID ile istense bile 404 döner. Yönetici uç noktaları rol kontrolünden geçer.
- Tüm girdiler sunucuda Zod ile doğrulanır; Prisma parametreli sorgular kullanır (SQL injection). React çıktıları otomatik kaçışlanır; `dangerouslySetInnerHTML` kullanılmaz (XSS). Helmet ile CSP, HSTS, `frame-ancestors 'none'`.
- Giriş, kayıt ve parola sıfırlamada hız sınırı (rate limit).
- Loglara istek gövdesi, parola veya kişisel veri yazılmaz; kullanıcıya iç hata ayrıntısı gösterilmez.
- Herkese açık profil varsayılan olarak kapalıdır; e-posta, sicil numarası, notlar ve maç ayrıntıları hiçbir koşulda yayımlanmaz.

## Proje yapısı

```
├── client/                 React + Vite arayüzü
│   └── src/
│       ├── pages/          Landing, giriş/kayıt, Dashboard, Maçlar, Maç formu/detayı,
│       │                   İstatistik, Takvim, Kariyer, Profil, Ayarlar, Yönetici, Herkese açık profil
│       ├── components/     Arayüz bileşenleri, grafikler, düzen
│       └── lib/            API istemcisi, tipler, biçimlendirme, sorgular
├── server/
│   ├── prisma/             schema.prisma, migrations/, seed.ts, seed-demo.ts
│   ├── scripts/            create-admin.ts
│   ├── src/
│   │   ├── routes/         auth, profile, matches, stats, categories, goals, library, feedback, public, admin
│   │   ├── services/       maç, istatistik, CSV, yedek
│   │   ├── middleware/     oturum, rol, CSRF
│   │   └── lib/            hata, şifreleme, oturum, e-posta
│   └── test/               Vitest + Supertest entegrasyon testleri
├── shared/                 Ortak Zod şemaları, sabitler, kart ve sezon hesapları
├── docker-compose.yml      Yerel PostgreSQL
└── Dockerfile              Tek konteyner production imajı
```

### Veri modeli (özet)

`User` · `UserSettings` · `Session` · `PasswordResetToken` · `Category` (sistem veya kullanıcıya özel) · `Season` · `Team` · `Venue` · `Match` (tek ana görev `role`, kart toplamları) · `CardIncident` · `MatchNote` (özel notlar) · `PersonalGoal` · `Feedback` · `ActivityLog`. Kullanıcı silinince verileri zincirleme silinir; kategoriler ve takımlar maçlarda kullanılırken silinemez (`Restrict`); saha silinirse maç korunur, bağlantı boşaltılır.

## Dağıtım (deployment)

Uygulama tek bir Node süreci olarak çalışır: API ve derlenmiş arayüz aynı adresten sunulur (CORS gerekmez). Gereken: **HTTPS** (production çerezleri `Secure`'dur), PostgreSQL ve kalıcı bir yükleme klasörü.

### Ücretsiz kurulum — Render + Neon (önerilen)

Repodaki `render.yaml` Render servisini otomatik tanımlar.

1. **neon.tech** → GitHub ile giriş → yeni proje (bölge: Frankfurt). *Connection string* ekranında **pooled bağlantıyı kapatıp** doğrudan (direct) adresi kopyalayın (`...?sslmode=require`). Migration'lar doğrudan bağlantı ister.
2. **render.com** → GitHub ile giriş → **New → Blueprint** → bu repoyu seçin.
3. Render `DATABASE_URL` değerini sorar → Neon adresini yapıştırın → **Apply**.
4. İlk derleme birkaç dakika sürer. Açılışta migration'lar ve sistem kategorileri otomatik uygulanır. Adres: `https://refstats-xxxx.onrender.com`.
5. Yönetici: siteye kayıt olun, sonra kendi bilgisayarınızda `server/.env` içindeki `DATABASE_URL`'i geçici olarak Neon adresiyle değiştirip `npm run create-admin -- <e-posta>` çalıştırın ve eski değere geri alın.

Ücretsiz plan notları: servis 15 dk istek gelmezse uyur, ilk istek ~30–60 sn sürebilir; kalıcı disk olmadığı için profil fotoğrafları yeni dağıtımda silinir (maç verileri Neon'da kalıcıdır). Her `git push` otomatik yeniden dağıtım yapar.

### Seçenek 1 — Docker

```bash
docker build -t refstats .
docker run -d --name refstats -p 4000:4000 \
  -e DATABASE_URL="postgresql://kullanici:parola@db-host:5432/refstats?schema=public" \
  -e APP_URL="https://refstats.alanadiniz.com" \
  -e SMTP_HOST=... -e SMTP_USER=... -e SMTP_PASS=... -e MAIL_FROM="RefStats <no-reply@alanadiniz.com>" \
  -v refstats_uploads:/app/server/uploads \
  refstats
```

Konteyner açılışta `prisma migrate deploy` çalıştırır. İlk kurulumda kategorileri yükleyin ve yönetici atayın:

```bash
docker exec -it refstats sh -c "cd server && npx tsx prisma/seed.ts"
docker exec -it refstats sh -c "cd server && npx tsx scripts/create-admin.ts ornek@alanadiniz.com"
```

Önünde HTTPS sonlandıran bir ters vekil (Nginx, Caddy, Traefik veya platformun kendi yük dengeleyicisi) bulunmalıdır. Sunucu production'da `trust proxy` ayarını açar.

### Seçenek 2 — Render / Railway / Fly.io gibi platformlar

1. Yönetilen bir PostgreSQL oluşturun, bağlantı adresini `DATABASE_URL` olarak girin.
2. Build komutu: `npm ci && npm run generate -w server && npm run build -w client`
3. Start komutu: `npm run migrate:deploy -w server && npm start`
4. Ortam değişkenleri: `NODE_ENV=production`, `APP_URL`, SMTP ayarları.
5. Profil fotoğrafları için kalıcı disk bağlayın (`UPLOAD_DIR`). Kalıcı disk yoksa yeniden dağıtımda yüklenen fotoğraflar kaybolur.
6. İlk dağıtımdan sonra platformun kabuğunda `npm run seed -w server` ve `npm run create-admin -w server -- <e-posta>` çalıştırın.

### Seçenek 3 — Kendi sunucunuz (VPS)

```bash
npm ci && npm run generate -w server && npm run build -w client
npm run migrate:deploy -w server && npm run seed -w server
NODE_ENV=production npm start          # pm2 veya systemd ile servis olarak çalıştırın
```

Nginx'te `proxy_pass http://127.0.0.1:4000;` ve Let's Encrypt sertifikası yeterlidir.

### Yedekleme

Veritabanını düzenli yedekleyin (`pg_dump`). Kullanıcılar kendi verilerini Ayarlar → Veri bölümünden CSV/JSON olarak da indirebilir.

## Bilinen sınırlamalar

- **E-posta:** SMTP ayarlanmadan parola sıfırlama e-postası gönderilmez (geliştirmede bağlantı konsola yazılabilir). Kayıtta e-posta adresi biçim olarak doğrulanır; e-posta sahipliği doğrulama (onay bağlantısı) bu sürümde yoktur.
- **JSON yedeği** dışa aktarılır, ancak içe aktarma (geri yükleme) arayüzü bu sürümde yoktur.
- **Profil fotoğrafları** yerel diskte saklanır; çok sunuculu kurulumda S3 benzeri bir depolama gerekir.
- **Prisma 6 CLI** bağımlılık zincirinde (`deepmerge-ts`) bilinen bir uyarı vardır; yalnızca geliştirme/migration aracını etkiler, çalışma zamanı istemcisini değil. Prisma 7'ye geçiş yapılandırma değişikliği gerektirdiği için ayrı bir adım olarak bırakıldı.
- Uygulamada yapay zekâ özelliği yoktur.
