#!/usr/bin/env python3
"""
Backend Test: Building Overlap Prevention with New tileSize Footprints

Tests the behavior change where POST /api/world/:childId/build and POST /api/world/:childId/move
now use BUILDING_TEMPLATES.tileSize to check overlap:
- rumah_kayu → 1×1
- rumah_batu → 2×2 (new)
- banglo → 2×2 (new)

Test scenarios:
1. Fresh world with Musalla. Build a banglo at (10, 10) → 200 OK. 
   Now build a rumah_kayu at (11, 10) → should FAIL 400 because banglo occupies (10-11, 10-11). 
   Build rumah_kayu at (12, 10) → 200 OK.

2. Build rumah_batu at (10, 20) → 200 OK. Build banglo at (11, 20) → should FAIL 400 (overlap). 
   Build banglo at (12, 20) → 200 OK.

3. Move overlap: Build banglo at (13, 10) succeeds. Move a rumah_kayu into (13, 11) → 
   should FAIL 400 (banglo footprint 13-14, 10-11).

4. Verify smaller building still works: rumah_kayu at (10, 30), rumah_kayu at (11, 30) → 
   both 200 OK (no overlap since 1×1 each).

5. Regression: musalla 8×8 reserved zone still enforced; upgrade endpoint still rejects 
   non-musalla with 400.
"""

import sys
import os
import requests
import json
import subprocess
from datetime import datetime

# Read base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

def seed_test_family():
    """Seed test family using the seed script"""
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                          capture_output=True, text=True, check=True)
    # Parse environment variables from output
    env_vars = {}
    for line in result.stdout.strip().split('\n'):
        if '=' in line:
            key, value = line.split('=', 1)
            env_vars[key] = value
    
    return {
        'session_cookie': f"eqrel_session={env_vars['COOKIE']}",
        'family_id': env_vars['FAMILY_ID'],
        'user_id': env_vars['USER_ID'],
        'child_id': env_vars['CHILD_ID_1'],
        'session_id': env_vars['SESSION_ID']
    }

def cleanup_test_family(family_data):
    """Cleanup test family using the cleanup script"""
    env = os.environ.copy()
    env['FAMILY_ID'] = family_data['family_id']
    env['USER_ID'] = family_data['user_id']
    env['SESSION_ID'] = family_data['session_id']
    subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                  env=env, check=True)

def print_test(msg):
    """Print test message"""
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(passed, msg):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {msg}")
    return passed

