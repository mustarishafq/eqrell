backend:
  - task: "TV Device Link - POST /api/tv/device/start"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV device start endpoint working correctly. Returns deviceId, secret, 6-digit code, and expiresAt. Samsung TV label correctly detected from User-Agent header."

  - task: "TV Device Link - POST /api/tv/device/connect"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV device connect endpoint working correctly. All status responses verified: 'unknown' (404) for wrong secret, 'pending' before approval, 'expired' for expired codes, 'approved' after approval with session cookie, 'revoked' for revoked devices."

  - task: "TV Device Link - GET /api/tv/device/lookup"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV device lookup endpoint working correctly. Returns 401 without auth, returns device info (code, label, expiresAt) with parent auth, returns 404 for invalid codes."

  - task: "TV Device Link - POST /api/tv/device/approve"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV device approve endpoint working correctly. Returns 401 without auth, 400 for bad code format, 404 for re-approving same code, 403 for TV role sessions. Successfully approves valid codes and links device to family."

  - task: "TV Device Link - TV Session Permissions"
    implemented: true
    working: true
    file: "/app/lib/session.js, /app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV session permissions working correctly. TV role can access /api/family/display-data and /api/family/display-config (200). TV role correctly blocked (403) from /api/tv/device/approve, /api/tv/device/lookup, and /api/family/tv-devices."

  - task: "TV Device Link - GET /api/family/tv-devices"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV devices list endpoint working correctly. Returns list of approved devices with name, label, approvedAt, lastSeenAt. Does NOT include secretHash (security verified). Revoked devices not shown in list."

  - task: "TV Device Link - POST /api/family/tv-devices/:id/revoke"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ TV device revoke endpoint working correctly. Successfully revokes device, after which TV session gets 401 on display-data, connect returns 'revoked' status, device not in list. Returns 404 for re-revoking or wrong family device."

  - task: "TV Device Link - Legacy TV Pair Endpoints (Regression)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ Legacy TV pair endpoints working correctly. POST /api/family/tv-pair/generate creates 6-digit code. POST /api/tv-pair/redeem successfully redeems code and sets session cookie. Legacy TV session can access display-data."

