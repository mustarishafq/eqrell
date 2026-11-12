# EQrel — Product Modules Overview
*Islamic habit-building platform for Muslim families (children aged 3–12)*
*Web app (PWA) — works on phone, tablet and TV · Languages: English, Bahasa Melayu, Bahasa Indonesia, Arabic*

---

## 1. Onboarding & Family Setup
- **Parent sign-up & login** — secure parent account
- **Family profile** — family name, location (for prayer times), language
- **Add Child** — nickname, age, avatar, favourite colour
- **Child Diagnosis** — short questionnaire per child → personalised habit plan
- **Age-based starter plan** — all age-suitable habit templates given at once (or step by step)
- **Co-Parent invite** — spouse joins the same family and shares everything
- **App install prompt** — guided “Add to Home Screen” for iOS & Android

## 2. Habit System (core)
- **Habit templates library** — ready-made Islamic & life habits by category (Ibadah, Akhlak, Health, Learning, Responsibility…) filtered by age
- **Custom habits** — parent creates their own habit (name, icon, category, points)
- **Family templates** — create once, give to several children, reuse later
- **Time of day** — Morning / Midday / Afternoon / Evening / Night / Before bed (follows real prayer times)
- **Multi-time habits** — one habit several times a day (e.g. Eat: breakfast, lunch, dinner)
- **Exact clock time** — optional time per slot (e.g. 7:30 am)
- **Day schedule** — Every day / School days / Weekends / Chosen days
- **School days setting** — each family sets its own school week (Mon–Fri or Sun–Thu)
- **School holidays** — holiday periods: school-day habits rest, weekend habits run
- **Staged unlocking** — new habits can unlock gradually week by week (or all now)
- **Pause / resume habits**
- **Quick “Create Habit” button** on the Tasks tab

## 3. Solat Teras (Core Prayer)
- Five daily prayers tracked per prayer time
- Age-appropriate prayer goals (e.g. younger kids practise Maghrib & Isyak)
- Real prayer times by location (Aladhan API)
- Weekly Solat card & prayer streaks

## 4. Kid Mode (child experience)
- **Kid home** with greeting, avatar & mascot
- **Habit Focus card** — TV-style “what to do now” card based on time of day
- **My Day timeline** — picture timeline from Morning → Bedtime with each habit in place
- **Session view** — habits grouped by prayer time
- **One-tap “I did it”** with “Alhamdulillah” sound & haptics
- **Catch-up (Yesterday)** — kids can tick yesterday’s habits until Maghrib (parent verifies)
- **Points pop-up** — “+20 🏗️ +4 🎁 Points added!” when a parent approves
- **Refresh** — button, pull-down and auto-refresh
- **Kid tutorials & mascot speech**
- **Zikir Tasbih** counter
- **Islamic Quiz**

## 5. Parent Verification & Trust
- **Parent Inbox (🔔)** — one place for habit claims, reward requests and reward ideas
- **Quick Verify** — Sah ✓ / Ihsan ⭐ / Not yet ↺, verify all in one tap
- **Detailed Verify** — one by one with notes
- **Trust Mode** — habits verified 7 days in a row become auto-verified
- **Earlier days update** — parents can fix up to 7 days back
- **Multi-day verify queue** — late claims stay until verified (“🌙 Yesterday” label)

## 6. Points Economy
- **Mata Bina (Build Points)** — earned from habits → used to build the village
- **Mata Reward (Reward Points)** — 20% of habit points (+5 for Ihsan) → used in the Reward Shop
- **Points History** — every point earned & spent, for parents

## 7. Reward Shop
- **Reward templates** (screen time, food, outing, learning, activity, spiritual)
- **Custom rewards** with parent-set price
- **Hide / restore templates** that don’t suit the family
- **Kid redemption requests** → parent approves (points deducted) or declines
- **Kid reward ideas (proposals)** → parent adds to shop or declines
- **Fulfil tracking** — mark rewards as delivered

## 8. World Engine — Islamic Village (Phaser 3)
- **2.5D isometric village** (Red Alert style) centred on the **Musalla**
- **Grid-based building placement** using Mata Bina
- **Musalla upgrades** → Masjid → Masjid Jamek
- **Procedural wilderness** surroundings & decorations
- **Visual consequences** — e.g. dark clouds for skipped/bad actions
- **Building locks** tied to progress

## 9. Family TV Display
- **TV linking** via QR / short code (no login on TV)
- **Family scoreboard** — each child’s progress, habits now, prayer times
- **Save to TV** guide — install / bookmark for Android TV (TCL, Xiaomi…), Samsung, LG, Hisense, Fire TV
- **Landscape full-screen display mode**

## 10. Devices & Access
- **Kid device linking** — child’s own phone/tablet locked to Kid Mode (no parent access)
- **Kid device management** — see & remove linked devices
- **Device Setup Guide** for parents
- **PIN protection** for switching to parent mode

## 11. Notifications & Reminders
- **Niat Pagi** — morning intention digest for parents
- **Laporan Malam** — night report for parents
- **Weekly report** push (Sunday)
- **Habit claim alerts** to parents
- **Reward request & idea alerts** to parents
- **Kid habit reminders** — “⏰ Time for breakfast!” at the exact time on the child’s device
- **Kid decision alerts** — “🎉 Reward approved!”
- **Notification settings** — times, language, on/off per type

## 12. Reports & Insights
- **Reports tab** — daily & weekly progress per child
- **Weekly AI Note** — warm, family-specific weekly summary written by AI (Claude)
- **Share Weekly Card** — visual image card (village, kids’ progress, 7-day dots) to WhatsApp / spouse
- **Streaks & consistency %**
- **Share profile card**

## 13. Rest & Travel Mode (Hari Rehat & Musafir)
- Pause habits for sick days, rest days or travel without breaking streaks
- Kid sees a friendly rest banner

## 14. Islamic Content & Atmosphere
- **Hijri calendar** & Islamic dates
- **Azan audio** & Quran recitation (MP3Quran)
- **Family quotes / Islamic content**
- **Mascot (EQ)** with speech and moods

## 15. Platform & Technology
- **Next.js 15 PWA** — installable on phone, tablet, TV
- **MongoDB** database
- **Phaser 3** game engine (World)
- **Web Push** notifications
- **AI**: Anthropic Claude (Weekly AI Notes)
- **Integrations**: Aladhan (prayer times), MP3Quran (audio), Cloudinary (photos)
- **Scheduled jobs** — digests & reminders every 15 minutes
- **Multi-language** (EN / MS / ID / AR, incl. right-to-left Arabic)

---

### Suggested slide flow
1. Problem & vision → 2. Onboarding & Diagnosis → 3. Habit System → 4. Solat Teras → 5. Kid Mode → 6. Parent Inbox & Trust → 7. Points & Reward Shop → 8. Islamic Village (World) → 9. Family TV → 10. Notifications → 11. Reports & AI Note → 12. Technology → 13. Roadmap

### Roadmap (next)
- Habit → World auto-transition with build preview
- EQ Mascot inside the village (greeting, prostrating, sad poses)
- More decorations (wooden logs, lanterns, fences)
- Weather & ambient sounds (Azan, birds)
- Full-day bonus & custom reward rate