def test_building_overlap_prevention():
    """Test building overlap prevention with new tileSize footprints"""
    
    print("\n" + "="*80)
    print("BUILDING OVERLAP PREVENTION TEST SUITE")
    print("Testing new tileSize footprints: rumah_kayu 1×1, rumah_batu 2×2, banglo 2×2")
    print("="*80)
    
    # Setup test family
    print("\n📦 Setting up test family...")
    family_data = seed_test_family()
    session_cookie = family_data['session_cookie']
    child_id = family_data['child_id']
    
    headers = {'Cookie': session_cookie, 'Content-Type': 'application/json'}
    
    all_passed = True
    test_count = 0
    passed_count = 0
    
    try:
        # ═══════════════════════════════════════════════════════════════
        # SCENARIO 1: Banglo 2×2 overlap prevention
        # ═══════════════════════════════════════════════════════════════
        print_test("SCENARIO 1: Banglo 2×2 overlap prevention")
        
        # First, build Musalla at (17, 17) - required for world
        test_count += 1
        print("\n1.1: Build Musalla at (17, 17)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build", 
                         headers=headers,
                         json={'templateId': 'musalla', 'x': 17, 'y': 17})
        if print_result(r.status_code == 200, f"Musalla built successfully (status {r.status_code})"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Build banglo at (10, 10) - should succeed
        test_count += 1
        print("\n1.2: Build banglo at (10, 10) → should succeed (200 OK)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'banglo', 'x': 10, 'y': 10})
        if print_result(r.status_code == 200, f"Banglo built successfully at (10, 10) - occupies (10-11, 10-11)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Try to build rumah_kayu at (11, 10) - should FAIL (overlaps banglo)
        test_count += 1
        print("\n1.3: Build rumah_kayu at (11, 10) → should FAIL 400 (overlaps banglo footprint)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 11, 'y': 10})
        if print_result(r.status_code in [400, 409], f"Correctly rejected overlap (status {r.status_code})"):
            passed_count += 1
            resp = r.json()
            print(f"   Error message: {resp.get('error', 'N/A')}")
        else:
            print(f"   ❌ Expected 400/409, got {r.status_code}")
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Build rumah_kayu at (12, 10) - should succeed (no overlap)
        test_count += 1
        print("\n1.4: Build rumah_kayu at (12, 10) → should succeed (200 OK, no overlap)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 12, 'y': 10})
        if print_result(r.status_code == 200, f"rumah_kayu built successfully at (12, 10)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # ═══════════════════════════════════════════════════════════════
        # SCENARIO 2: rumah_batu 2×2 overlap prevention
        # ═══════════════════════════════════════════════════════════════
        print_test("SCENARIO 2: rumah_batu 2×2 overlap prevention")
        
        # Build rumah_batu at (10, 20) - should succeed
        test_count += 1
        print("\n2.1: Build rumah_batu at (10, 20) → should succeed (200 OK)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_batu', 'x': 10, 'y': 20})
        if print_result(r.status_code == 200, f"rumah_batu built successfully at (10, 20) - occupies (10-11, 20-21)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Try to build banglo at (11, 20) - should FAIL (overlaps rumah_batu)
        test_count += 1
        print("\n2.2: Build banglo at (11, 20) → should FAIL 400 (overlaps rumah_batu footprint)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'banglo', 'x': 11, 'y': 20})
        if print_result(r.status_code in [400, 409], f"Correctly rejected overlap (status {r.status_code})"):
            passed_count += 1
            resp = r.json()
            print(f"   Error message: {resp.get('error', 'N/A')}")
        else:
            print(f"   ❌ Expected 400/409, got {r.status_code}")
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Build banglo at (12, 20) - should succeed (no overlap)
        test_count += 1
        print("\n2.3: Build banglo at (12, 20) → should succeed (200 OK, no overlap)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'banglo', 'x': 12, 'y': 20})
        if print_result(r.status_code == 200, f"banglo built successfully at (12, 20)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # ═══════════════════════════════════════════════════════════════
        # SCENARIO 3: Move overlap prevention
        # ═══════════════════════════════════════════════════════════════
        print_test("SCENARIO 3: Move overlap prevention with 2×2 buildings")
        
        # Build banglo at (13, 10) - should succeed
        test_count += 1
        print("\n3.1: Build banglo at (13, 10) → should succeed (200 OK)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'banglo', 'x': 13, 'y': 10})
        banglo_id = None
        if print_result(r.status_code == 200, f"banglo built successfully at (13, 10) - occupies (13-14, 10-11)"):
            passed_count += 1
            resp = r.json()
            banglo_id = resp.get('building', {}).get('id')
            print(f"   Banglo ID: {banglo_id}")
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Build rumah_kayu at (15, 10) - should succeed (far from banglo)
        test_count += 1
        print("\n3.2: Build rumah_kayu at (15, 10) → should succeed (200 OK)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 15, 'y': 10})
        rumah_id = None
        if print_result(r.status_code == 200, f"rumah_kayu built successfully at (15, 10)"):
            passed_count += 1
            resp = r.json()
            rumah_id = resp.get('building', {}).get('id')
            print(f"   rumah_kayu ID: {rumah_id}")
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Try to move rumah_kayu to (13, 11) - should FAIL (overlaps banglo footprint)
        if rumah_id:
            test_count += 1
            print("\n3.3: Move rumah_kayu to (13, 11) → should FAIL 400 (overlaps banglo footprint 13-14, 10-11)")
            r = requests.post(f"{API_BASE}/world/{child_id}/move",
                             headers=headers,
                             json={'buildingId': rumah_id, 'x': 13, 'y': 11})
            if print_result(r.status_code in [400, 409], f"Correctly rejected move overlap (status {r.status_code})"):
                passed_count += 1
                resp = r.json()
                print(f"   Error message: {resp.get('error', 'N/A')}")
            else:
                print(f"   ❌ Expected 400/409, got {r.status_code}")
                print(f"   Response: {r.text}")
                all_passed = False
        
        # Move rumah_kayu to (15, 11) - should succeed (no overlap)
        if rumah_id:
            test_count += 1
            print("\n3.4: Move rumah_kayu to (15, 11) → should succeed (200 OK, no overlap)")
            r = requests.post(f"{API_BASE}/world/{child_id}/move",
                             headers=headers,
                             json={'buildingId': rumah_id, 'x': 15, 'y': 11})
            if print_result(r.status_code == 200, f"rumah_kayu moved successfully to (15, 11)"):
                passed_count += 1
            else:
                print(f"   Response: {r.text}")
                all_passed = False
        
        # ═══════════════════════════════════════════════════════════════
        # SCENARIO 4: Verify smaller 1×1 buildings still work
        # ═══════════════════════════════════════════════════════════════
        print_test("SCENARIO 4: Verify smaller 1×1 buildings still work")
        
        # Build rumah_kayu at (10, 30) - should succeed
        test_count += 1
        print("\n4.1: Build rumah_kayu at (10, 30) → should succeed (200 OK)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 10, 'y': 30})
        if print_result(r.status_code == 200, f"rumah_kayu built successfully at (10, 30) - occupies only (10, 30)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Build rumah_kayu at (11, 30) - should succeed (no overlap, both 1×1)
        test_count += 1
        print("\n4.2: Build rumah_kayu at (11, 30) → should succeed (200 OK, no overlap since both 1×1)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 11, 'y': 30})
        if print_result(r.status_code == 200, f"rumah_kayu built successfully at (11, 30)"):
            passed_count += 1
        else:
            print(f"   Response: {r.text}")
            all_passed = False
        
        # ═══════════════════════════════════════════════════════════════
        # SCENARIO 5: Regression tests
        # ═══════════════════════════════════════════════════════════════
        print_test("SCENARIO 5: Regression tests - Musalla 8×8 reserved zone + upgrade restrictions")
        
        # Try to build rumah_kayu at (18, 18) - should FAIL (inside Musalla's 8×8 reserved zone)
        # Musalla at (17, 17) reserves (17-24, 17-24) = 8×8 zone
        test_count += 1
        print("\n5.1: Build rumah_kayu at (18, 18) → should FAIL 400 (inside Musalla's 8×8 reserved zone)")
        r = requests.post(f"{API_BASE}/world/{child_id}/build",
                         headers=headers,
                         json={'templateId': 'rumah_kayu', 'x': 18, 'y': 18})
        if print_result(r.status_code in [400, 409], f"Correctly rejected (status {r.status_code}) - Musalla 8×8 zone enforced"):
            passed_count += 1
            resp = r.json()
            print(f"   Error message: {resp.get('error', 'N/A')}")
        else:
            print(f"   ❌ Expected 400/409, got {r.status_code}")
            print(f"   Response: {r.text}")
            all_passed = False
        
        # Try to upgrade a non-musalla building - should FAIL 400
        # Get the world state to find a non-musalla building
        test_count += 1
        print("\n5.2: Try to upgrade non-musalla building → should FAIL 400 (only Musalla can upgrade)")
        r_world = requests.get(f"{API_BASE}/world/{child_id}", headers=headers)
        if r_world.status_code == 200:
            world = r_world.json().get('world', {})
            buildings = world.get('buildings', [])
            non_musalla = next((b for b in buildings if b['templateId'] != 'musalla'), None)
            
            if non_musalla:
                r = requests.post(f"{API_BASE}/world/{child_id}/upgrade",
                                 headers=headers,
                                 json={'buildingId': non_musalla['id']})
                if print_result(r.status_code == 400, f"Correctly rejected non-musalla upgrade (status {r.status_code})"):
                    passed_count += 1
                    resp = r.json()
                    expected_msg = "Only Musalla can be upgraded"
                    actual_msg = resp.get('error', '')
                    if expected_msg in actual_msg:
                        print(f"   ✅ Correct error message: '{actual_msg}'")
                    else:
                        print(f"   ⚠️  Error message: '{actual_msg}' (expected '{expected_msg}')")
                else:
                    print(f"   ❌ Expected 400, got {r.status_code}")
                    print(f"   Response: {r.text}")
                    all_passed = False
            else:
                print("   ⚠️  No non-musalla building found to test upgrade rejection")
        else:
            print(f"   ⚠️  Could not fetch world state (status {r_world.status_code})")
        
        # Verify Musalla can still be upgraded (with sufficient rumah)
        test_count += 1
        print("\n5.3: Verify Musalla upgrade still works (regression check)")
        # Build 7 rumah_kayu to meet L2 upgrade requirement
        print("   Building 7 rumah_kayu to meet upgrade requirement...")
        rumah_positions = [(25, 10), (25, 11), (25, 12), (25, 13), (25, 14), (25, 15), (25, 16)]
        for i, (rx, ry) in enumerate(rumah_positions):
            r = requests.post(f"{API_BASE}/world/{child_id}/build",
                             headers=headers,
                             json={'templateId': 'rumah_kayu', 'x': rx, 'y': ry})
            if r.status_code != 200:
                print(f"   ⚠️  Failed to build rumah {i+1} at ({rx}, {ry}): {r.status_code}")
        
        # Get Musalla building ID
        r_world = requests.get(f"{API_BASE}/world/{child_id}", headers=headers)
        if r_world.status_code == 200:
            world = r_world.json().get('world', {})
            buildings = world.get('buildings', [])
            musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
            
            if musalla:
                # Try to upgrade Musalla
                r = requests.post(f"{API_BASE}/world/{child_id}/upgrade",
                                 headers=headers,
                                 json={'buildingId': musalla['id']})
                if print_result(r.status_code == 200, f"Musalla upgrade still works (status {r.status_code})"):
                    passed_count += 1
                else:
                    print(f"   Response: {r.text}")
                    all_passed = False
            else:
                print("   ⚠️  Musalla not found in world")
        else:
            print(f"   ⚠️  Could not fetch world state (status {r_world.status_code})")
        
        # ═══════════════════════════════════════════════════════════════
        # SUMMARY
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total tests: {test_count}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {test_count - passed_count}")
        print(f"Success rate: {(passed_count/test_count*100):.1f}%")
        
        if all_passed and passed_count == test_count:
            print("\n🎉 ALL TESTS PASSED!")
            print("\nKey findings:")
            print("✅ banglo 2×2 footprint correctly enforced")
            print("✅ rumah_batu 2×2 footprint correctly enforced")
            print("✅ rumah_kayu 1×1 footprint correctly enforced")
            print("✅ Build endpoint prevents overlap with 2×2 buildings")
            print("✅ Move endpoint prevents overlap with 2×2 buildings")
            print("✅ 1×1 buildings can be placed adjacent to each other")
            print("✅ Musalla 8×8 reserved zone still enforced (regression)")
            print("✅ Non-musalla upgrade rejection still works (regression)")
            print("✅ Musalla upgrade still works (regression)")
        else:
            print("\n❌ SOME TESTS FAILED")
            print(f"\n{test_count - passed_count} test(s) need attention.")
        
        print("="*80)
        
    finally:
        # Cleanup
        print("\n🧹 Cleaning up test data...")
        cleanup_test_family(family_data)
        print("✅ Cleanup complete")
    
    return all_passed

if __name__ == '__main__':
    try:
        success = test_building_overlap_prevention()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test suite failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