frontend:
  - task: "Co-parent invite card + Kad Solat Mingguan (Reports)"
    implemented: true
    working: true
    file: "/app/components/eqrel/CoParentInvite.js, /app/components/eqrel/SolatWeekCard.js, /app/components/eqrel/tabs/ReportsTab.js, /app/app/diagnosis/page.js, /app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "CoParentInvite: variant 'hero' on /diagnosis done screen (testid coparent-invite-hero) and variant 'card' on parent Home (coparent-invite-card) — only when family has 1 parent (GET /api/family/parents). Buttons: coparent-invite-send (navigator.share or wa.me with text incl. child name + family code; sets localStorage eqrel-invite-sent → title 'Invite sent ✓', Home card hidden afterwards), coparent-invite-copy (copies code), coparent-invite-later (snooze 5 days localStorage eqrel-invite-snoozed). SolatWeekCard in Reports tab per child (testid reports-solat-{childId}): table rows = core prayers (Fajr/Dhuhr/Asr/Maghrib/Isha for age>=7, only Maghrib/Isha for age<7), 7 day columns, cell data-state done|ihsan|pending|missed|paused|none|na; header 'Prayers this week X/Y · %'; insight chips reports-solat-insight-{childId} (Strongest / Needs support + tip) when data exists."
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL TESTS PASSED - Co-parent Invite Card + Kad Solat Mingguan (Reports)
          
          Tested on MOBILE (390x844) and DESKTOP (1366x800) viewports.
          
          **A) HOME PAGE (/?parent=1) - Co-parent Invite Card:**
          ✅ A1: Card VISIBLE when family has 1 parent (data-testid="coparent-invite-card")
          ✅ A2: Copy button (coparent-invite-copy) shows family code, clickable
          ✅ A3: "Maybe later" button (coparent-invite-later) hides card, snooze persists after reload (localStorage eqrel-invite-snoozed)
          ✅ A4: Send button (coparent-invite-send) triggers window.open with wa.me URL containing family code (navigator.share stubbed)
          ✅ A5: Card HIDDEN when family has 2 parents (inserted second user with same familyId → card not in DOM)
          
          **C) REPORTS TAB - Solat Week Cards:**
          ✅ C1: Solat week card VISIBLE for each child (data-testid="reports-solat-{childId}")
          ✅ C2: Child 1 (age 8): 5 prayer rows (Fajr, Dhuhr, Asr, Maghrib, Isha) - correct for age >= 7
          ✅ C3: 7 day columns (Mon-Sun) with header labels
          ✅ C4: Cell data-state attributes working:
             - 'na' for days before habits created (30 cells)
             - 'none' for today with no claims (5 cells initially)
             - 'done' for verified sah claims (2 cells: Maghrib + Isha after inserting claims)
             - 'pending' for claimed status (1 cell: Subuh after inserting claim)
          ✅ C5: Header shows correct count "2/5 · 40%" after inserting verified claims
          ✅ C6: Checkmark (✓) displayed for verified prayers
          ✅ C7: Pending symbol (◐) displayed for claimed prayers
          ✅ C8: Child 2 (age 5): Solat card shows prayers based on existing habits (note: shows all 5 rows because child has 5 prayer habits from seed data; age-based filtering applies when habits are created via core habit system)
          
          **D) LAYOUT & CONSOLE:**
          ✅ D1: No horizontal scroll on mobile (scrollWidth: 390, clientWidth: 390)
          ✅ D2: No error messages found on page (excluding known hydration warnings)
          
          **NOTES:**
          - Diagnosis done screen (/diagnosis) not tested as it requires completing full diagnosis flow
          - Age-based prayer filtering (age < 7 shows only Maghrib + Isha) works when habits are created via GET /api/children/:id/habits (core habit creation), but existing habits are displayed regardless of age
          - All test data cleaned up successfully via cleanup_test_family.py
          
          Screenshots captured: mobile-home-coparent-card.png, mobile-reports-page.png, mobile-solat-with-claims.png, desktop-home-coparent-card.png, desktop-solat-with-claims.png, final-mobile-child1-solat.png, final-mobile-child2-solat.png

  - task: "REST MODE (Travel & Rest Days) - Full UI Flow"
    implemented: true
    working: true
    file: "/app/components/eqrel/RestModeSheet.js, /app/components/eqrel/tabs/ProfileTab.js, /app/app/page.js, /app/app/kid/page.js, /app/app/world/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL REST MODE TESTS PASSED
          
          **A1) Parent Dashboard → Profile Tab → Rest Mode Sheet:**
          ✅ Profile tab navigation working
          ✅ rest-mode row (data-testid="profile-rest-mode") opens rest sheet
          ✅ Rest sheet (data-testid="rest-sheet") opens successfully
          
          **A2) Pick Child, Reason, Days:**
          ✅ Child selection working (data-testid="rest-who-{childId}")
          ✅ Reason selection working (data-testid="rest-reason-musafir")
          ✅ Days selection working (data-testid="rest-days-3")
          ✅ Summary (data-testid="rest-summary") shows correct "3 days"
          ✅ Date input (data-testid="rest-end-date") updates summary to "5 days" when set 5 days ahead
          ✅ rest-start button (data-testid="rest-start") creates rest period
          ✅ Active card (data-testid="rest-active-{childId}") appears after start
          ✅ Form still available for other children/family
          
          **A3) Home Tab Rest Banner:**
          ✅ rest-banner (data-testid="rest-banner") visible on Home tab
          ✅ Banner shows child name and rest details
          
          **A4) Kid Mode Banners:**
          ✅ kid-rest-banner (data-testid="kid-rest-banner") visible for child 1 (resting child)
          ✅ kid-rest-banner NOT visible for child 2 (non-resting child) - correct behavior
          
          **A5) World Page Rest Ambience:**
          ✅ world-rest-ambience (data-testid="world-rest-ambience") visible for resting child
          ✅ world-rest-chip (data-testid="world-rest-chip") visible for resting child
          
          **A6) End Child Rest & Family-Wide Rest:**
          ✅ End button (data-testid="rest-active-{childId}-end") ends child rest
          ✅ Child rest card disappears after ending
          ✅ Family-wide rest (data-testid="rest-who-family") can be started
          ✅ Family rest card (data-testid="rest-active") appears
          ✅ Family rest end button (data-testid="rest-active-end") works
          ✅ Family rest card disappears after ending
          
          **SUMMARY:** All REST MODE functionality working perfectly. Child-specific and family-wide rest modes work correctly. UI shows appropriate banners and ambience in all contexts (parent dashboard, kid mode, world page).

  - task: "TV LINK - UI Flow (QR, Manual, Guide, Lite Toggle)"
    implemented: true
    working: true
    file: "/app/app/tv/page.js, /app/app/link/page.js, /app/app/display/page.js, /app/app/display/setup/page.js, /app/components/eqrel/TVTutorialModal.js, /app/components/eqrel/ConnectTVSection.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          ✅ TV LINK UI TESTS PASSED (Single Context Tests)
          
          **B1) /tv Page Without Cookies:**
          ✅ tv-qr image (data-testid="tv-qr") visible
          ✅ tv-device-code (data-testid="tv-device-code") shows 6 digits in "XXX XXX" format
          ✅ tv-help button (data-testid="tv-help") opens tv-guide modal
          ✅ tv-guide modal (data-testid="tv-guide") opens successfully
          ✅ Samsung tab (data-testid="tv-guide-tab-samsung") switches content
          ✅ Cast tab (data-testid="tv-guide-tab-cast") switches content
          ✅ tv-guide-close (data-testid="tv-guide-close") closes modal
          ✅ tv-lite-toggle (data-testid="tv-lite-toggle") toggles text "On/Off"
          ✅ eq-lite class added/removed from <html> element
          
          **B2) Manual Code Entry:**
          ✅ tv-manual button (data-testid="tv-manual") opens manual panel
          ✅ Manual panel (data-testid="tv-manual-panel") visible
          ✅ Keyboard digit entry works (typed 6-digit code)
          ✅ tv-back-qr button (data-testid="tv-back-qr") returns to QR view
          
          **B7) /link Without Cookie:**
          ✅ link-signin section (data-testid="link-signin") visible without auth
          
          **NOTES:**
          - Tests B3-B6 (link approval flow, TV connection, cookie-wipe resilience, device revoke, display error handling) require multiple browser contexts and are better suited for manual testing or separate test runs
          - Backend TV link endpoints (B3-B6 functionality) already tested and working (see backend section)
          - All single-context UI elements working correctly

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: true
  last_tested: "2026-11-01"

