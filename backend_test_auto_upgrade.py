#!/usr/bin/env python3
"""
Backend test suite for Musalla Auto-Upgrade feature.

Tests the NEW behavior where building rumah automatically upgrades Musalla:
- 7th rumah: Musalla L1 → L2 (Masjid)
- 15th rumah: Musalla L2 → L3 (Jami' Masjid)

The build response includes autoUpgrade metadata when threshold is crossed.
"""
import os
import sys
import subprocess
import requests
import json
from time import sleep

# Get base URL from env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f'{BASE_URL}/api'

def run_seed():
    """Run seed script and return session cookie + child ID."""
    result = subprocess.run(
        ['python', '/app/scripts/seed_test_family.py'],
        capture_output=True, text=True, check=True
    )
    lines = result.stdout.strip().split('\n')
    data = {}
    for line in lines:
        if '=' in line:
            key, val = line.split('=', 1)
            data[key] = val
    return data['COOKIE'], data['CHILD_ID_1']

def run_cleanup():
    """Run cleanup script."""
    subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], check=True)

def build_rumah(cookie, child_id, template_id, x, y):
    """Build a rumah variant at (x, y)."""
    url = f'{API_BASE}/world/{child_id}/build'
    headers = {'Cookie': f'eqrel_session={cookie}', 'Content-Type': 'application/json'}
    body = {'templateId': template_id, 'x': x, 'y': y}
    resp = requests.post(url, headers=headers, json=body)
    return resp

def get_world(cookie, child_id):
    """Get world state."""
    url = f'{API_BASE}/world/{child_id}'
    headers = {'Cookie': f'eqrel_session={cookie}'}
    resp = requests.get(url, headers=headers)
    return resp

def upgrade_musalla(cookie, child_id, building_id):
    """Manually upgrade musalla (for regression test)."""
    url = f'{API_BASE}/world/{child_id}/upgrade'
    headers = {'Cookie': f'eqrel_session={cookie}', 'Content-Type': 'application/json'}
    body = {'buildingId': building_id}
    resp = requests.post(url, headers=headers, json=body)
    return resp

def upgrade_non_musalla(cookie, child_id, building_id):
    """Try to upgrade non-musalla building (should fail)."""
    url = f'{API_BASE}/world/{child_id}/upgrade'
    headers = {'Cookie': f'eqrel_session={cookie}', 'Content-Type': 'application/json'}
    body = {'buildingId': building_id}
    resp = requests.post(url, headers=headers, json=body)
    return resp

