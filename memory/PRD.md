# EQrel — Product Requirements Document (Cohort A PWA)

**Version:** 1.0  
**Status:** LOCKED — Cohort A Trial Build  
**Owner:** Faizal + Emergent AI  
**Last updated:** Brainstorm complete

---

## 🎯 Product Identity

- **Name:** EQrel
- **Tagline:** Build Habits. Grow Iman.
- **Positioning:** Islamic habit-building platform untuk Muslim families
- **Mission:** Help Muslim families build lasting habits, noble character, iman together

**NOT:** Game · Productivity app · Task manager · Edtech LMS · Classroom platform

---

## 👥 Target Users

- **Primary:** Parents + children aged 3–12
- **Markets:** GCC + Malaysia
- **Cohort A specifically:** 10-25 keluarga staff Malaysia (controlled group, 6-week trial)

---

## 🏗️ Cohort A Scope

### Fase Trial:
- **Format:** PWA-first (Capacitor-ready untuk native wrap Cohort C+)
- **Devices:** iOS + Android campur
- **Duration:** 6 minggu
- **Cohort:** 10-25 staff families (baru pertama kali, controlled)
- **Success Priority:**
  1. Parent Trust (paling kritikal)
  2. Habit Formation
  3. Child Engagement
  4. Verification Loop Feasibility
  5. Family Connection
- **Feedback:** In-app survey + WhatsApp group + Group Zoom bi-weekly + Analytics

---

## 💻 Tech Stack

- **Frontend:** Next.js 15 (App Router) + React + Tailwind + shadcn/ui
- **Backend:** Next.js API routes (Node.js)
- **Database:** MongoDB
- **Kid World:** Phaser 3
- **Auth:** Google OAuth (via Emergent Auth)
- **PWA:** next-pwa
- **State:** React Query + Zustand (or Context)
- **i18n:** BM + English day-one (AR structure ready, Cohort B activate)
- **Prayer Time:** Aladhan API (family location from parent onboarding)
- **Future:** Capacitor wrap → iOS/Android native (Cohort C+)

---

## 📱 Device Roles

| Role | Access | Capabilities |
|------|--------|--------------|
| **Parent Device** | Google OAuth | Full Parent Mode + can enter Kid Mode via "Enter as [child]" |
| **Kid Own Device** | Pairing code from parent | Kid Mode only, locked to specific child |
| **Family Display** | Pairing code | Basic ambient read-only (rotating content, prayer times, tasks grid, streak). NO tap-to-complete (Cohort C+ interactive) |

### Kid Mode Access from Parent Device:
- Parent select "Enter Kid Mode as [child]" from dashboard
- Exit = Hold-tap 3s + 4-digit PIN
- Failed PIN 5x = 30s soft lockout

---

## 🎨 Design System (from EQ Master Reference Pack v1.0)

### Official Colours (LOCKED):
- `primary-green` **#00B894**
- `golden-yellow` **#FFB703**
- `accent-coral` **#FF5D6E**
- `blue` **#2D9CDB**
- `orange` **#FF8A00**
- `fresh-green` **#4CAF50**
- `ink` **#0F2E25**

### EQ Character DNA (LOCKED):
- Rounded-square head with Signature Corner
- Asymmetric eyes (left chevron, right rounded-vertical)
- Small open mouth with coral tongue
- Cream torso with centred coral heart
- Left side green, right side yellow (arms + legs)
- No fingers, no clothing, no shoes

### Approved Expressions (4):
1. Calm (Default)
2. Hopeful
3. Quietly Pleased
4. Reflective

### Design Principles:
- Warm, Calm, Premium, Modern, Friendly, Trustworthy
- 3D clay/plasticine visual style
- Rounded soft shadows
- Islamic microcopy (Assalamualaikum, Alhamdulillah, MashaAllah, InshaAllah)
- Mobile-first, portrait, one-handed
- Spacing: 4/8/12/16/24/32/48/64

