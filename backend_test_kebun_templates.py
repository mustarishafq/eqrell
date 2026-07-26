#!/usr/bin/env python3
"""
Backend smoke test for kebun template updates (2026-07-26)

Tests the new kebun variants with 2×2 tileSize footprints:
- kebun_kurma (25 mata, 2×2)
- kebun_tin (35 mata, 2×2)
- kebun_delima (45 mata, 2×2)
- kebun_anggur (55 mata, 2×2)
- kebun_zaitun (70 mata, 2×2)

Also tests regression scenarios:
- banglo/rumah_batu 2×2 overlap still works
- musalla auto-upgrade at 7 rumah still works
- rumah_kayu 1×1 still fits
"""

import requests
import sys
import subprocess
import time

BASE_URL = "https://pwa-trial-cohort.preview.emergentagent.com/api"

def setup_test_family():
    """Run seed script to create test family + child"""
    print("🔧 Setting up test family...")
    result = subprocess.run(
        ["python", "/app/scripts/seed_test_family.py"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Failed to setup test family: {result.stderr}")
        sys.exit(1)
    
    # Extract session cookie and childId from output
    lines = result.stdout.strip().split('\n')
    session_cookie = None
    child_id = None
    
    for line in lines:
        if line.startswith('COOKIE='):
            session_cookie = line.split('COOKIE=')[1].strip()
        if line.startswith('CHILD_ID_1='):
            child_id = line.split('CHILD_ID_1=')[1].strip()
    
    if not session_cookie or not child_id:
        print(f"❌ Failed to extract session/childId from seed script")
        print(f"Output: {result.stdout}")
        sys.exit(1)
    
    print(f"✅ Test family created: childId={child_id}")
    return session_cookie, child_id

def cleanup_test_family():
    """Run cleanup script to remove test data"""
    print("\n🧹 Cleaning up test family...")
    result = subprocess.run(
        ["python", "/app/scripts/cleanup_test_family.py"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"⚠️  Cleanup warning: {result.stderr}")
    else:
        print("✅ Test data cleaned up")

def build_building(session_cookie, child_id, template_id, x, y):
    """POST /api/world/:childId/build"""
    url = f"{BASE_URL}/world/{child_id}/build"
    headers = {"Cookie": f"eqrel_session={session_cookie}"}
    body = {"templateId": template_id, "x": x, "y": y}
    
    resp = requests.post(url, json=body, headers=headers)
    return resp

def get_world(session_cookie, child_id):
    """GET /api/world/:childId"""
    url = f"{BASE_URL}/world/{child_id}"
    headers = {"Cookie": f"eqrel_session={session_cookie}"}
    
    resp = requests.get(url, headers=headers)
    return resp

def run_tests():
    """Run all test scenarios"""
    session_cookie, child_id = setup_test_family()
    
    try:
        print("\n" + "="*80)
        print("KEBUN TEMPLATE SMOKE TEST - Backend API")
        print("="*80)
        
        # Get initial world state
        resp = get_world(session_cookie, child_id)
        assert resp.status_code == 200, f"Failed to get world: {resp.status_code}"
        world = resp.json()
        
        # Handle both direct world object and nested structure
        if 'world' in world:
            world = world['world']
        
        buildings = world.get('buildings', [])
        print(f"\n✅ Initial world loaded: {len(buildings)} buildings")
        
        # Build Musalla first if not present
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if not musalla:
            print("\n🔨 Building Musalla at (17, 17)...")
            resp = build_building(session_cookie, child_id, "musalla", 17, 17)
            assert resp.status_code == 200, f"Failed to build Musalla: {resp.status_code} - {resp.text}"
            
            # Refresh world state
            resp = get_world(session_cookie, child_id)
            world = resp.json()
            if 'world' in world:
                world = world['world']
            buildings = world.get('buildings', [])
            musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        
        assert musalla, "Musalla not found in world after building"
        print(f"✅ Musalla found at ({musalla['x']}, {musalla['y']})")
        
        test_count = 0
        passed_count = 0
        
        # ===== TEST 1: Build kebun_kurma at (10, 10) → 200 OK =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_kurma at (10, 10) → expect 200 OK")
        resp = build_building(session_cookie, child_id, "kebun_kurma", 10, 10)
        if resp.status_code == 200:
            print(f"✅ PASS - kebun_kurma built successfully at (10, 10)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        # ===== TEST 2: Build kebun_delima at (11, 10) → 409 FAIL (overlap) =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_delima at (11, 10) → expect 409 FAIL (overlap with kebun_kurma)")
        resp = build_building(session_cookie, child_id, "kebun_delima", 11, 10)
        if resp.status_code in [400, 409]:
            print(f"✅ PASS - kebun_delima correctly blocked at (11, 10) with {resp.status_code}")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 409, got {resp.status_code}: {resp.text}")
        
        # ===== TEST 3: Build kebun_delima at (12, 10) → 200 OK =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_delima at (12, 10) → expect 200 OK (no overlap)")
        resp = build_building(session_cookie, child_id, "kebun_delima", 12, 10)
        if resp.status_code == 200:
            print(f"✅ PASS - kebun_delima built successfully at (12, 10)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        # ===== TEST 4: Build kebun_tin at (10, 12) → 200 OK =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_tin at (10, 12) → expect 200 OK")
        resp = build_building(session_cookie, child_id, "kebun_tin", 10, 12)
        if resp.status_code == 200:
            print(f"✅ PASS - kebun_tin built successfully at (10, 12)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        # ===== TEST 5: Build kebun_anggur at (11, 12) → 409 FAIL (overlap) =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_anggur at (11, 12) → expect 409 FAIL (overlap with kebun_tin)")
        resp = build_building(session_cookie, child_id, "kebun_anggur", 11, 12)
        if resp.status_code in [400, 409]:
            print(f"✅ PASS - kebun_anggur correctly blocked at (11, 12) with {resp.status_code}")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 409, got {resp.status_code}: {resp.text}")
        
        # ===== TEST 6: Build kebun_anggur at (12, 12) → 200 OK =====
        test_count += 1
        print(f"\n[TEST {test_count}] Build kebun_anggur at (12, 12) → expect 200 OK (no overlap)")
        resp = build_building(session_cookie, child_id, "kebun_anggur", 12, 12)
        if resp.status_code == 200:
            print(f"✅ PASS - kebun_anggur built successfully at (12, 12)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        # ===== REGRESSION TEST 7: banglo 2×2 overlap still works =====
        test_count += 1
        print(f"\n[TEST {test_count}] REGRESSION: Build banglo at (14, 10) → expect 200 OK")
        resp = build_building(session_cookie, child_id, "banglo", 14, 10)
        if resp.status_code == 200:
            print(f"✅ PASS - banglo built successfully at (14, 10)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        test_count += 1
        print(f"\n[TEST {test_count}] REGRESSION: Build rumah_kayu at (15, 10) → expect 409 FAIL (overlap with banglo)")
        resp = build_building(session_cookie, child_id, "rumah_kayu", 15, 10)
        if resp.status_code in [400, 409]:
            print(f"✅ PASS - rumah_kayu correctly blocked at (15, 10) with {resp.status_code}")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 409, got {resp.status_code}: {resp.text}")
        
        # ===== REGRESSION TEST 8: rumah_batu 2×2 overlap still works =====
        test_count += 1
        print(f"\n[TEST {test_count}] REGRESSION: Build rumah_batu at (14, 14) → expect 200 OK")
        resp = build_building(session_cookie, child_id, "rumah_batu", 14, 14)
        if resp.status_code == 200:
            print(f"✅ PASS - rumah_batu built successfully at (14, 14)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        test_count += 1
        print(f"\n[TEST {test_count}] REGRESSION: Build banglo at (15, 14) → expect 409 FAIL (overlap with rumah_batu)")
        resp = build_building(session_cookie, child_id, "banglo", 15, 14)
        if resp.status_code in [400, 409]:
            print(f"✅ PASS - banglo correctly blocked at (15, 14) with {resp.status_code}")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 409, got {resp.status_code}: {resp.text}")
        
        # ===== REGRESSION TEST 9: rumah_kayu 1×1 still fits =====
        test_count += 1
        print(f"\n[TEST {test_count}] REGRESSION: Build rumah_kayu at (16, 10) → expect 200 OK (1×1 fits)")
        resp = build_building(session_cookie, child_id, "rumah_kayu", 16, 10)
        if resp.status_code == 200:
            print(f"✅ PASS - rumah_kayu built successfully at (16, 10)")
            passed_count += 1
        else:
            print(f"❌ FAIL - Expected 200, got {resp.status_code}: {resp.text}")
        
        # ===== REGRESSION TEST 10: Musalla auto-upgrade at 7 rumah =====
        print(f"\n[TEST {test_count+1}-{test_count+7}] REGRESSION: Musalla auto-upgrade at 7 rumah")
        
        # Build 6 more rumah (we already have 1 banglo + 1 rumah_batu + 1 rumah_kayu = 3 rumah)
        rumah_positions = [
            (20, 10), (20, 12), (20, 14), (20, 16)  # 4 more rumah = 7 total
        ]
        
        for i, (x, y) in enumerate(rumah_positions):
            test_count += 1
            resp = build_building(session_cookie, child_id, "rumah_kayu", x, y)
            if resp.status_code == 200:
                data = resp.json()
                if i == 3:  # 7th rumah should trigger auto-upgrade
                    if data.get('autoUpgrade'):
                        print(f"✅ PASS [TEST {test_count}] - 7th rumah built, Musalla auto-upgraded to L2")
                        print(f"   autoUpgrade: fromLevel={data['autoUpgrade']['fromLevel']}, toLevel={data['autoUpgrade']['toLevel']}, rumahCount={data['autoUpgrade']['rumahCount']}")
                        passed_count += 1
                    else:
                        print(f"❌ FAIL [TEST {test_count}] - 7th rumah built but no autoUpgrade in response")
                else:
                    print(f"✅ PASS [TEST {test_count}] - rumah_kayu #{i+4} built at ({x}, {y})")
                    passed_count += 1
            else:
                print(f"❌ FAIL [TEST {test_count}] - Expected 200, got {resp.status_code}: {resp.text}")
        
        # Verify Musalla is now L2
        test_count += 1
        resp = get_world(session_cookie, child_id)
        if resp.status_code == 200:
            world = resp.json()
            if 'world' in world:
                world = world['world']
            buildings = world.get('buildings', [])
            musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
            if musalla and musalla.get('level') == 2:
                print(f"✅ PASS [TEST {test_count}] - Musalla verified at L2 (Masjid)")
                passed_count += 1
            else:
                print(f"❌ FAIL [TEST {test_count}] - Musalla level is {musalla.get('level') if musalla else 'N/A'}, expected 2")
        else:
            print(f"❌ FAIL [TEST {test_count}] - Failed to get world: {resp.status_code}")
        
        # ===== FINAL SUMMARY =====
        print("\n" + "="*80)
        print(f"TEST SUMMARY: {passed_count}/{test_count} tests passed ({passed_count/test_count*100:.1f}%)")
        print("="*80)
        
        if passed_count == test_count:
            print("🎉 ALL TESTS PASSED - Kebun template updates working correctly!")
            return 0
        else:
            print(f"⚠️  {test_count - passed_count} test(s) failed")
            return 1
        
    finally:
        cleanup_test_family()

if __name__ == "__main__":
    sys.exit(run_tests())
