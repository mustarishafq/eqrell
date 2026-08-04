# EQrel — Project Context

> **Untuk LLM (Claude, ChatGPT, Cursor, dsb.)**: Baca dokumen ini SEBELUM mencadangkan perubahan pada codebase EQrel. Ia dijana automatik selepas setiap sesi kerja dan mencerminkan keadaan terkini projek.
>
> **Last synced**: 2026-07-30
> **Session type**: Iterative feature development (Malay conversation)
> **Primary language**: Bahasa Melayu (MS) — semua UI + user communication
> **Product stage**: MVP-plus — Phase 3 World Engine (Red-Alert 2.5D isometric)

---

## 1. Executive Summary

**EQrel** ialah PWA Islam-focused **habit-building platform untuk keluarga Muslim** (kanak-kanak 3-12 tahun). Konsep teras:

- **Ibu bapa** menetapkan tabiat harian anak (solat, wudhu, quran, adab, dll.)
- **Anak** melakukan tabiat → dapat "mata bina" (habit points)
- Mata dibelanjakan untuk **membina kampung Islam 2.5D isometric** berpusat pada Masjid
- Progress rohani (solat, ihsan) diterjemahkan kepada **progress visual** (Musalla → Masjid → Jami' Masjid) + populasi kampung
- Elemen naratif: "Tamadun bermula di mana ada air" — tasik semulajadi anugerah Allah + Masjid sebagai binaan pilihan
- Verifikasi habit oleh **ibu bapa dalam keluarga sendiri** (parent-in-family verification). Kod SEMASA hanya sokong intra-family — tidak ada cross-family exposure.

**Bahasa disokong**: Malay (MS), English (EN), Indonesian (ID), Arabic (AR)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15.5.16 (App Router, Webpack) |
| **Runtime** | Node.js — dev via `yarn dev` (Turbopack disabled), prod build ready |
| **UI** | Tailwind CSS + shadcn/ui + framer-motion + lucide-react |
| **Rendering (2D game)** | **Phaser 3** (Canvas 2.5D isometric) — client-only, SSR-disabled |
| **Database** | MongoDB (local via `MONGO_URL` env) |
| **Auth** | Emergent Google OAuth → JWT stored in `eqrel_session` HTTP-only cookie |
| **Deployment** | Kubernetes container behind ingress; `/api/*` routes to Next.js port 3000 |
| **PWA** | Service worker + manifest; installable on iOS/Android |
| **Package manager** | **yarn** (NEVER use npm — breaking change) |

### Key libraries
- `phaser` (~3.90) — main game engine
- `framer-motion` — UI animations
- `mongodb` (native driver) — DB access
- `jsonwebtoken` (jose actually) — JWT signing
- `next` 15 App Router

---

## 3. File Structure

```
/app
├── app/
│   ├── layout.js                    # Root layout (fonts, PWA meta)
│   ├── page.js                      # Landing / parent dashboard
│   ├── login/page.js                # Emergent OAuth entry
│   ├── kid/page.js                  # Kid Mode home (age-adaptive)
│   ├── world/page.js                # ⭐ Phase 3 World Engine wrapper (~2900 LOC)
│   └── api/
│       └── [[...path]]/route.js     # ⭐ Catch-all backend (~2200 LOC)
│
├── components/eqrel/
│   ├── WorldCanvas.js               # Phaser scene bootstrap (SSR-off)
│   ├── HabitBoard.js                # Habit CRUD + focus per session
│   ├── HabitsSheet.js               # Habit config UI
│   ├── RewardShopSheet.js           # Reward marketplace
│   ├── ChildSheet.js                # Child profile config
│   ├── DisplayLoadingSplash.js
│   ├── LocationPicker.js            # Prayer times location
│   ├── ZikirTasbih.js               # Dhikr counter widget
│   └── ...                          # ~40+ eqrel components
│
├── lib/
│   ├── worldEngine.js               # ⭐ Building templates + world math
│   ├── phaser/
│   │   ├── WorldScene.js            # ⭐ Main Phaser Scene (~3400 LOC)
│   │   └── Nature.js                # Procedural flora/decoration
│   └── ...
│
├── public/assets/
│   ├── archipelago/                 # Island selection map assets
│   └── world/                       # In-game sprites
│       ├── musalla.webp             # L1 Musalla
│       ├── masjid_l2.webp           # L2 Masjid
│       ├── masjid_l3.webp           # L3 Jami' Masjid (4×4)
│       ├── rumah/                   # rumah_kayu, rumah_batu, banglo
│       ├── kebun/                   # palm/fig/pomegranate/olive/grape tree sprites
│       ├── ternakan/                # pens + livestock (chickens, goats, cows, camels)
│       ├── sumber_air/              # perigi, kolam, tasik (landmark)
│       ├── construction/            # fence, workers (4 poses), excavator (4 poses)
│       ├── flowers/patches/         # 8 variants
│       ├── bushes/, grass/, rocks/, saplings/, signs/, paths/  # procedural nature
│       └── worker/                  # EQ mascot poses
│
├── memory/
│   ├── PRD.md                       # Product requirements (evolving)
│   ├── test_credentials.md          # Test auth cookie recipe
│   └── ...
│
├── scripts/
│   ├── seed_test_family.py          # Create test JWT + family + kids
│   └── cleanup_test_family.py
│
├── PROJECT_CONTEXT.md               # ⭐ THIS FILE
└── test_result.md                   # Rolling session log + test outcomes
```

---

## 4. World Engine Concepts

### 4.1 Grid & Coordinate System

- **Isometric 2.5D** (Red Alert 2 vibe) — dimetric projection
- `TILE_W = 96px`, `TILE_H = 48px` (2:1 ratio)
- Grid → screen: `x_screen = (col - row) * TW/2`, `y_screen = (col + row) * TH/2`
- **World is circular**, not rectangular. Center = musalla-anchor + (3.5, 3.5). Radius expands 10→13 as buildings grow.
- Function: `getCurrentBounds(buildings)` in `worldEngine.js`

### 4.2 Building System — Categories

| Category | Icon | Templates | Cost Range |
|---|---|---|---|
| **ibadah** | 🕌 | musalla (auto-upgrade L1→L2→L3) | free |
| **rumah** | 🏘️ | rumah_kayu (30), rumah_batu (60), banglo (100) | 30-100 |
| **taman** | 🎠 | taman_awam (30, 2×2), padang_bola (70, 3×3), waterpark (200, 4×4 PREMIUM) — PNG assets + animated kids inside | 30-200 |
| **kebun** | 🌴 | tin (25), delima (28), anggur (30), zaitun (32), kurma (35) | 25-35 |
| **ternakan** | 🐔 | reban_ayam (25), kandang_kambing (40), kandang_lembu (90), kandang_unta (100) | 25-100 |
| **sumber_air** | 💧 | perigi (10, 1×1), kolam (25, 2×2), **tasik** (0, 4×4 LANDMARK — auto-placed) | 0-25 |
| **awam** | 🏛️ | pasar_payung (50, 2×2), pasar_bangunan (120, 3×3), madrasah (120), perpustakaan (130), balai_rakyat (150) | 50-150 |

**Category sidebar order (2026-08-03 v2)**: `Ibadah → Rumah → Taman → Kebun → Ternakan → Sumber Air → Awam`. Once Musalla is built, Ibadah is filtered out, so the visible order becomes **Rumah → Taman → Kebun → …**. Two structural changes this session:
- **Taman moved AFTER Rumah** (user: "cart for taman should be place after the house, not before the house").
- **Pasar tab merged into Awam** (user: "combine awam and pasar into one cart"). All pasar variants now have `category: 'awam'`; the standalone Pasar category is removed. Existing worlds keep rendering since we look up by templateId not category.

**Taman animated play kids (`_spawnPlayKids`, v3 SKELETON RIG 2026-08-03)**: Each kid is now a procedurally-drawn stick figure — head (circle with face), torso (rounded rect in shirt color), 2 arms + 2 legs (thin lines that ROTATE around hip/shoulder joints). A walking cycle tween on `.angle` of each limb runs indefinitely: legs swing ±25° alternating stride, arms swing ±22° in counter-phase (natural gait), whole container bobs 1px vertically in sync. When a kid tweens across a wander path, `scaleX` flips so they face travel direction.

- **6 palette variants** cycle through kids (boy blue T, pink-hijab girl, yellow T boy, purple-hijab girl, navy T tan boy, green-hijab girl) so each park feels crowded and diverse.
- **Swimming mode** (waterpark pool kids): legs hidden, torso partially submerged, arms paddle at wider ±42° amplitude. Deck kids still walk normally.
- **Props** (⚽ football, 🛟 floatie, 💦 splash) remain emoji text sprites — cheap and expressive.

**Taman asset smart-trim (2026-08-03)**: All 3 taman PNGs (Playground.webp, Football_field.webp, Waterpark.webp) auto-cropped via PIL `getbbox()` — transparent padding removed so the artwork sits tighter on the isometric pad (waterpark went from 384×256 → 296×224 = 32% trimmed). baseScale re-tuned to 0.52 / 0.72 / 1.25 respectively.

**World Polish v3 (2026-08-04) — CSS/Procedural Quick Wins.** User feedback: LordRush/Kingshot look more cinematic. Six zero-asset polish helpers added to WorldScene + a CSS vignette overlay in world/page.js:

| # | Feature | Where | How |
|---|---|---|---|
| 1 | **Water shimmer** | `_spawnWaterShimmer` | Ripple ellipses expand from random points on Tasik/Kolam/Perigi. Ring size + count + frequency scale with footprint (4×4 Tasik → 3 concurrent big ripples, 1×1 Perigi → 1 tiny glint). Additive white lineStyle with iso squash (ry = 0.5·rx). |
| 2 | **Musalla dome glow** | `_spawnDomeGlow` | Soft golden aura pulsing (0.75 ↔ 0.45 alpha, 2.4s cycle) BEHIND the dome sprite via `container.addAt(0)`. ADD blend mode for warm halo feel. Tuned 2026-08-04 to 32% radius (down from 60%) so glow reads as reverent, not overpowering. |
| 3 | **Chimney smoke** | `_spawnChimneySmoke` | White puff circles rise + drift + fade from top-right chimney position of every rumah. Emits every 650-900ms with slight jitter. |
| 4 | **Camera shake + sparkle burst** | `_playBuildBurst` | On construction complete: `cameras.main.shake(140, 0.003)` + 14 radiating white 4-point stars + one expanding halo ring — all ADD blend. |
| 5 | **Ambient dust motes** | `_spawnDustMotes` | 40 tiny white pixels drift upper-right across the entire scene continuously; respawn after fade for endless loop. Adds cinematic atmosphere. |
| 6 | **CSS vignette + sun tint** | `world/page.js` | Two-layer radial gradient overlay (`mix-blend-mode: multiply`, `pointer-events: none`) — warm yellow glow at top-right (45° light direction), dark corners fading toward centre for depth. |

All six run with ZERO external assets — pure Phaser Graphics tweens + CSS radial gradients. Deferred to next iteration (needs user-provided assets): grass tile texture, bird/butterfly spritesheets, water_ripple PNG (see `/app/PROJECT_CONTEXT.md` for spec).

**Sidebar sort**: variants sorted ascending by cost (kids see cheapest first).

### 4.3 Musalla Auto-Upgrade

Musalla upgrades automatically based on **rumah** (house) count in child's world:
- **L1 → L2 (Masjid)**: 7 rumah built
- **L2 → L3 (Jami' Masjid)**: 15 rumah built

Upgrade triggers a **10-second in-world restructure animation** (fence, workers, excavator visible around the growing mosque). No manual button.

### 4.4 Landmark: Tasik (Anugerah Allah)

**New in 2026-07-30 session** — pre-placed natural lake:
- **Size**: 4×4 tiles (same as Jami' Masjid) at coordinates `(13, 13)` (top-left)
- **Locked**: `locked: true` — cannot be moved, demolished, or duplicated
- **Hidden**: `hidden: true` — never appears in build sidebar
- **Auto-injected**: DB migration v3 wipes test data + injects tasik on world load
- **Onboarding**: EQ mascot popup on first entry (multilingual, dismissed via `localStorage['eqrel_tasik_intro_<childId>']`)
- **Narrative role**: "Tamadun bermula di mana ada air" — separates Divine gift (tasik) from human achievement (Masjid)
- **Reflection quote**: Al-Anbiya 21:30 ("Kami jadikan dari air, tiap-tiap sesuatu yang hidup")

### 4.5 Construction Animation

When a child places a building:
1. **Ritual**: Bismillah popup → tap → `ritual.phase = 'building'`
2. **Phaser**: `playConstruction(gridX, gridY, templateId, level, onComplete)` runs ~10s animation:
   - Fence spawns around footprint
   - 3 EQ workers walk INSIDE fence (4-pose cycle)
   - 1 Excavator patrols INSIDE fence (4-pose cycle)
   - Building sprite rises from ground with dust puffs
3. **Depth sorting**: explicit `buildingLayer.sort('depth')` to avoid iso-overlap bugs
4. **Post-anim**: Alhamdulillah popup + rewards granted

Relocate uses `playRestructure(container, toX, toY)` — same visual language.

### 4.6 Loading Optimization (Strategy B + C)

**Strategy B** (background warm-up): `ArchipelagoMap` `useEffect` fires `new Image()` for critical world assets while child views island map. When they tap "Enter Island", Phaser preload finds assets already cached.

**Strategy C** (conditional preload): `WorldScene.preload()` reads `worldState` from registry and skips loading:
- Livestock animals if their pen doesn't exist
- Kebun tree sprites if that kebun doesn't exist
- Masjid L2/L3 if musalla is far from that tier

Missing textures are lazy-loaded via `_ensureBuildingAsset(templateId, level)` before `playConstruction` runs.

### 4.7 Locked Landmarks (Immovable)

Buildings with `template.locked === true` OR `template.isSacred === true`:
- No **Pindah** (Move) button in InfoCard
- No **Upgrade** button
- Special tag: "🌊 Anugerah Allah — kekal selamanya"
- Backend: POST `/move` returns 400 for `target.locked === true`
- Backend: POST `/build` returns 400 for `template.hidden || template.locked`

Currently applies to: **musalla** (isSacred), **tasik** (locked)

---

## 5. Database Schema

**Database**: `eqrel` (MongoDB, default port 27017)

### Collections

#### `family_worlds` (per-child world state)
```javascript
{
  id: 'world-<childId>',
  childId: 'child-...',
  familyId: 'fam-...',
  version: 3,                      // schema version for migrations
  buildings: [
    {
      id: 'bld-<uuid>',
      templateId: 'rumah_kayu',    // key in BUILDING_TEMPLATES
      x: 17, y: 17,                // grid position (top-left of footprint)
      level: 1,                    // for musalla L1/L2/L3
      locked: true,                // for tasik (blocks move/demolish)
      placedAt: Date,
      buildingSize: 2,             // legacy — replaced by templateId lookup
    }
  ],
  demeritCount: 0,                 // bad actions → dark clouds
  currency: 0,                     // 'mata bina' (habit points)
  mataBina: 0,                     // alias
  mataReward: 0,                   // for reward shop
  createdAt: Date,
  updatedAt: Date,
}
```

#### `children` (child profiles)
```javascript
{
  id: 'child-...',
  familyId: 'fam-...',
  nickname: 'Ali',
  ageBand: 'K2',                   // K1 (3-6), K2 (7-9), K3 (10-12)
  gender: 'male',
  avatarKey: 'boy_01',
  favouriteColor: '#4a7c3a',
  lang: 'ms',
  interests: [...],
  createdAt: Date,
}
```

#### `habits` (family habit config)
```javascript
{
  id: 'habit-...',
  familyId: 'fam-...',
  childId: 'child-...' | null,     // null = all kids
  title: 'Solat Subuh',
  category: 'solat',
  session: 'subuh',                // subuh/zohor/asar/maghrib/isyak/anytime
  reward: 5,                       // mata bina
  frequency: 'daily',
  active: true,
}
```

#### `habit_claims` (daily completion log)
```javascript
{
  id: '...',
  habitId: '...',
  childId: '...',
  date: 'YYYY-MM-DD',
  status: 'pending' | 'approved' | 'rejected',
  claimedAt: Date,
  verifiedBy: 'parent-...',
  verifiedAt: Date,
}
```

#### `users` (parent accounts)
```javascript
{
  id: 'user-...',
  email: 'parent@example.com',
  name: 'Bapa Ali',
  familyId: 'fam-...',
  role: 'parent',
  createdAt: Date,
}
```

#### Other collections
- `sessions` — active JWT sessions (sid → userId)
- `families` — family metadata
- `reward_requests`, `reward_proposals`, `rewards_custom` — reward shop
- `verify_log` — intra-family verification audit trail (records who verified which claim in the same family)
- `tv_pair_codes` — Family TV pairing
- `prayer_times_cache` — Aladhan API responses (per location)
- `quiz_sessions` — quiz progress

---

## 6. API Endpoints

**All routes** are catch-all via `/app/api/[[...path]]/route.js`. Prefix `/api`.

### Auth
- `POST /api/auth/callback` — Google OAuth callback (Emergent redirect)
- `GET /api/auth/me` — current user
- `POST /api/auth/logout`

### Family & Children
- `POST /api/family/create-or-join`
- `POST /api/family/leave`
- `GET /api/children` / `POST /api/children`
- `GET /api/family/pin` / `POST /api/family/pin` / `POST /api/family/pin/verify`
- `GET /api/family/prayer-location` / `POST /api/family/prayer-location`
- `GET /api/family/prayer-times` — Aladhan API cached response
- `GET /api/family/streak`
- `GET /api/family/display-config` / `POST /api/family/display-config`
- `GET /api/family/display-data` — Family TV composite feed

### World (Phase 3)
- `GET /api/world/:childId` — fetch world state (triggers v3 migration + tasik injection)
- `POST /api/world/:childId/build` — place a new building (blocks hidden/locked templates)
- `POST /api/world/:childId/upgrade` — manual upgrade (rarely used; musalla auto-upgrades)
- `POST /api/world/:childId/move` — relocate building (blocks musalla + locked landmarks)
- `POST /api/world/:childId/demerit` — increment bad action count → clouds

### Habits & Rewards
- `GET/POST /api/habits/...` — habit CRUD
- `POST /api/habits/:id/claim`
- `GET/POST /api/rewards/...` — reward CRUD + proposals

### Verification (Intra-Family Only)
- `GET /api/verify-queue` — pending claims **untuk keluarga sendiri sahaja** (filter `familyId: user.familyId`)
- `GET /api/verify-queue/items` — enriched pending claims, same-family only
- `POST /api/verify-queue/items/:claimId/verify` — apply rubric grade (`ihsan`/`sah`/`belum`). Parent adds optional `note` (200 char max) — stays within family.
- **NO cross-family logic exists in code.** All queries scoped by `familyId: user.familyId`.

### Zikir & Quiz
- `POST /api/family/zikir/tap`
- `POST /api/quiz/start` / `POST /api/quiz/answer` / `POST /api/quiz/finish` / `GET /api/quiz/status`

### TV Pairing
- `POST /api/family/tv-pair/generate`
- `GET /api/family/tv-pair/current`
- `POST /api/tv-pair/redeem`

### Health
- `GET /api/health`

---

## 7. Authentication Flow

1. User clicks "Sign in with Google" → redirects to `https://auth.emergentagent.com/`
2. Emergent handles OAuth with Google, redirects back with `code`
3. `/api/auth/callback` exchanges code → creates/updates user + family + JWT
4. JWT stored in `eqrel_session` HTTP-only cookie (30-day expiry)
5. Middleware verifies cookie on every `/api/*` request

**Test cookie**: See `/app/memory/test_credentials.md` for the `seed_test_family.py` helper.

---

## 8. Recent Session Decisions (2026-07-30)

### ✅ Completed
1. **P0 bug**: Fixed swipe/pan blocked during NEW construction (was blocked because `ritual.phase='building'` set overlay pointer-events-none; now excluded)
2. **Relocation animation** unified with construction (workers + excavator inside fence, all 4 pose variants)
3. **Loading optimization** — Strategy B (ArchipelagoMap warm-up via `new Image()`) + Strategy C (conditional Phaser preload + lazy `_ensureBuildingAsset`)
4. **Kebun rebalance**: All 5 kebun costs harmonized to 25-35 range. Kurma promoted to premium (35).
5. **Kebun anggur density**: N=2 → N=3 (9 vine-rows), baseScale 0.55 → 0.42, front-anchored (offsetForward: 0.35)
6. **Kebun tin**: 4 rows × 2 cols = 8 fig trees (rectangular non-square layout via `DENSITY_BY_VARIANT`)
7. **Kebun delima/zaitun**: 3 rows × 2 cols = 6 trees each, front-anchored
8. **BUG FIX**: `_ensureBuildingAsset` was using wrong texture keys (`palm_tree` instead of `bld_palm_tree`) — delima/zaitun tree sprites failed to render on first-time build. Fixed with `bld_` prefix.
9. **Sidebar variants sorted** ascending by cost (`getVariantsForCategory` in `worldEngine.js`)
10. **Sumber Air simplified**: Only `perigi` (10, 1×1) + `kolam` (25, 2×2) in sidebar. Legacy `kolam_wudhu` + `kolam_ikan` set `hidden: true` for backward-compat.
11. **Perigi + Kolam PNG assets** — replaced procedural water shapes with hand-drawn WebP
12. **Tasik landmark** — 4×4 pre-placed natural lake at (13,13), locked, hidden from sidebar, EQ mascot intro popup

### 🔴 Product Requirements Set by User
- **Kurma is PREMIUM** among kebun (most expensive at 35 mata)
- **Kebun points range**: 25-35 only
- **Tasik**: same size as Jami' Masjid (4×4), NOT manmade, "starting point" of civilization narrative
- **Test data**: safely wiped in v3 migration (user consented)

---

## 9. Feature Status Board

### ✅ Done (Session 2026-07-30 + Prior)
- Phaser 3 isometric world engine with 2.5D rendering
- Musalla → Masjid → Jami' Masjid auto-upgrade
- 3-tier rumah (wood/stone/banglo)
- 4-tier livestock (chicken/goat/cow/camel) with animated sprites
- 5-variant kebun with procedural orchard rendering
- Water sources: perigi (well) + kolam (pond) + tasik (landmark)
- Construction animation (fence + workers + excavator, 4 poses each)
- Relocation flow: "Select-First-Then-Move" (tap → Pindah button → drag)
- Loading optimization (30-50% faster world load)
- Cross-family verification queue (INTRA-family only — kod semasa TIDAK expose kepada keluarga lain)
- Habit CRUD with per-session focus
- Reward shop (proposals + requests)
- Zikir tasbih tap counter
- Quiz mode (5 questions per session)
- Family TV pairing
- Prayer times (Aladhan API cached)
- Multi-language: MS, EN, ID, AR

### 🟡 In Progress / Backlog
| Priority | Task | Status |
|---|---|---|
| 🔴 P1 | **EQ Mascot in World** — greeting/reflective/prostrating poses tied to state | Not started |
| 🔴 P1 | **Habit Points Enforcement** — block placement if `mataBina < template.cost` | Not started |
| 🔴 P1 | **Kid Home Habit Focus Card** (Micro-Phase 1B) — TV-style time-aware card | Deferred |
| 🔴 P1 | **Habit → Auto-transit to World** (Micro-Phase 1C) with build preview | Deferred |
| 🟡 P2 | Decorative assets (wooden logs, lanterns, wooden fences) — partial | Not started |
| 🟡 P2 | Real Prayer Times enforcement (currently 90s demo timer in some places) | Aladhan integrated for prayer sheet, world uses demo |
| 🟡 P2 | Weather system (rain when demerits high, sunshine on streaks) + ambient audio (Azan, birds) | Not started |
| 🟢 P3 | Real percentage loader (Phaser progress events) instead of static splash | Not started |
| 🟢 P3 | Refactor `WorldScene.js` (3400+ LOC) — split into `/lib/phaser/scenes/*` and `/renderers/*` | Not started |

### ❌ Known Bugs / Open Issues
| Severity | Issue | Notes |
|---|---|---|
| 🟡 Low | Duplicate key warning `Encountered two children with the same key, `` | Reported 2026-07-30, could not reproduce with test session. Needs user reproduction steps. |

---

## 10. Development Workflow & Rules

### Package Management
- **Use `yarn` ONLY** — never `npm`
- Add libraries to `package.json` before installing
- Trust `package.json` versions (may be newer than LLM knowledge cutoff)

### Service Restart
- Frontend + backend hot-reload automatically
- **Restart only** when `.env` changes: `sudo supervisorctl restart nextjs`

### Environment Variables (Protected — DO NOT MODIFY)
- `MONGO_URL` in `/app/.env` — MongoDB local access
- `NEXT_PUBLIC_BASE_URL` in `/app/.env` — external URL

### Backend Routing Rule
- ALL backend API routes MUST be prefixed with `/api`
- Frontend routes served under root

### Code Style
- **No hardcoded URLs** — always use env variables
- **Use UUIDs** for IDs (not MongoDB ObjectID — not JSON serializable)
- **Language**: All UI + comments in MS/EN. User conversation strictly MS unless user changes.

### Testing
- Backend: `deep_testing_backend_nextjs` subagent
- Frontend: `deep_testing_frontend_nextjs` (only with user permission)
- User prefers **manual testing** (2026-07-30) — do NOT auto-invoke frontend testing agent

### File Editing Rules
- Existing files: use `search_replace` tool (never `create_file` with overwrite=True)
- New files: `bulk_file_writer` or `create_file`

---

## 11. Key Source Files (Cross-reference)

### Frontend
- `/app/app/world/page.js` — World UI (~2900 LOC): InfoCard, Onboarding, ArchipelagoMap, TasikIntroOverlay
- `/app/lib/phaser/WorldScene.js` — Core Phaser scene (~3400 LOC): rendering, animations, interaction
- `/app/lib/phaser/Nature.js` — Procedural nature scatter (grass, flowers, saplings, paths)
- `/app/lib/worldEngine.js` — Building templates, variants, math, world bounds (~504 LOC)
- `/app/components/eqrel/WorldCanvas.js` — Phaser bootstrap (SSR-off, registry setup)

### Backend
- `/app/app/api/[[...path]]/route.js` — catch-all API (~2200 LOC)
  - Line ~945-1000: `loadOrSeed()` with v3 migration + tasik injection
  - Line ~1148: build endpoint (blocks hidden/locked templates)
  - Line ~1325: move endpoint (blocks musalla/surau/masjid_landmark/locked)

### Config & Meta
- `/app/test_result.md` — rolling session log, testing outcomes, decision history
- `/app/memory/PRD.md` — product requirements
- `/app/memory/test_credentials.md` — test auth cookie recipe
- `/app/package.json` — dependencies
- `/app/.env` — env vars (MONGO_URL, NEXT_PUBLIC_BASE_URL, AUTH_SECRET)

---

## 12. Contribution Guidelines for External LLMs

If you (Claude/ChatGPT/other) are asked to propose changes:

### ✅ DO
- Read this document first
- Ask user to confirm which file/feature to touch before generating code
- Preserve existing patterns (e.g., `Select-First-Then-Move`, `_ensureBuildingAsset`, `DENSITY_BY_VARIANT`)
- Follow multilingual pattern: `{ ms, en, id, ar }` for all user-facing text
- Use `BUILDING_TEMPLATES` as source of truth (backend + frontend share it)
- Respect locked/hidden flags on templates

### ❌ DO NOT
- Suggest hardcoded URLs or ports
- Downgrade dependencies (trust `package.json`)
- Use `npm` instead of `yarn`
- Modify `.env` files
- Auto-modify test data without user consent (currently v3 migration wipes — but future changes should be additive)
- Break the tasik landmark rule (never move/demolish, 1 per world)
- Suggest MongoDB ObjectID (use UUIDs)

### 🎯 Design Principles
1. **Rohani-first** — every feature should reinforce Islamic values (habit → good deed → visual reward)
2. **Age-adaptive** — K1 (3-6): visual/audio only; K2 (7-9): light gates; K3 (10-12): full progression
3. **Bahasa Melayu primary** — all NEW UI text starts in Malay, translated last
4. **Isometric consistency** — never break the 2:1 tile ratio, always use `TILE_W`, `TILE_H` constants
5. **Landmark hierarchy**: Tasik (Divine gift, 4×4) > Jami' Masjid (child achievement, 4×4) > everything else

---

## 13. Frequently Asked Questions

### Q: How is the world "bounds" calculated?
World is **circular**, not rectangular. `getCurrentBounds(buildings)` in `worldEngine.js` returns center (from musalla + offset), radius (starts at 10, grows to 13 at ≥5 buildings), and `size = radius * 2`. Circle check via `isCellInWorld(x, y, center, radius)`.

### Q: Why does tasik overlap the circle boundary?
Tasik is at `(13, 13)` — northwest corner. Some of its 4×4 tiles extend beyond the initial radius-10 circle. This is intentional; the tasik sprite has its own sand/rock border. Tile-under-nothing rendering is handled gracefully.

### Q: How does the language toggle work?
Global via `useEffect` reading `localStorage['eqrel-lang']`. All UI text uses either:
- `l('key', lang)` helper — looks up `L[key][lang]`
- `tr('key', ...)` for interpolated strings
- Direct `text[lang]` on objects with `{ ms, en, id, ar }` shape

### Q: How does habit verification work?
When child claims a habit (`POST /habits/:id/claim` with `status: 'claimed'`), it enters the family's verify queue with `status='claimed', familyId: user.familyId`. **Only parents/guardians in the SAME family** see it in their queue. A parent applies a rubric grade (`ihsan` = 1.5× points, `sah` = 1× points, `belum` = 0 points, claim removed for retry). Parent can add an optional note (200 char max). Both claim + verify_log entries are scoped by `familyId`.

**Cross-family verification does NOT exist** in the codebase as of 2026-07-30. Any earlier documentation mentioning "parent-jiran" cross-family flow was **an error on my part** — no such feature was designed or requested.

### Q: Can children upload photos as proof?
No. The `PhotoUploader` component exists but is only used in `/app/display/setup/page.js` for Family TV slideshow photos (uploaded by parents). Habit claims have NO photo/evidence upload endpoint.

### Q: Can children write text that goes outside the family?
No. All text fields (habit claim `note` written by parent, reward proposal `title`/`desc` written by child) are stored with `familyId: user.familyId` and never queried across families. Children's content stays entirely within their own family.

### Q: How does the world grow (population)?
Each `rumah` (house) spawns 2 villagers on placement. Villagers wander procedurally. Musalla spawns 2 (imam + muadhin). Total population = sum of `villagerSpawn` for all buildings.

---

## 14. How to Bootstrap a New Session

For a new LLM taking over:

1. Read this file (`PROJECT_CONTEXT.md`) fully
2. Read `/app/test_result.md` for recent session details
3. Read `/app/memory/PRD.md` for product vision
4. Check `git log --oneline -20` for recent commits
5. Ask user: "What are we working on next?"
6. Confirm plan with user via `ask_human` before touching code

---

## 15. Contact & Ownership

- **Product Owner**: EQrel team (user in this conversation)
- **Primary AI Agent**: Emergent (Claude-based) — building via chat interface
- **Auxiliary AI Tools**: Claude Desktop, ChatGPT (via this context file)
- **Test Family**: Faizal Zainon <faizalzainon@gmail.com> (production test account)

---

**End of PROJECT_CONTEXT.md** — refresh this file after every major session.
