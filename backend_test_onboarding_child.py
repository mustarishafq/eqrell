#!/usr/bin/env python3
"""
Test POST /api/onboarding/child endpoint
Tests the 12-habit cap removal and ensures all age-appropriate templates are created.
"""
import os
import sys
import requests
import subprocess
from pymongo import MongoClient

# Config
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f'{BASE_URL}/api'

# Read BASE_URL from .env if needed
if BASE_URL == 'https://pwa-trial-cohort.preview.emergentagent.com':
    try:
        with open('/app/.env') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_BASE_URL='):
                    BASE_URL = line.strip().split('=', 1)[1].strip('"').strip("'")
                    API_BASE = f'{BASE_URL}/api'
                    break
    except Exception:
        pass

print(f"🔧 Using API Base: {API_BASE}")

# Get all templates from habitTemplates.js
HABIT_TEMPLATES = {
    # IBADAH (10)
    'ib-01': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-02': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-03': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-04': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-05': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-06': {'category': 'ibadah', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ib-07': {'category': 'ibadah', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ib-08': {'category': 'ibadah', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ib-09': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    'ib-10': {'category': 'ibadah', 'ageBands': ['5-6', '7-9', '10-12']},
    # AKHLAK (6)
    'ak-01': {'category': 'akhlak', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ak-02': {'category': 'akhlak', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ak-03': {'category': 'akhlak', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ak-04': {'category': 'akhlak', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ak-05': {'category': 'akhlak', 'ageBands': ['5-6', '7-9', '10-12']},
    'ak-06': {'category': 'akhlak', 'ageBands': ['5-6', '7-9', '10-12']},
    # PEMBELAJARAN (4)
    'pb-01': {'category': 'pembelajaran', 'ageBands': ['5-6', '7-9', '10-12']},
    'pb-02': {'category': 'pembelajaran', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'pb-03': {'category': 'pembelajaran', 'ageBands': ['7-9', '10-12']},
    'pb-04': {'category': 'pembelajaran', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    # KESIHATAN (5)
    'ks-01': {'category': 'kesihatan', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ks-02': {'category': 'kesihatan', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ks-03': {'category': 'kesihatan', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'ks-04': {'category': 'kesihatan', 'ageBands': ['5-6', '7-9', '10-12']},
    'ks-05': {'category': 'kesihatan', 'ageBands': ['5-6', '7-9', '10-12']},
    # KELUARGA (5)
    'kg-01': {'category': 'keluarga', 'ageBands': ['5-6', '7-9', '10-12']},
    'kg-02': {'category': 'keluarga', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'kg-03': {'category': 'keluarga', 'ageBands': ['5-6', '7-9', '10-12']},
    'kg-04': {'category': 'keluarga', 'ageBands': ['3-4', '5-6', '7-9', '10-12']},
    'kg-05': {'category': 'keluarga', 'ageBands': ['5-6', '7-9', '10-12']},
}

SOLAT_CORE_IDS = ['ib-01', 'ib-02', 'ib-03', 'ib-04', 'ib-05']

def get_templates_for_age_band(age_band, exclude_solat=True):
    """Get all template IDs for a given age band, optionally excluding solat core"""
    templates = []
    for tid, tpl in HABIT_TEMPLATES.items():
        if age_band in tpl['ageBands']:
            if exclude_solat and tid in SOLAT_CORE_IDS:
                continue
            templates.append(tid)
    return templates

def run_seed_script():
    """Run seed script and return cookie + IDs"""
    print("\n🌱 Running seed_test_family.py...")
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                          capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Seed script failed: {result.stderr}")
        sys.exit(1)
    
    # Parse output
    lines = result.stdout.strip().split('\n')
    data = {}
    for line in lines:
        if '=' in line:
            key, val = line.split('=', 1)
            data[key] = val
    
    print(f"✅ Seed complete. Family: {data.get('FAMILY_ID', 'N/A')}")
    return data

def run_cleanup_script():
    """Run cleanup script"""
    print("\n🧹 Running cleanup_test_family.py...")
    result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                          capture_output=True, text=True)
    if result.returncode != 0:
        print(f"⚠️  Cleanup script failed: {result.stderr}")
    else:
        print("✅ Cleanup complete")

def test_onboarding_child():
    """Main test function"""
    print("\n" + "="*80)
    print("TEST: POST /api/onboarding/child - 12-habit cap removal")
    print("="*80)
    
    # Step 1: Seed test family
    seed_data = run_seed_script()
    cookie = seed_data['COOKIE']
    family_id = seed_data['FAMILY_ID']
    
    # MongoDB connection
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Session for requests
    session = requests.Session()
    session.cookies.set('eqrel_session', cookie, domain=BASE_URL.replace('https://', '').replace('http://', ''))
    
    test_child_ids = []  # Track created children for cleanup
    
    try:
        # TEST 1: Create NEW child age 8 with ALL '7-9' templates (25 expected, excluding solat core)
        print("\n" + "-"*80)
        print("TEST 1: Create age 8 child with ALL '7-9' templates (25 expected)")
        print("-"*80)
        
        age_band_7_9_templates = get_templates_for_age_band('7-9', exclude_solat=True)
        print(f"📋 Age band '7-9' templates (excluding solat core): {len(age_band_7_9_templates)} templates")
        print(f"   Templates: {', '.join(age_band_7_9_templates)}")
        
        payload = {
            'profile': {
                'nickname': 'TEST_Zara',
                'gender': 'female',
                'avatarId': 'G01',
                'favColor': 'pink'
            },
            'age': 8,
            'school': 'morning',
            'practice': {},
            'pace': 'all',
            'templateIds': age_band_7_9_templates
        }
        
        resp = session.post(f'{API_BASE}/onboarding/child', json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 1 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        child_id = data['child']['id']
        test_child_ids.append(child_id)
        habits_created = data['habitsCreated']
        
        print(f"✅ Child created: {child_id}")
        print(f"   Nickname: {data['child']['nickname']}")
        print(f"   Habits created: {habits_created}")
        
        # Verify habitsCreated == 25 (previously capped at 12)
        if habits_created != 25:
            print(f"❌ TEST 1 FAILED: Expected habitsCreated=25, got {habits_created}")
            return False
        
        print(f"✅ Correct: habitsCreated = 25 (12-habit cap removed)")
        
        # Verify in MongoDB
        habits = list(db.habits.find({'childId': child_id, 'source': 'diagnosis'}))
        print(f"   MongoDB: {len(habits)} diagnosis habits found")
        
        # Check all are active (no locked)
        locked_habits = [h for h in habits if h.get('locked') == True]
        if locked_habits:
            print(f"❌ TEST 1 FAILED: Found {len(locked_habits)} locked habits, expected 0")
            return False
        
        print(f"✅ All {len(habits)} habits are active (no locked)")
        
        # Check for solat core habits (added by ensureSolatCore)
        solat_habits = list(db.habits.find({'childId': child_id, 'core': True}))
        print(f"   MongoDB: {len(solat_habits)} solat core habits found")
        
        # Check no duplicate templateIds
        template_ids = [h['templateId'] for h in habits if h.get('templateId')]
        if len(template_ids) != len(set(template_ids)):
            print(f"❌ TEST 1 FAILED: Found duplicate templateIds")
            return False
        
        print(f"✅ No duplicate templateIds in diagnosis habits")
        print(f"✅ TEST 1 PASSED")
        
        # TEST 2: Re-post for same child with same templateIds → habitsCreated 0
        print("\n" + "-"*80)
        print("TEST 2: Re-post same child with same templateIds (expect 0 new habits)")
        print("-"*80)
        
        payload['childId'] = child_id
        resp = session.post(f'{API_BASE}/onboarding/child', json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        habits_created = data['habitsCreated']
        
        print(f"   Habits created: {habits_created}")
        
        if habits_created != 0:
            print(f"❌ TEST 2 FAILED: Expected habitsCreated=0, got {habits_created}")
            return False
        
        print(f"✅ Correct: habitsCreated = 0 (no duplicates)")
        print(f"✅ TEST 2 PASSED")
        
        # TEST 3: Age 4 child with all '3-4' templateIds (14 expected)
        print("\n" + "-"*80)
        print("TEST 3: Create age 4 child with ALL '3-4' templates (14 expected)")
        print("-"*80)
        
        age_band_3_4_templates = get_templates_for_age_band('3-4', exclude_solat=True)
        print(f"📋 Age band '3-4' templates (excluding solat core): {len(age_band_3_4_templates)} templates")
        print(f"   Templates: {', '.join(age_band_3_4_templates)}")
        
        payload = {
            'profile': {
                'nickname': 'TEST_Amir',
                'gender': 'male',
                'avatarId': 'B01',
                'favColor': 'blue'
            },
            'age': 4,
            'school': 'none',
            'practice': {},
            'pace': 'all',
            'templateIds': age_band_3_4_templates
        }
        
        resp = session.post(f'{API_BASE}/onboarding/child', json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        child_id_2 = data['child']['id']
        test_child_ids.append(child_id_2)
        habits_created = data['habitsCreated']
        
        print(f"✅ Child created: {child_id_2}")
        print(f"   Nickname: {data['child']['nickname']}")
        print(f"   Habits created: {habits_created}")
        
        if habits_created != 14:
            print(f"❌ TEST 3 FAILED: Expected habitsCreated=14, got {habits_created}")
            return False
        
        print(f"✅ Correct: habitsCreated = 14")
        print(f"✅ TEST 3 PASSED")
        
        # TEST 4: pace:'staged' with lockedTemplateIds subset
        print("\n" + "-"*80)
        print("TEST 4: Create child with pace='staged' and lockedTemplateIds")
        print("-"*80)
        
        # Use first 10 templates as active, next 5 as locked
        all_templates = age_band_7_9_templates[:15]
        locked_templates = age_band_7_9_templates[10:15]
        
        print(f"📋 Total templates: {len(all_templates)}")
        print(f"   Locked templates: {len(locked_templates)} - {', '.join(locked_templates)}")
        
        payload = {
            'profile': {
                'nickname': 'TEST_Fatimah',
                'gender': 'female',
                'avatarId': 'G02',
                'favColor': 'green'
            },
            'age': 9,
            'school': 'morning',
            'practice': {},
            'pace': 'staged',
            'templateIds': all_templates,
            'lockedTemplateIds': locked_templates
        }
        
        resp = session.post(f'{API_BASE}/onboarding/child', json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        child_id_3 = data['child']['id']
        test_child_ids.append(child_id_3)
        habits_created = data['habitsCreated']
        habits_locked = data['habitsLocked']
        
        print(f"✅ Child created: {child_id_3}")
        print(f"   Habits created: {habits_created}")
        print(f"   Habits locked: {habits_locked}")
        
        if habits_created != 15:
            print(f"❌ TEST 4 FAILED: Expected habitsCreated=15, got {habits_created}")
            return False
        
        if habits_locked != 5:
            print(f"❌ TEST 4 FAILED: Expected habitsLocked=5, got {habits_locked}")
            return False
        
        # Verify in MongoDB
        locked_habits = list(db.habits.find({'childId': child_id_3, 'locked': True, 'active': False}))
        active_habits = list(db.habits.find({'childId': child_id_3, 'source': 'diagnosis', 'active': True}))
        
        print(f"   MongoDB: {len(locked_habits)} locked habits (active=false)")
        print(f"   MongoDB: {len(active_habits)} active habits")
        
        if len(locked_habits) != 5:
            print(f"❌ TEST 4 FAILED: Expected 5 locked habits in DB, got {len(locked_habits)}")
            return False
        
        if len(active_habits) != 10:
            print(f"❌ TEST 4 FAILED: Expected 10 active habits in DB, got {len(active_habits)}")
            return False
        
        print(f"✅ Correct: 5 locked (active=false), 10 active")
        print(f"✅ TEST 4 PASSED")
        
        # TEST 5: Invalid template IDs are filtered out
        print("\n" + "-"*80)
        print("TEST 5: Invalid template IDs are filtered out")
        print("-"*80)
        
        valid_templates = age_band_7_9_templates[:5]
        invalid_templates = ['invalid-01', 'fake-02', 'xxx-03']
        mixed_templates = valid_templates + invalid_templates
        
        print(f"📋 Sending {len(mixed_templates)} templates ({len(valid_templates)} valid, {len(invalid_templates)} invalid)")
        
        payload = {
            'profile': {
                'nickname': 'TEST_Hassan',
                'gender': 'male',
                'avatarId': 'B03',
                'favColor': 'red'
            },
            'age': 8,
            'school': 'morning',
            'practice': {},
            'pace': 'all',
            'templateIds': mixed_templates
        }
        
        resp = session.post(f'{API_BASE}/onboarding/child', json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        child_id_4 = data['child']['id']
        test_child_ids.append(child_id_4)
        habits_created = data['habitsCreated']
        
        print(f"✅ Child created: {child_id_4}")
        print(f"   Habits created: {habits_created}")
        
        if habits_created != 5:
            print(f"❌ TEST 5 FAILED: Expected habitsCreated=5 (only valid), got {habits_created}")
            return False
        
        print(f"✅ Correct: Only valid templates created (5 habits)")
        print(f"✅ TEST 5 PASSED")
        
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED (5/5)")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup test children
        print("\n🧹 Cleaning up test children...")
        for child_id in test_child_ids:
            db.children.delete_one({'id': child_id})
            db.habits.delete_many({'childId': child_id})
            print(f"   Deleted child: {child_id}")
        
        client.close()
        
        # Run cleanup script
        run_cleanup_script()

if __name__ == '__main__':
    success = test_onboarding_child()
    sys.exit(0 if success else 1)