def main():
    print('=' * 80)
    print('MUSALLA AUTO-UPGRADE FEATURE TEST SUITE')
    print('=' * 80)
    print()
    
    # Setup
    print('Setting up test data...')
    cookie, child_id = run_seed()
    print(f'✓ Test family created (child: {child_id})')
    print()
    
    test_count = 0
    pass_count = 0
    
    try:
        # ================================================================
        # TEST 1: Fresh world with Musalla L1 (0 rumah)
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: Fresh world with Musalla L1 (0 rumah)')
        
        # Build Musalla first
        resp = build_rumah(cookie, child_id, 'musalla', 17, 17)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build Musalla (status {resp.status_code})')
            print(f'     Response: {resp.text}')
        else:
            data = resp.json()
            if data.get('autoUpgrade') is not None:
                print(f'  ❌ FAIL: autoUpgrade should be null for Musalla build')
                print(f'     Got: {data.get("autoUpgrade")}')
            else:
                print(f'  ✅ PASS: Musalla built, autoUpgrade=null')
                pass_count += 1
        
        # Verify world state
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 1:
            print(f'  ✅ Musalla level is 1 (correct)')
        else:
            print(f'  ❌ Musalla level is not 1: {musalla}')
        print()
        
        # ================================================================
        # TEST 2-7: Build rumah #1 through #6 → autoUpgrade should be null
        # ================================================================
        rumah_positions = [
            (10, 10), (12, 10), (14, 10),  # Row 1
            (10, 12), (12, 12), (14, 12),  # Row 2
        ]
        
        for i, (x, y) in enumerate(rumah_positions, start=1):
            test_count += 1
            print(f'TEST {test_count}: Build rumah #{i} at ({x}, {y}) → autoUpgrade should be null')
            
            resp = build_rumah(cookie, child_id, 'rumah_kayu', x, y)
            if resp.status_code != 200:
                print(f'  ❌ FAIL: Could not build rumah (status {resp.status_code})')
                print(f'     Response: {resp.text}')
            else:
                data = resp.json()
                auto = data.get('autoUpgrade')
                if auto is not None:
                    print(f'  ❌ FAIL: autoUpgrade should be null for rumah #{i}')
                    print(f'     Got: {auto}')
                else:
                    print(f'  ✅ PASS: rumah #{i} built, autoUpgrade=null')
                    pass_count += 1
            print()
        
        # Verify Musalla still L1
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 1:
            print(f'  ✅ After 6 rumah, Musalla still L1 (correct)')
        else:
            print(f'  ❌ After 6 rumah, Musalla level is not 1: {musalla}')
        print()
        
        # ================================================================
        # TEST 8: Build rumah #7 → AUTO-UPGRADE L1 → L2
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: Build rumah #7 at (10, 14) → AUTO-UPGRADE L1 → L2')
        
        resp = build_rumah(cookie, child_id, 'rumah_kayu', 10, 14)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build rumah #7 (status {resp.status_code})')
            print(f'     Response: {resp.text}')
        else:
            data = resp.json()
            auto = data.get('autoUpgrade')
            if auto is None:
                print(f'  ❌ FAIL: autoUpgrade should NOT be null for rumah #7')
            else:
                # Verify autoUpgrade structure
                checks = [
                    ('buildingId', lambda v: isinstance(v, str) and len(v) > 0),
                    ('fromLevel', lambda v: v == 1),
                    ('toLevel', lambda v: v == 2),
                    ('rumahCount', lambda v: v == 7),
                    ('levelName', lambda v: v == 'Masjid'),
                ]
                all_ok = True
                for field, check in checks:
                    val = auto.get(field)
                    if not check(val):
                        print(f'  ❌ FAIL: autoUpgrade.{field} incorrect: {val}')
                        all_ok = False
                
                if all_ok:
                    print(f'  ✅ PASS: autoUpgrade correct: {auto}')
                    pass_count += 1
                else:
                    print(f'  ❌ FAIL: autoUpgrade structure incorrect')
                    print(f'     Got: {auto}')
        print()
        
        # Verify Musalla now L2
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 2:
            print(f'  ✅ After 7 rumah, Musalla upgraded to L2 (Masjid)')
        else:
            print(f'  ❌ After 7 rumah, Musalla level is not 2: {musalla}')
        print()
        
        # ================================================================
        # TEST 9-15: Build rumah #8 through #14 → autoUpgrade should be null
        # ================================================================
        rumah_positions_2 = [
            (12, 14), (14, 14),  # Row 3
            (10, 16), (12, 16), (14, 16),  # Row 4
            (10, 18), (12, 18),  # Row 5
        ]
        
        for i, (x, y) in enumerate(rumah_positions_2, start=8):
            test_count += 1
            print(f'TEST {test_count}: Build rumah #{i} at ({x}, {y}) → autoUpgrade should be null (already L2)')
            
            resp = build_rumah(cookie, child_id, 'rumah_kayu', x, y)
            if resp.status_code != 200:
                print(f'  ❌ FAIL: Could not build rumah (status {resp.status_code})')
                print(f'     Response: {resp.text}')
            else:
                data = resp.json()
                auto = data.get('autoUpgrade')
                if auto is not None:
                    print(f'  ❌ FAIL: autoUpgrade should be null for rumah #{i} (already L2)')
                    print(f'     Got: {auto}')
                else:
                    print(f'  ✅ PASS: rumah #{i} built, autoUpgrade=null')
                    pass_count += 1
            print()
        
        # Verify Musalla still L2
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 2:
            print(f'  ✅ After 14 rumah, Musalla still L2 (correct)')
        else:
            print(f'  ❌ After 14 rumah, Musalla level is not 2: {musalla}')
        print()
        
        # ================================================================
        # TEST 16: Build rumah #15 → AUTO-UPGRADE L2 → L3
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: Build rumah #15 at (14, 18) → AUTO-UPGRADE L2 → L3')
        
        resp = build_rumah(cookie, child_id, 'rumah_kayu', 14, 18)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build rumah #15 (status {resp.status_code})')
            print(f'     Response: {resp.text}')
        else:
            data = resp.json()
            auto = data.get('autoUpgrade')
            if auto is None:
                print(f'  ❌ FAIL: autoUpgrade should NOT be null for rumah #15')
            else:
                # Verify autoUpgrade structure
                checks = [
                    ('buildingId', lambda v: isinstance(v, str) and len(v) > 0),
                    ('fromLevel', lambda v: v == 2),
                    ('toLevel', lambda v: v == 3),
                    ('rumahCount', lambda v: v == 15),
                    ('levelName', lambda v: 'Jami' in v and 'Masjid' in v),  # Accept both Jami' and Jami'
                ]
                all_ok = True
                for field, check in checks:
                    val = auto.get(field)
                    if not check(val):
                        print(f'  ❌ FAIL: autoUpgrade.{field} incorrect: {val}')
                        all_ok = False
                
                if all_ok:
                    print(f'  ✅ PASS: autoUpgrade correct: {auto}')
                    pass_count += 1
                else:
                    print(f'  ❌ FAIL: autoUpgrade structure incorrect')
                    print(f'     Got: {auto}')
        print()
        
        # Verify Musalla now L3
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 3:
            print(f'  ✅ After 15 rumah, Musalla upgraded to L3 (Jami\' Masjid)')
        else:
            print(f'  ❌ After 15 rumah, Musalla level is not 3: {musalla}')
        print()
        
        # ================================================================
        # TEST 17: Build rumah #16 → autoUpgrade should be null (already max L3)
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: Build rumah #16 at (10, 20) → autoUpgrade should be null (already max L3)')
        
        resp = build_rumah(cookie, child_id, 'rumah_kayu', 10, 20)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build rumah #16 (status {resp.status_code})')
            print(f'     Response: {resp.text}')
        else:
            data = resp.json()
            auto = data.get('autoUpgrade')
            if auto is not None:
                print(f'  ❌ FAIL: autoUpgrade should be null for rumah #16 (already max L3)')
                print(f'     Got: {auto}')
            else:
                print(f'  ✅ PASS: rumah #16 built, autoUpgrade=null (max level)')
                pass_count += 1
        print()
        
        # ================================================================
        # REGRESSION TEST 1: Manual upgrade for non-musalla still blocked
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: REGRESSION - Manual upgrade for non-musalla still blocked with 400')
        
        # Get a rumah building ID
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        rumah = next((b for b in buildings if b['templateId'] == 'rumah_kayu'), None)
        
        if rumah:
            resp = upgrade_non_musalla(cookie, child_id, rumah['id'])
            if resp.status_code == 400:
                data = resp.json()
                if 'Only Musalla can be upgraded' in data.get('error', ''):
                    print(f'  ✅ PASS: Non-musalla upgrade correctly blocked with 400')
                    pass_count += 1
                else:
                    print(f'  ❌ FAIL: Wrong error message: {data.get("error")}')
            else:
                print(f'  ❌ FAIL: Expected 400, got {resp.status_code}')
        else:
            print(f'  ❌ FAIL: Could not find rumah building for test')
        print()
        
        # ================================================================
        # REGRESSION TEST 2: Overlap detection still works (banglo 2×2)
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: REGRESSION - Overlap detection for banglo 2×2 still works')
        
        # Build banglo at (20, 10)
        resp = build_rumah(cookie, child_id, 'banglo', 20, 10)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build banglo (status {resp.status_code})')
        else:
            # Try to build rumah_kayu at (21, 10) - should overlap with banglo
            resp = build_rumah(cookie, child_id, 'rumah_kayu', 21, 10)
            if resp.status_code in [400, 409]:
                print(f'  ✅ PASS: Overlap correctly detected and blocked')
                pass_count += 1
            else:
                print(f'  ❌ FAIL: Overlap not detected, got status {resp.status_code}')
        print()
        
        # ================================================================
        # REGRESSION TEST 3: Overlap detection for rumah_batu 2×2
        # ================================================================
        test_count += 1
        print(f'TEST {test_count}: REGRESSION - Overlap detection for rumah_batu 2×2 still works')
        
        # Build rumah_batu at (20, 15)
        resp = build_rumah(cookie, child_id, 'rumah_batu', 20, 15)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build rumah_batu (status {resp.status_code})')
        else:
            # Try to build banglo at (21, 15) - should overlap with rumah_batu
            resp = build_rumah(cookie, child_id, 'banglo', 21, 15)
            if resp.status_code in [400, 409]:
                print(f'  ✅ PASS: Overlap correctly detected and blocked')
                pass_count += 1
            else:
                print(f'  ❌ FAIL: Overlap not detected, got status {resp.status_code}')
        print()
        
        # ================================================================
        # EDGE CASE TEST 1: Mixed rumah variants count toward threshold
        # ================================================================
        print('=' * 80)
        print('EDGE CASE TESTS')
        print('=' * 80)
        print()
        
        # Cleanup and start fresh
        run_cleanup()
        cookie, child_id = run_seed()
        
        test_count += 1
        print(f'TEST {test_count}: EDGE CASE - Mixed rumah variants (rumah_kayu, rumah_batu, banglo) count toward threshold')
        
        # Build Musalla
        resp = build_rumah(cookie, child_id, 'musalla', 17, 17)
        
        # Build 2 rumah_kayu, 2 rumah_batu, 3 banglo = 7 total
        variants = [
            ('rumah_kayu', 10, 10),
            ('rumah_kayu', 12, 10),
            ('rumah_batu', 14, 10),
            ('rumah_batu', 16, 10),
            ('banglo', 10, 12),
            ('banglo', 12, 12),
        ]
        
        for template, x, y in variants:
            resp = build_rumah(cookie, child_id, template, x, y)
            if resp.status_code != 200:
                print(f'  ❌ FAIL: Could not build {template} at ({x}, {y})')
        
        # Build 7th rumah (banglo) - should trigger auto-upgrade
        resp = build_rumah(cookie, child_id, 'banglo', 14, 12)
        if resp.status_code != 200:
            print(f'  ❌ FAIL: Could not build 7th rumah (status {resp.status_code})')
        else:
            data = resp.json()
            auto = data.get('autoUpgrade')
            if auto and auto.get('toLevel') == 2 and auto.get('rumahCount') == 7:
                print(f'  ✅ PASS: Mixed variants correctly counted, auto-upgrade triggered')
                pass_count += 1
            else:
                print(f'  ❌ FAIL: Auto-upgrade not triggered or incorrect')
                print(f'     Got: {auto}')
        print()
        
        # ================================================================
        # EDGE CASE TEST 2: Non-rumah buildings don't count toward threshold
        # ================================================================
        # Cleanup and start fresh
        run_cleanup()
        cookie, child_id = run_seed()
        
        test_count += 1
        print(f'TEST {test_count}: EDGE CASE - Non-rumah buildings (kebun, kandang) don\'t count toward threshold')
        
        # Build Musalla
        resp = build_rumah(cookie, child_id, 'musalla', 17, 17)
        
        # Build 6 rumah + 5 kebun = 11 buildings total, but only 6 rumah
        for i, (x, y) in enumerate([(10, 10), (12, 10), (14, 10), (10, 12), (12, 12), (14, 12)]):
            resp = build_rumah(cookie, child_id, 'rumah_kayu', x, y)
        
        for i, (x, y) in enumerate([(10, 14), (12, 14), (14, 14), (10, 16), (12, 16)]):
            resp = build_rumah(cookie, child_id, 'kebun_kurma', x, y)
        
        # Verify Musalla still L1 (only 6 rumah, not 7)
        resp = get_world(cookie, child_id)
        data = resp.json()
        world = data.get('world', {})
        buildings = world.get('buildings', [])
        musalla = next((b for b in buildings if b['templateId'] == 'musalla'), None)
        if musalla and musalla['level'] == 1:
            print(f'  ✅ PASS: Musalla still L1 with 6 rumah + 5 kebun (kebun don\'t count)')
            pass_count += 1
        else:
            print(f'  ❌ FAIL: Musalla level incorrect: {musalla}')
        print()
        
    finally:
        # Cleanup
        print('=' * 80)
        print('CLEANUP')
        print('=' * 80)
        run_cleanup()
        print('✓ Test data cleaned up')
        print()
    
    # Summary
    print('=' * 80)
    print('TEST SUMMARY')
    print('=' * 80)
    print(f'Total tests: {test_count}')
    print(f'Passed: {pass_count}')
    print(f'Failed: {test_count - pass_count}')
    print(f'Success rate: {pass_count / test_count * 100:.1f}%')
    print()
    
    if pass_count == test_count:
        print('🎉 ALL TESTS PASSED!')
        return 0
    else:
        print('❌ SOME TESTS FAILED')
        return 1

if __name__ == '__main__':
    sys.exit(main())