---

## 🏛️ Parent Mode

### Navigation (Bottom Nav — 4 tabs per mockup):
- 🏠 **Utama** (Dashboard) — home
- 📋 **Tugas** (Tasks/Verify Queue)
- 📊 **Laporan** (Reports)
- 👤 **Profil** (Profile)

### Dashboard Sections (per mockup):
1. Greeting Card (Assalamualaikum, Mama 👋 + notification bell + parent avatar)
2. EQ Hero (mascot + Islamic world background + "Momentum Baik Minggu Ini" badge)
3. Family Progress Card (per-child rings with avatar)
4. Family Streak Bar (🔥 X hari sepanjang perjalanan keluarga)
5. Verify Queue CTA (2 tugasan sedia disemak)
6. Family Quest Card (bila ≥2 anak)

### Verify Queue:
- 3-level rubric: "buat sendiri" (3) / "buat bila disuruh" (2) / "kena marah dulu" (1)
- Grade **does NOT** affect merit points earned (single flat rate)

### Habit Management:
- Habit Library dengan 30 starter templates (Islamic-heavy, age-banded)
- Parent boleh: pilih, edit, duplicate, create baru, archive
- Target: Create habit within 1 minute
- Categories: Prayer, Quran, Adab, Personal Care, Household, Kindness, Learning, Health, Family, Community

### Reward Management:
- 15 curated starter reward templates (age-banded, low-cost heavy Malaysia)
- Parent create custom rewards + set threshold_points
- Parent approve/reject/delay/edit/reschedule reward requests

### Demerit (Anak band 7+ only):
- 4 fixed categories from Base44:
  - tidak_dengar_cakap
  - bergaduh_adik_beradik
  - bercakap_kasar
  - tinggal_solat_tanpa_sebab
- Append-only (RLS enforced)

---

## 🧒 Kid Mode