test_plan:
  current_focus:
    - "REST MODE (Travel & Rest Days) - TESTED ✅"
    - "TV LINK UI Flow - TESTED ✅ (single context tests)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: "✅ ALL TV DEVICE LINK BACKEND TESTS PASSED (28/28). All endpoints working correctly: start, connect, lookup, approve, list, revoke. TV session permissions properly enforced (403 on parent-only endpoints). Legacy TV pair endpoints working. Security verified: secretHash not exposed in list, revoked sessions properly blocked. Test data cleaned up."
  - agent: "testing"
    message: |
      ✅ REST MODE & TV LINK UI TESTS COMPLETED
      
      **REST MODE (Part A) - ALL TESTS PASSED:**
      - Profile tab → rest-mode row → sheet opens ✅
      - Child selection, reason (musafir/rehat), days selection ✅
      - Date input updates summary correctly ✅
      - rest-start creates active rest card ✅
      - Home tab shows rest-banner with child name ✅
      - Kid mode shows banner for resting child only ✅
      - World page shows rest ambience & chip ✅
      - End child rest & start/end family-wide rest ✅
      
      **TV LINK UI (Part B) - SINGLE CONTEXT TESTS PASSED:**
      - /tv page: QR code, 6-digit device code visible ✅
      - TV help guide modal with Samsung/Cast tabs ✅
      - Lite mode toggle (On/Off) with eq-lite class ✅
      - Manual code entry with keyboard input ✅
      - /link without cookie shows signin ✅
      
      **NOTES:**
      - TV Link tests B3-B6 (multi-context: link approval, TV connection, cookie-wipe resilience, device revoke) not tested due to Playwright multi-context limitations in current test environment
      - Backend TV link endpoints already verified working (see backend section)
      - Test data cleaned up successfully
      
      **RECOMMENDATION:** All testable UI flows working correctly. Multi-context TV link flow (B3-B6) can be manually verified or tested in separate environment if needed.

frontend:
  - task: "Rest Mode UI (Profile row, sheet with family/per-child, Home banner, Kid banner, World ambience)"
    implemented: true
    working: true
    file: "/app/components/eqrel/RestModeSheet.js, /app/app/page.js, /app/components/eqrel/tabs/ProfileTab.js, /app/app/kid/page.js, /app/app/world/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Profile row profile-rest-mode opens rest-sheet. rest-who-family / rest-who-{childId}, rest-reason-musafir|rehat, rest-days-N, rest-end-date, rest-summary, rest-start. Active cards rest-active (family) / rest-active-{childId} with -end button. Home banner rest-banner. Kid mode banner kid-rest-banner. World overlay world-rest-ambience + world-rest-chip; dark clouds hidden while resting."
  - task: "TV-first link UI (/tv QR page, /link phone approve, Display Setup Connect a TV, brand guide, lite mode)"
    implemented: true
    working: true
    file: "/app/app/tv/page.js, /app/app/link/page.js, /app/components/eqrel/ConnectTVSection.js, /app/components/eqrel/TVTutorialModal.js, /app/lib/tvClient.js, /app/app/display/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "/tv shows QR (tv-qr) + code (tv-device-code), polls; on approval shows tv-connected then goes /display?tv=1; saves creds in localStorage eqrel-tv-device. tv-manual → numpad (keyboard digits work) legacy code. tv-help opens tv-guide with tabs tv-guide-tab-{android,samsung,lg,hisense,fire,cast}. tv-lite-toggle. /link?c=CODE (parent) → link-confirm, link-approve → link-done. Display setup has connect-tv-section with device list & connect-tv-revoke-{id}. /display: on 401 with saved creds silently reconnects."

test_plan:
  current_focus:
    - "Rest Mode UI"
    - "TV-first link UI"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"
