#!/usr/bin/env python3
"""
Backend test for World Engine upgrade behavior changes (2026-07-25):
1. Musalla upgrade thresholds unchanged (regression check): L1→L2 needs 7 rumah; L2→L3 needs 15 rumah
2. NEW: Non-musalla buildings CANNOT upgrade via POST /api/world/:childId/upgrade
   Expected: 400 error with message "Only Musalla can be upgraded"

Test scenarios:
1. Use seed_test_family.py to seed. Auth via eqrel_session cookie.
2. Fresh world → build a Musalla (auto seeded) + 1 rumah_kayu.
3. Try to upgrade rumah_kayu → expect 400 with "Only Musalla can be upgraded".
4. Try to upgrade banglo, kebun_kurma, kandang_lembu — all expected 400.
5. Musalla upgrade L1→L2 with 6 rumah → 400 (need 7). With 7 rumah → 200.

Cleanup: Run cleanup_test_family.py at the end.
"""

import os
import sys
import subprocess
import requests
import json

# Get base URL from env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f'{BASE_URL}/api'

def run_seed_script():
    """Run seed_test_family.py and parse output"""
    print("\n" + "="*80)
    print("SETUP: Running seed_test_family.py...")
    print("="*80)
    result = subprocess.run(
        ['python3', '/app/scripts/seed_test_family.py'],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Seed script failed: {result.stderr}")
        sys.exit(1)
    
    # Parse output
    data = {}
    for line in result.stdout.strip().split('\n'):
        if '=' in line:
            key, value = line.split('=', 1)
            data[key] = value
    
    print(f"✅ Seed complete: Family {data['FAMILY_ID']}, Child {data['CHILD_ID_1']}")
    return data

def run_cleanup_script():
    """Run cleanup_test_family.py"""
    print("\n" + "="*80)
    print("CLEANUP: Running cleanup_test_family.py...")
    print("="*80)
    result = subprocess.run(
        ['python3', '/app/scripts/cleanup_test_family.py'],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"⚠️ Cleanup script had issues: {result.stderr}")
    else:
        print("✅ Cleanup complete")

def test_world_upgrade_behavior():
    """Main test function"""
    
    # Seed test family
    seed_data = run_seed_script()
    cookie = seed_data['COOKIE']
    child_id = seed_data['CHILD_ID_1']
    
    headers = {
        'Cookie': f'eqrel_session={cookie}',
        'Content-Type': 'application/json'
    }
    
    test_results = []
    
    try:
        # ====================================================================
        # TEST 1: Build Musalla at (17,17)
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 1: Build Musalla at (17,17)")
        print("="*80)
        
        # Build Musalla (world starts empty, no auto-seed)
        resp = requests.post(
            f'{API_BASE}/world/{child_id}/build',
            headers=headers,
            json={'templateId': 'musalla', 'x': 17, 'y': 17}
        )
        print(f"POST /api/world/{child_id}/build (musalla) → {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to build Musalla: {resp.text}")
            test_results.append(('TEST 1: Build Musalla', False, f'Status {resp.status_code}'))
            musalla = None
        else:
            result = resp.json()
            musalla = result['building']
            print(f"✅ Musalla built at ({musalla['x']}, {musalla['y']}) level {musalla.get('level', 1)}")
            test_results.append(('TEST 1: Build Musalla', True, f"Musalla L{musalla.get('level', 1)} at ({musalla['x']}, {musalla['y']})"))
        
        # ====================================================================
        # TEST 2: Build 1 rumah_kayu (far from Musalla sacred zone)
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 2: Build 1 rumah_kayu")
        print("="*80)
        
        resp = requests.post(
            f'{API_BASE}/world/{child_id}/build',
            headers=headers,
            json={'templateId': 'rumah_kayu', 'x': 10, 'y': 10}
        )
        print(f"POST /api/world/{child_id}/build (rumah_kayu) → {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to build rumah_kayu: {resp.text}")
            test_results.append(('TEST 2: Build rumah_kayu', False, f'Status {resp.status_code}'))
            rumah_kayu_id = None
        else:
            result = resp.json()
            rumah_kayu_id = result['building']['id']
            print(f"✅ rumah_kayu built with ID {rumah_kayu_id}")
            test_results.append(('TEST 2: Build rumah_kayu', True, f'ID {rumah_kayu_id}'))
        
        # ====================================================================
        # TEST 3: Try to upgrade rumah_kayu → expect 400 "Only Musalla can be upgraded"
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 3: Try to upgrade rumah_kayu → expect 400")
        print("="*80)
        
        if rumah_kayu_id:
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/upgrade',
                headers=headers,
                json={'buildingId': rumah_kayu_id}
            )
            print(f"POST /api/world/{child_id}/upgrade (rumah_kayu) → {resp.status_code}")
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                print(f"✅ Got expected 400 error: {error_msg}")
                if 'Only Musalla can be upgraded' in error_msg:
                    print(f"✅ Error message correct: '{error_msg}'")
                    test_results.append(('TEST 3: Upgrade rumah_kayu blocked', True, error_msg))
                else:
                    print(f"⚠️ Error message unexpected: '{error_msg}'")
                    test_results.append(('TEST 3: Upgrade rumah_kayu blocked', False, f'Wrong error: {error_msg}'))
            else:
                print(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
                test_results.append(('TEST 3: Upgrade rumah_kayu blocked', False, f'Status {resp.status_code}'))
        else:
            print("⚠️ Skipping test (rumah_kayu not built)")
            test_results.append(('TEST 3: Upgrade rumah_kayu blocked', False, 'Skipped - no rumah_kayu'))
        
        # ====================================================================
        # TEST 4: Build banglo, kebun_kurma, kandang_lembu
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 4: Build banglo, kebun_kurma, kandang_lembu")
        print("="*80)
        
        other_buildings = []
        for template_id, pos in [('banglo', (11, 10)), ('kebun_kurma', (12, 10)), ('kandang_lembu', (13, 10))]:
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/build',
                headers=headers,
                json={'templateId': template_id, 'x': pos[0], 'y': pos[1]}
            )
            print(f"POST /api/world/{child_id}/build ({template_id}) → {resp.status_code}")
            
            if resp.status_code == 200:
                result = resp.json()
                building_id = result['building']['id']
                other_buildings.append((template_id, building_id))
                print(f"✅ {template_id} built with ID {building_id}")
            else:
                print(f"❌ Failed to build {template_id}: {resp.text}")
        
        test_results.append(('TEST 4: Build other buildings', len(other_buildings) == 3, f'{len(other_buildings)}/3 built'))
        
        # ====================================================================
        # TEST 5: Try to upgrade banglo, kebun_kurma, kandang_lembu → all expect 400
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 5: Try to upgrade banglo, kebun_kurma, kandang_lembu → all expect 400")
        print("="*80)
        
        upgrade_blocked_count = 0
        for template_id, building_id in other_buildings:
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/upgrade',
                headers=headers,
                json={'buildingId': building_id}
            )
            print(f"POST /api/world/{child_id}/upgrade ({template_id}) → {resp.status_code}")
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                if 'Only Musalla can be upgraded' in error_msg:
                    print(f"✅ {template_id} upgrade blocked correctly: {error_msg}")
                    upgrade_blocked_count += 1
                else:
                    print(f"⚠️ {template_id} got 400 but wrong error: {error_msg}")
            else:
                print(f"❌ {template_id} expected 400, got {resp.status_code}: {resp.text}")
        
        test_results.append(('TEST 5: Non-musalla upgrades blocked', upgrade_blocked_count == 3, f'{upgrade_blocked_count}/3 blocked'))
        
        # ====================================================================
        # TEST 6: Musalla upgrade L1→L2 with 6 rumah → expect 400 (need 7)
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 6: Musalla upgrade L1→L2 with 6 rumah → expect 400 (need 7)")
        print("="*80)
        
        if not musalla:
            print("⚠️ Skipping test (Musalla not built)")
            test_results.append(('TEST 6: Musalla upgrade with 6 rumah blocked', False, 'Skipped - no Musalla'))
        else:
            # We have 1 rumah_kayu + 1 banglo = 2 rumah. Build 4 more to get 6 total.
            for i in range(4):
                resp = requests.post(
                    f'{API_BASE}/world/{child_id}/build',
                    headers=headers,
                    json={'templateId': 'rumah_kayu', 'x': 10, 'y': 11 + i}
                )
                if resp.status_code == 200:
                    print(f"✅ Built rumah_kayu #{i+3}")
                else:
                    print(f"❌ Failed to build rumah_kayu #{i+3}: {resp.text}")
            
            # Now we have 6 rumah (1 initial + 1 banglo + 4 new = 6)
            # Try to upgrade Musalla
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/upgrade',
                headers=headers,
                json={'buildingId': musalla['id']}
            )
            print(f"POST /api/world/{child_id}/upgrade (Musalla with 6 rumah) → {resp.status_code}")
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                print(f"✅ Got expected 400 error: {error_msg}")
                if 'Need 7 rumah' in error_msg:
                    print(f"✅ Error message correct: '{error_msg}'")
                    test_results.append(('TEST 6: Musalla upgrade with 6 rumah blocked', True, error_msg))
                else:
                    print(f"⚠️ Error message unexpected: '{error_msg}'")
                    test_results.append(('TEST 6: Musalla upgrade with 6 rumah blocked', False, f'Wrong error: {error_msg}'))
            else:
                print(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
                test_results.append(('TEST 6: Musalla upgrade with 6 rumah blocked', False, f'Status {resp.status_code}'))
        
        # ====================================================================
        # TEST 7: Build 1 more rumah to get 7 total, then upgrade Musalla L1→L2 → expect 200
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 7: Build 7th rumah, then upgrade Musalla L1→L2 → expect 200")
        print("="*80)
        
        resp = requests.post(
            f'{API_BASE}/world/{child_id}/build',
            headers=headers,
            json={'templateId': 'rumah_kayu', 'x': 11, 'y': 11}
        )
        if resp.status_code == 200:
            print(f"✅ Built 7th rumah_kayu")
        else:
            print(f"❌ Failed to build 7th rumah_kayu: {resp.text}")
        
        # Now we have 7 rumah. Try to upgrade Musalla.
        resp = requests.post(
            f'{API_BASE}/world/{child_id}/upgrade',
            headers=headers,
            json={'buildingId': musalla['id']}
        )
        print(f"POST /api/world/{child_id}/upgrade (Musalla with 7 rumah) → {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Musalla upgraded to L2 (Masjid) successfully")
            test_results.append(('TEST 7: Musalla L1→L2 with 7 rumah', True, 'Upgraded to L2'))
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            test_results.append(('TEST 7: Musalla L1→L2 with 7 rumah', False, f'Status {resp.status_code}'))
        
        # ====================================================================
        # TEST 8: Verify Musalla is now L2
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 8: Verify Musalla is now L2")
        print("="*80)
        
        resp = requests.get(f'{API_BASE}/world/{child_id}', headers=headers)
        print(f"DEBUG: GET /api/world/{child_id} → {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            world = data.get('world', data)  # Handle both formats
            print(f"DEBUG: World keys: {list(world.keys())}")
            print(f"DEBUG: World ID: {world.get('id')}, childId: {world.get('childId')}")
            buildings = world.get('buildings', [])
            print(f"DEBUG: Found {len(buildings)} buildings in world")
            for b in buildings:
                print(f"  - {b['templateId']} at ({b['x']}, {b['y']}) level {b.get('level', 1)}")
            musalla_updated = next((b for b in buildings if b['templateId'] == 'musalla'), None)
            
            if musalla_updated and musalla_updated.get('level') == 2:
                print(f"✅ Musalla is now L2 (Masjid)")
                test_results.append(('TEST 8: Verify Musalla L2', True, 'Level 2 confirmed'))
                musalla = musalla_updated  # Update musalla reference for next tests
            else:
                print(f"❌ Musalla level is {musalla_updated.get('level') if musalla_updated else 'N/A'}, expected 2")
                test_results.append(('TEST 8: Verify Musalla L2', False, f'Level {musalla_updated.get("level") if musalla_updated else "N/A"}'))
                musalla = musalla_updated  # Update musalla reference even if level is wrong
        else:
            print(f"❌ Failed to load world: {resp.text}")
            test_results.append(('TEST 8: Verify Musalla L2', False, f'Status {resp.status_code}'))
        
        # ====================================================================
        # TEST 9: Musalla upgrade L2→L3 with 14 rumah → expect 400 (need 15)
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 9: Musalla upgrade L2→L3 with 14 rumah → expect 400 (need 15)")
        print("="*80)
        
        if not musalla:
            print("⚠️ Skipping test (Musalla not found)")
            test_results.append(('TEST 9: Musalla upgrade with 14 rumah blocked', False, 'Skipped - no Musalla'))
        else:
            # We have 7 rumah. Build 7 more to get 14 total.
            for i in range(7):
                resp = requests.post(
                    f'{API_BASE}/world/{child_id}/build',
                    headers=headers,
                    json={'templateId': 'rumah_kayu', 'x': 11 + i, 'y': 12}
                )
                if resp.status_code == 200:
                    print(f"✅ Built rumah_kayu #{i+8}")
                else:
                    print(f"❌ Failed to build rumah_kayu #{i+8}: {resp.text}")
            
            # Now we have 14 rumah. Try to upgrade Musalla.
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/upgrade',
                headers=headers,
                json={'buildingId': musalla['id']}
            )
            print(f"POST /api/world/{child_id}/upgrade (Musalla with 14 rumah) → {resp.status_code}")
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                print(f"✅ Got expected 400 error: {error_msg}")
                if 'Need 15 rumah' in error_msg:
                    print(f"✅ Error message correct: '{error_msg}'")
                    test_results.append(('TEST 9: Musalla upgrade with 14 rumah blocked', True, error_msg))
                else:
                    print(f"⚠️ Error message unexpected: '{error_msg}'")
                    test_results.append(('TEST 9: Musalla upgrade with 14 rumah blocked', False, f'Wrong error: {error_msg}'))
            else:
                print(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
                test_results.append(('TEST 9: Musalla upgrade with 14 rumah blocked', False, f'Status {resp.status_code}'))
        
        # ====================================================================
        # TEST 10: Build 1 more rumah to get 15 total, then upgrade Musalla L2→L3 → expect 200
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 10: Build 15th rumah, then upgrade Musalla L2→L3 → expect 200")
        print("="*80)
        
        if not musalla:
            print("⚠️ Skipping test (Musalla not found)")
            test_results.append(('TEST 10: Musalla L2→L3 with 15 rumah', False, 'Skipped - no Musalla'))
        else:
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/build',
                headers=headers,
                json={'templateId': 'rumah_kayu', 'x': 11, 'y': 13}
            )
            if resp.status_code == 200:
                print(f"✅ Built 15th rumah_kayu")
            else:
                print(f"❌ Failed to build 15th rumah_kayu: {resp.text}")
            
            # Now we have 15 rumah. Try to upgrade Musalla.
            resp = requests.post(
                f'{API_BASE}/world/{child_id}/upgrade',
                headers=headers,
                json={'buildingId': musalla['id']}
            )
            print(f"POST /api/world/{child_id}/upgrade (Musalla with 15 rumah) → {resp.status_code}")
            
            if resp.status_code == 200:
                print(f"✅ Musalla upgraded to L3 (Jami' Masjid) successfully")
                test_results.append(('TEST 10: Musalla L2→L3 with 15 rumah', True, 'Upgraded to L3'))
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                test_results.append(('TEST 10: Musalla L2→L3 with 15 rumah', False, f'Status {resp.status_code}'))
        
        # ====================================================================
        # TEST 11: Verify Musalla is now L3
        # ====================================================================
        print("\n" + "="*80)
        print("TEST 11: Verify Musalla is now L3")
        print("="*80)
        
        resp = requests.get(f'{API_BASE}/world/{child_id}', headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            world = data.get('world', data)  # Handle both formats
            buildings = world.get('buildings', [])
            musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
            
            if musalla and musalla.get('level') == 3:
                print(f"✅ Musalla is now L3 (Jami' Masjid)")
                test_results.append(('TEST 11: Verify Musalla L3', True, 'Level 3 confirmed'))
            else:
                print(f"❌ Musalla level is {musalla.get('level') if musalla else 'N/A'}, expected 3")
                test_results.append(('TEST 11: Verify Musalla L3', False, f'Level {musalla.get("level") if musalla else "N/A"}'))
        else:
            print(f"❌ Failed to load world: {resp.text}")
            test_results.append(('TEST 11: Verify Musalla L3', False, f'Status {resp.status_code}'))
        
    finally:
        # Cleanup
        run_cleanup_script()
    
    # ====================================================================
    # SUMMARY
    # ====================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, success, _ in test_results if success)
    total = len(test_results)
    
    for test_name, success, details in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {details}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1

if __name__ == '__main__':
    sys.exit(test_world_upgrade_behavior())