### Navigation (5 destinations):
- 🏠 Home (Today's tasks + world preview + progress)
- 📋 Today's Tasks
- 🌍 World (Phaser scene)
- 🎁 Rewards
- 👤 Profile

### Kid Home Sections:
- Greeting (nickname, friendly greeting, EQ companion)
- Today's Tasks list (visual icons, tap to complete)
- World Preview card (current pulau + light state)
- Reward Progress
- Achievement badges

### Task Completion:
- Auto verify OR pending parent verification
- If pending: "Menunggu Mama/Ayah 💛" (never imply failure)

---

## 🎮 Kid World (Phaser 3)

### Structure:
- **7 islands total** (top-down archipelago view)
- **1 default island unlocked** for Cohort A
- **6 islands locked** (visible, create curiosity)
- Zoom-in mechanic when tapping default island

### Progressive Unlock (by BUILDING COUNT):
- 0 buildings: rumah, taman_bunga, kebun_sayur
- 1: rumah_kayu
- 2: playground_gelongsor, taman_pokok
- 3: rumah_batu, kebun_buah
- 4: telaga, playground_pasir
- 6: rumah_besar
- 7: taman_air
- 8: playground_buaian
- 9: kebun_padi

### Landmarks Auto-Appear (locked positions):
- **Surau #5** — center-adjacent locked
- **Masjid #10** — FIXED at (0,0)
- **Madrasah #20** — center-adjacent locked
- **Pasar #30** — center-adjacent locked

### Building Cost: 1 Mata Bina = 1 building (flat)

### Grid: Freeform gx/gy placement, center reserved for Ibadah

### Interactions:
- 2-level zoom (Overview + Detail)
- Building info card on tap (name + date + source habit context)
- 2-tier selection (Category → Variant)
- Construction ritual (Bismillah → build animation → Alhamdulillah)

### Nature Auto-Fill:
- Empty cells adjacent to buildings auto-generate rumput/bunga/pokok kecil
- Density scales with light_level

### NPC Villager:
- BFS pathfinding between binaan
- Visit: taman, kebun, playground, pasar, madrasah, telaga
- NEVER visit: masjid, surau (sacred protection)

### EQ Mascot in World:
- **Cohort A:** Static, 1-2 poses (entry greeting, istighfar reflective)
- **Cohort B:** Full 6-pose sprite sheets + pathfinding

### G1 Enforcement:
- WorldBuilding.update = false
- WorldBuilding.delete = false
- Buildings PERMANENT forever

---

## 💡 Cahaya (Light Layer)

### Light Levels + Awan Hitam System:

| Demerit Count | Awan Hitam | Light Level | Istighfar Required |
|---------------|-----------|-------------|-------------------|
| 0 | ☀️ Cerah | 100 | 0 |
| 1 | ☁️ 1 awan | 80 | 7 |
| 2 | ⛅ 2 awan | 60 | 14 |
| 3 | 🌥️ 3 awan | 40 | 21 |
| 4 | 🌫️ 4 awan | 25 | 28 |
| 5+ | ⛈️ Mendung | 10 | 33 (capped) |

### Rules:
- Formula: multiples of 7 (Islamic significance)
- Masjid & Surau **ALWAYS bright** (protected)
- Binaan **NEVER affected** by cahaya
- Recovery restores light to 100% (G6)

### Istighfar Session:
- Text: **أَسْتَغْفِرُ اللَّهَ الْعَظِيْم** / *Astaghfirullahal 'Azim*
- **3-second delay** between each tap (anti-spam, allow tadabbur)
- Modes: Anak self-trigger OR Parent-guided (both supported)
- Tap awan hitam in world → prompt istighfar
- OR parent triggers from dashboard

---

## 🌙 Seasonal System (Full Cohort A)

Hijri detection via Umm al-Qura standard. World overlays:
- **Muharram** — Peaceful new year
- **Rabi'ul Awal (Maulidur Rasul)** — Green lanterns, warm
- **Rejab** — Subtle gold tint, "Persiapan ke Ramadan"
- **Syaaban (Nisfu Syaaban)** — White purification light
- **Ramadan** — Lanterns above masjid, crescent moon, warmer palette
- **Lailatul Qadar** (odd nights 21-29) — Enhanced glow
- **Eid al-Fitr** — Subtle fireworks silhouette, decorations
- **Dhul Hijjah (First 10)** — Distant Kaabah silhouette, sunrise
- **Arafah (9 DH)** — Golden reflective glow
- **Eid al-Adha** — Similar Eid Fitr + sacrifice themes

Design principles:
- All overlays SUBTLE
- No characters depicting holy figures (Islamic art rules)
- Text banners in BM/EN/AR

---

## 🎯 Point System (2 Separate Pools)

### 🔨 Mata Bina (Build Points):
- **Sources:** Verified habits + Quiz task completion (5 points, auto-verified)
- **Use:** 1 point = 1 building
- **Demerit does NOT affect** (protected)

### 🎁 Mata Reward (Reward Points):
- **Sources:** Verified habits ONLY (NOT quiz)
- **Use:** Accumulate toward reward.threshold_points
- **Demerit DEDUCTS** this pool only

### Points Calculation:
- On-the-fly (per Base44 pattern) OR stored balance (Emergent decision — recommended: aggregated cache for performance)
- Task.merit_points default = 10 (habit)
- Quiz task merit_points = 5 (🔨 only, no 🎁 contribution)
- Grade 1-3 does NOT multiply merit (flat rate)

---

## 📋 Task Bank (30 starter templates for Cohort A)

Islamic-heavy, age-banded, BM + EN:
- Prayer (8): Solat 5 waktu + wudhu + doa selepas solat + solat berjemaah
- Quran (5): Mushaf gambar (3-4), hijaiyah (3-6), Iqra (5-8), hafal surah pendek (5-12), baca Al-Quran 5 min (7-12)
- Adab (4): Salam, terima kasih, tangan kanan, bismillah makan
- Personal Care (4): Gosok gigi, mandi, minum air, kemas katil
- Household (3): Kemas mainan, susun meja, basuh pinggan
- Kindness (3): Berkongsi, cium tangan, doa untuk keluarga
- Learning (2): Baca buku, belajar perkataan baru
- Health (1): Bermain aktif 30 min

Verification split: ~77% Parent Verify, ~23% Auto

Base44 has 71 tasks — we start with 30 Malaysian-focused, expand later.

---

## 🎁 Reward Templates (15 curated)

Age-banded, low-cost heavy Malaysia:
- Experience: Ice cream, movie, park, playground, ice cream bersama
- Learning: New book, coloring set, science kit
- Family Time: Bercerita 30 min lebih, family meal choice, family walk
- Outdoor: Bicycle ride, swimming
- Treat: Special snack, home baking
- Privilege: Stay up 30 min, choose family movie

---

## ❓ Quiz System

- Quiz = Task category (RM Rukun Iman, SR Sirah — Base44 pattern)
- Parent assign quiz as habit
- Auto-verified on completion
- Awards 🔨 Mata Bina only (5 points), NO 🎁 Mata Reward
- Anti-grinding: daily schedule enforced by habit assignment
- Visual-first quiz format (multiple choice with images)

---

## 🕌 Prayer Time Integration

- API: **Aladhan** (free, no key)
- Location source: Parent device geolocation (captured onboarding)
- Storage: Family-level (lat/lng, city, timezone)
- Cache: Prayer times per family per day
- Calculation methods by region:
  - Malaysia: JAKIM
  - GCC/Saudi: Umm al-Qura
  - UAE: Dubai
  - Default: MWL

Family Display shows current + next prayer with countdown.

---

## 🚫 Guardrails (Locked from Docs)

- **G1** Progress Permanent — no removal ever
- **G2** Demerit Educational — no punishment feel
- **G3** Recovery Always Possible — free, no premium
- **G4** Real Life First — no screen time optimization
- **G5** Never Compare Children — BLOCKER, no leaderboards
- **G6** Parent Controls Rewards — no auto-redemption

### Anti Dark Patterns:
- No loot boxes, gacha, variable rewards
- No FOMO countdowns, fake urgency
- No infinite scroll, autoplay
- No addiction mechanics
- No advertising SDK

### Child Safety:
- No photo, camera, mic, GPS collection
- Child ID = nickname + age band + avatar ONLY
- No email/password for children

### Privacy:
- Apple Kids Category compatible
- Google Play Families compatible
- Privacy-friendly analytics only

---

## 📊 Analytics (Cohort A)

Track events (backend):
- task_assigned
- task_completed
- task_verified (with grade)
- reward_requested
- reward_approved
- world_visited
- building_placed
- demerit_recorded
- istighfar_session_started
- istighfar_session_completed
- family_quest_progress

Never track: child behavior for advertising, GPS, personal profiling.

Admin dashboard for Faizal to see cross-family stats (aggregated, no comparison surfaced to parents).

---

## 🚀 Not in Cohort A (Later)

- **Cohort B:** Full Arabic + RTL, EQ mascot full animation, more islands unlock, prayer time widget enhancements, photo memories, Ramadan overlays (kalau tak sempat)
- **Cohort C+:** Family Display interactive tap-to-complete, hardware SKU (Skylight-inspired), push notifications
- **Future:** Photo/school verification, multiple guardians, AI habit suggestions, community/school integration

---

## 🎯 Development Phase Plan

### Phase 1: Foundation (Week 1)
- PWA setup (manifest, icons, service worker, install prompt)
- Google OAuth via Emergent Auth
- MongoDB collections base
- Design system (Tailwind config with brand colours + shadcn theme)
- i18n framework (BM + EN, AR structure ready)

### Phase 2: Parent Mode Core (Week 1-2)
- Parent Dashboard (matching mockup design)
- Family setup (add children)
- Habit Library + 30 templates seed
- Task Assignment flow
- Verify Queue

### Phase 3: Kid Mode + Point System (Week 2-3)
- Kid Mode entry (parent-controlled)
- Kid Home + Today's Tasks
- Task completion flow
- 2-pool point system (🔨 + 🎁)

### Phase 4: Reward System (Week 3)
- Reward Shop + 15 templates
- Reward Request flow
- Parent approval

### Phase 5: World (Phaser) (Week 3-4)
- Archipelago overview (7 islands, 1 unlockable)
- Island scene with grid
- 17 building types selection + placement
- Progressive unlock logic
- Landmark auto-appear
- Nature auto-fill
- Villager pathfinding
- Building info cards

### Phase 6: Cahaya System (Week 4)
- Demerit recording (parent dashboard, band 7+)
- Awan hitam visualization
- Istighfar session (self + parent-guided)
- Light level recovery

### Phase 7: Family Display + Prayer Time (Week 4-5)
- Device pairing
- Family Display ambient mode
- Aladhan integration
- Hijri calendar
- Seasonal overlays

### Phase 8: Analytics + Polish (Week 5-6)
- Event tracking
- Admin dashboard
- In-app survey
- Bug fixes + performance
- Cohort A launch

---

## ✅ Locked Decisions Summary

**All world mechanics** = Base44 pattern (freeform grid, 2-tier, progressive unlock by count, landmark auto-appear, construction ritual, 2 point pools, RLS append-only).

**All Cohort A additions:** 7 islands archipelago view, cahaya awan hitam system with Islamic hadith metaphor, seasonal overlays full, prayer time integration, family display basic ambient, quiz as task with 🔨-only award, 30 habit templates + 15 reward templates.

**Success = validate 5 priorities in 6 weeks with 10-25 staff families.**

---

**End of PRD.**

## 🩺 Onboarding — Diagnosis Iman & Habit (Oct 2026)
- Route `/diagnosis` (app/diagnosis/page.js). New family (create) → /diagnosis; dashboard auto-redirects if 0 children and `families.onboarding.completedAt/skippedAt` unset.
- Family part: goals (max 3) + routine (bedtime, jemaah, meals). Per child: profile (name, gender, age 3–12, avatar, colour) → school → 9 practice Qs (0/1/2) → analysing animation → Profil Iman & Habit (score, Fasa Benih/Tunas/Pohon, 5 dimensions, strengths/focus) → personal habit plan (pre-ticked, with reasons) → auto-assigned.
- Engine: lib/diagnosis.js (scoreDiagnosis, buildPlan). API: POST /api/onboarding/family | /child | /complete. Child stores `diagnosis`; habits `source:'diagnosis'`.
- Profile tab row "Diagnosis Iman & Habit Anak" to re-run for existing/new kids (?childId= supported).
- Parent Dashboard bottom nav: Tasks / Reports (GET /api/family/report) / Profile tabs built.
- Diagnosis copy: BM + EN (ID → BM, AR → EN fallback).
- (Oct 2026) Diagnosis: full ms/en/id/ar (Indonesian key = `ind` because `id` is reserved); re-diagnosis keeps `diagnosisHistory` (max 12) + compare card; Reports tab Profil Iman card with 30-day re-diagnosis reminder; shareable 1080×1350 canvas card (lib/shareProfileCard.js, components/eqrel/ShareProfileCard.js) via Web Share API / wa.me fallback.

## 🌿 Parent Calm Mode (Oct 2026) — reduce parent overwhelm
- Sahkan Pantas: components/eqrel/QuickVerifySheet.js (default for bell, Home verify tile, Tasks verify, push ?quick=1). POST /api/verify-queue/verify-all.
- Mod Percaya: habit.autoVerify auto-ON after 7 consecutive verified days (lib/engagement.js checkAutoTrust); kid claims on trusted habits auto-verify 'sah'. Parent toggles 🛡️ in Tasks tab (PATCH autoVerify; off → trustOptOut).
- Digests (4 langs, FAMILY_QUOTES): Niat Pagi, Laporan Malam, Laporan Perubahan Mingguan (rule-based; Claude later). GET /api/digest/:kind. Home DigestCard (morning 03–12, else night); Reports WeeklyStoryCard.
- Web Push: web-push + VAPID keys in .env, public/sw.js, lib/pushClient.js, NotifySettingsSheet (Profile → Notifikasi Tenang). Prefs per parent user.notifyPrefs {tz, lang, morning, night, weekly}. Cron .emergent/crons.yml every 15 min → POST /api/cron/digests (Bearer WEBHOOK_CRON_SECRET). Weekly sent Sunday with night slot. iOS needs Add-to-Home-Screen for push.
- Pending: Claude-written weekly story (user deferred key choice).
- (Oct 2026) Lencana Mod Percaya: components/eqrel/TrustCelebration.js in Kid Mode (GET/POST /api/children/:id/celebrations[/seen], family_events.kidSeenAt); 🛡️ badge on trusted KidHabitCard.
- (Oct 2026) Kongsi Pasangan: components/eqrel/CoParentSheet.js (Profile → Kongsi Pasangan). GET /api/family/parents, POST /api/family/rota {mode both|weekday, days}. Night digest/push is duty-aware (duty, team, autoCount, teamLine).
- (Nov 2026) GLOBAL: English is the default language everywhere (LangProvider no browser auto-detect, html lang=en, server defaults/prefs/preferredLang 'en', API errors English, OG image + share metadata English og-image.jpg?v=2). BM/ID/AR remain opt-in via LangPicker; saved choices respected. Habit titles localised via templateId (getHabitTitle) in new components & digests.
- (Nov 2026) P0 parent journey: diagnosis pace choice (🌱 staged: 3 week-1 habits via pickWeekOne = ibadah anchor + easy win + parent goal, rest locked:true unlockAt +7d, auto-unlocked by unlockDueHabits; 🚀 all). PushPrompt (diagnosis done hero + Home card, iOS A2HS guide, 3-day snooze). HandoverGuide (?handover=1 after diagnosis: set PIN → hand to child → /kid?welcome=1 KidWelcome). Tasks tab trust progress 🛡️ X/7 (trustStreak) + locked habits list. First weekly story on journey day 7 vs Day-1 diagnosis baseline (firstWeek). World villagers gather at REAL prayer times (registry prayerTimes from /api/family/prayer-times) — 90s demo loop removed.
- (Nov 2026) SOLAT TERAS: lib/solatCore.js — age<7 Maghrib+Isyak (Latihan), age>=7 all 5; core:true habits auto-ensured (ensureSolatCore lazy in GET habits + onboarding; existing families get them on next open), never in personal plan/locked, cannot be deleted/deactivated (403), pause via POST /children/:id/solat-pause {haid (girls 9+, 7d) | sakit (1d)} / solat-resume, auto-resume at pauseUntil; claims on paused → 409. Night digest reports solat per child (solatLine) even with Mod Percaya. UI: diagnosis Solat Teras block, HabitsSheet 🕌 Core badge (no trash), Tasks pause menu/banner, Kid Mode gentle banner + 🕌 badge.
- (Nov 2026) Jemput Pasangan Awal: components/eqrel/CoParentInvite.js (hero on diagnosis done page incl. child plan in WhatsApp text; Home card while 1 parent, 5-day snooze, hidden after sent). Kad Solat Mingguan: /family/report children[].solat {prayers, grid states done|ihsan|pending|missed|paused|none|na, done, total}; components/eqrel/SolatWeekCard.js in Reports (strongest/needs-support + tip). (A temporary admin purge endpoint was used once to delete faizalzainon@gmail.com in production, then REMOVED from code.)
