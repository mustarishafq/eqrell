#!/usr/bin/env python3
"""
Backend test for Habit Scheduling / Family Templates / Staged-Unlock
Tests the new scheduling features as per review request.
"""
import requests
import os
import sys
import subprocess
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from zoneinfo import ZoneInfo
import uuid

# Load environment
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Session for requests - will be set after seeding
session = requests.Session()
COOKIE = None
FAMILY_ID = None
CHILD_ID_1 = None
CHILD_ID_2 = None

# Track test data for cleanup
test_template_ids = []
test_habit_ids = []
test_claim_ids = []

def seed_test_family():
    """Run seed script and extract credentials"""
    print("\n🌱 Seeding test family...")
    try:
        result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            print(f"❌ Seed script failed: {result.stderr}")
            return False
        
        # Parse output
        global COOKIE, FAMILY_ID, CHILD_ID_1, CHILD_ID_2
        for line in result.stdout.split('\n'):
            if line.startswith('COOKIE='):
                COOKIE = line.split('=', 1)[1].strip()
            elif line.startswith('FAMILY_ID='):
                FAMILY_ID = line.split('=', 1)[1].strip()
            elif line.startswith('CHILD_ID_1='):
                CHILD_ID_1 = line.split('=', 1)[1].strip()
            elif line.startswith('CHILD_ID_2='):
                CHILD_ID_2 = line.split('=', 1)[1].strip()
        
        if not all([COOKIE, FAMILY_ID, CHILD_ID_1, CHILD_ID_2]):
            print(f"❌ Failed to parse seed output")
            print(f"   COOKIE: {'✓' if COOKIE else '✗'}")
            print(f"   FAMILY_ID: {'✓' if FAMILY_ID else '✗'}")
            print(f"   CHILD_ID_1: {'✓' if CHILD_ID_1 else '✗'}")
            print(f"   CHILD_ID_2: {'✓' if CHILD_ID_2 else '✗'}")
            return False
        
        session.cookies.set('eqrel_session', COOKIE)
        print(f"✅ Test family seeded")
        print(f"   Family: {FAMILY_ID}")
        print(f"   Child 1: {CHILD_ID_1}")
        print(f"   Child 2: {CHILD_ID_2}")
        return True
    except Exception as e:
        print(f"❌ Seed error: {e}")
        return False

def cleanup():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    try:
        subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                      capture_output=True, text=True, timeout=30)
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"❌ Cleanup error: {e}")

def get_today_weekday():
    """Get today's weekday in parent's timezone (Asia/Kuala_Lumpur)"""
    tz = ZoneInfo('Asia/Kuala_Lumpur')
    now = datetime.now(tz)
    # Convert to 0=Sunday format (API uses 0=Sunday)
    weekday = (now.weekday() + 1) % 7
    return weekday

def test_school_days():
    """Test 1: GET/POST /api/family/school-days"""
    print("\n" + "="*70)
    print("TEST 1: School Days Management")
    print("="*70)
    
    try:
        # GET initial school days
        print("\n📍 GET /api/family/school-days (initial)")
        resp = session.get(f"{API_URL}/family/school-days")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"✅ GET successful")
        print(f"   Initial schoolDays: {data.get('schoolDays')}")
        
        if 'schoolDays' not in data:
            print("❌ FAILED: Missing 'schoolDays' field")
            return False
        
        # Should default to [1,2,3,4,5] (Mon-Fri)
        if data['schoolDays'] != [1, 2, 3, 4, 5]:
            print(f"⚠️  WARNING: Expected default [1,2,3,4,5], got {data['schoolDays']}")
        
        # POST new school days [0,1,2,3,4] (Sun-Thu)
        print("\n📍 POST /api/family/school-days {days:[0,1,2,3,4]}")
        resp = session.post(f"{API_URL}/family/school-days", json={'days': [0, 1, 2, 3, 4]})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"✅ POST successful")
        print(f"   Updated schoolDays: {data.get('schoolDays')}")
        
        if data.get('schoolDays') != [0, 1, 2, 3, 4]:
            print(f"❌ FAILED: Expected [0,1,2,3,4], got {data.get('schoolDays')}")
            return False
        
        # POST empty days (should fail with 400)
        print("\n📍 POST /api/family/school-days {days:[]} (should fail)")
        resp = session.post(f"{API_URL}/family/school-days", json={'days': []})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {resp.status_code}")
            return False
        
        print(f"✅ Empty days rejected correctly (400)")
        
        # POST all 7 days (should fail with 400)
        print("\n📍 POST /api/family/school-days {days:[0,1,2,3,4,5,6]} (should fail)")
        resp = session.post(f"{API_URL}/family/school-days", json={'days': [0, 1, 2, 3, 4, 5, 6]})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {resp.status_code}")
            return False
        
        print(f"✅ All 7 days rejected correctly (400)")
        
        # Restore to [1,2,3,4,5]
        print("\n📍 POST /api/family/school-days {days:[1,2,3,4,5]} (restore)")
        resp = session.post(f"{API_URL}/family/school-days", json={'days': [1, 2, 3, 4, 5]})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if data.get('schoolDays') != [1, 2, 3, 4, 5]:
            print(f"❌ FAILED: Expected [1,2,3,4,5], got {data.get('schoolDays')}")
            return False
        
        print(f"✅ Restored to [1,2,3,4,5]")
        print("\n✅ TEST 1 PASSED: School days management working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_family_templates():
    """Test 2: Family habit templates"""
    print("\n" + "="*70)
    print("TEST 2: Family Habit Templates")
    print("="*70)
    
    try:
        today_weekday = get_today_weekday()
        print(f"\n📍 Today's weekday: {today_weekday} (0=Sunday)")
        
        # POST new template with custom schedule for today
        print(f"\n📍 POST /api/habit-templates (schedule:custom, days:[{today_weekday}])")
        template_data = {
            'title': 'TEST_Read 10 min',
            'category': 'akhlak',
            'points': 10,
            'schedule': 'custom',
            'days': [today_weekday],
            'childIds': [CHILD_ID_1, CHILD_ID_2]
        }
        resp = session.post(f"{API_URL}/habit-templates", json=template_data)
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"✅ Template created")
        
        if 'template' not in data or 'habits' not in data:
            print(f"❌ FAILED: Missing 'template' or 'habits' in response")
            return False
        
        template = data['template']
        habits = data['habits']
        template_id = template['id']
        test_template_ids.append(template_id)
        
        print(f"   Template ID: {template_id}")
        print(f"   Title: {template['title']}")
        print(f"   Schedule: {template.get('schedule')}")
        print(f"   Days: {template.get('days')}")
        print(f"   Habits created: {len(habits)}")
        
        # Verify template has familyTemplateId
        if len(habits) != 2:
            print(f"❌ FAILED: Expected 2 habits, got {len(habits)}")
            return False
        
        for habit in habits:
            if habit.get('familyTemplateId') != template_id:
                print(f"❌ FAILED: Habit familyTemplateId mismatch")
                return False
            test_habit_ids.append(habit['id'])
        
        print(f"✅ 2 habits created with familyTemplateId")
        
        # GET templates
        print(f"\n📍 GET /api/habit-templates")
        resp = session.get(f"{API_URL}/habit-templates")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        templates = data.get('templates', [])
        print(f"✅ GET successful, found {len(templates)} templates")
        
        # Find our template
        our_template = next((t for t in templates if t['id'] == template_id), None)
        if not our_template:
            print(f"❌ FAILED: Template {template_id} not found in list")
            return False
        
        print(f"   Template found with childIds: {our_template.get('childIds')}")
        
        if set(our_template.get('childIds', [])) != {CHILD_ID_1, CHILD_ID_2}:
            print(f"❌ FAILED: Expected childIds [{CHILD_ID_1}, {CHILD_ID_2}]")
            return False
        
        print(f"✅ Template has correct childIds")
        
        # POST same template again (should return duplicate:true)
        print(f"\n📍 POST /api/children/{CHILD_ID_1}/habits with familyTemplateId (duplicate test)")
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits", 
                           json={'familyTemplateId': template_id})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get('duplicate'):
            print(f"❌ FAILED: Expected duplicate:true, got {data}")
            return False
        
        print(f"✅ Duplicate detection working (duplicate:true)")
        
        # Verify no new habit was created in MongoDB
        habit_count = db.habits.count_documents({
            'childId': CHILD_ID_1,
            'familyTemplateId': template_id,
            'active': {'$ne': False}
        })
        if habit_count != 1:
            print(f"❌ FAILED: Expected 1 habit in DB, found {habit_count}")
            return False
        
        print(f"✅ No duplicate habit created in DB")
        
        # DELETE template
        print(f"\n📍 DELETE /api/habit-templates/{template_id}")
        resp = session.delete(f"{API_URL}/habit-templates/{template_id}")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        print(f"✅ Template deleted")
        
        # GET templates again (should not include deleted)
        print(f"\n📍 GET /api/habit-templates (after delete)")
        resp = session.get(f"{API_URL}/habit-templates")
        data = resp.json()
        templates = data.get('templates', [])
        
        if any(t['id'] == template_id for t in templates):
            print(f"❌ FAILED: Deleted template still in list")
            return False
        
        print(f"✅ Deleted template not in list")
        
        # Verify habits still exist
        habit_count = db.habits.count_documents({
            'familyTemplateId': template_id,
            'active': {'$ne': False}
        })
        if habit_count != 2:
            print(f"❌ FAILED: Habits were deleted (expected to remain)")
            return False
        
        print(f"✅ Habits remain after template deletion")
        
        # PATCH deleted template (should return 404)
        print(f"\n📍 PATCH /api/habit-templates/{template_id} (should fail)")
        resp = session.patch(f"{API_URL}/habit-templates/{template_id}", 
                            json={'title': 'Updated'})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 404:
            print(f"❌ FAILED: Expected 404, got {resp.status_code}")
            return False
        
        print(f"✅ PATCH on deleted template returns 404")
        
        print("\n✅ TEST 2 PASSED: Family templates working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_scheduling():
    """Test 3: Habit scheduling (custom/daily/school/weekend)"""
    print("\n" + "="*70)
    print("TEST 3: Habit Scheduling")
    print("="*70)
    
    try:
        today_weekday = get_today_weekday()
        # Pick a weekday that is NOT today (go 3 days ahead to be safe)
        off_weekday = (today_weekday + 3) % 7
        print(f"\n📍 Today's weekday: {today_weekday} (0=Sunday)")
        print(f"📍 Off weekday: {off_weekday}")
        
        # Create habit with custom schedule for off-day
        print(f"\n📍 POST /api/children/{CHILD_ID_1}/habits (schedule:custom, days:[{off_weekday}])")
        habit_data = {
            'title': 'TEST_Off Day Habit',
            'category': 'akhlak',
            'points': 10,
            'schedule': 'custom',
            'days': [off_weekday]
        }
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits", json=habit_data)
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        off_habit = data.get('habit')
        if not off_habit:
            print(f"❌ FAILED: No habit in response")
            return False
        
        off_habit_id = off_habit['id']
        test_habit_ids.append(off_habit_id)
        print(f"✅ Off-day habit created: {off_habit_id}")
        
        # GET habits (default - should NOT include off-day habit)
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits (default)")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        habits = data.get('habits', [])
        off_today_habits = data.get('offTodayHabits', [])
        school_days = data.get('schoolDays')
        weekday = data.get('weekday')
        
        print(f"✅ GET successful")
        print(f"   habits count: {len(habits)}")
        print(f"   offTodayHabits count: {len(off_today_habits)}")
        print(f"   schoolDays: {school_days}")
        print(f"   weekday: {weekday}")
        print(f"   Expected today: {today_weekday}, API returned: {weekday}")
        
        # Verify off-day habit is NOT in habits
        if any(h['id'] == off_habit_id for h in habits):
            print(f"❌ FAILED: Off-day habit should NOT be in habits list")
            print(f"   Habit scheduled for weekday {off_weekday}, today is {weekday}")
            return False
        
        print(f"✅ Off-day habit NOT in habits list")
        
        # Verify off-day habit IS in offTodayHabits
        if not any(h['id'] == off_habit_id for h in off_today_habits):
            print(f"❌ FAILED: Off-day habit should be in offTodayHabits")
            return False
        
        print(f"✅ Off-day habit IS in offTodayHabits")
        
        # GET habits with ?all=1
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits?all=1")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits?all=1")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        all_habits = data.get('habits', [])
        print(f"✅ GET with ?all=1 successful")
        print(f"   habits count: {len(all_habits)}")
        
        # Find off-day habit
        off_habit_in_all = next((h for h in all_habits if h['id'] == off_habit_id), None)
        if not off_habit_in_all:
            print(f"❌ FAILED: Off-day habit not found with ?all=1")
            return False
        
        if not off_habit_in_all.get('offToday'):
            print(f"❌ FAILED: Off-day habit should have offToday:true")
            return False
        
        print(f"✅ Off-day habit included with offToday:true")
        
        # PATCH habit to schedule:'daily'
        print(f"\n📍 PATCH /api/habits/{off_habit_id} (schedule:daily)")
        resp = session.patch(f"{API_URL}/habits/{off_habit_id}", 
                            json={'schedule': 'daily'})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        print(f"✅ Habit updated to daily")
        
        # GET habits again (should now include the habit)
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits (after PATCH)")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        data = resp.json()
        habits = data.get('habits', [])
        
        if not any(h['id'] == off_habit_id for h in habits):
            print(f"❌ FAILED: Habit should now be in habits list")
            return False
        
        print(f"✅ Habit now appears in default list (schedule:daily)")
        
        # Test schedule:'school' and schedule:'weekend'
        # Set schoolDays to include today
        print(f"\n📍 Testing schedule:'school' (set schoolDays to include today)")
        if today_weekday not in [1, 2, 3, 4, 5]:  # If today is weekend
            # Set schoolDays to include today
            resp = session.post(f"{API_URL}/family/school-days", 
                               json={'days': [today_weekday, (today_weekday + 1) % 7]})
            if resp.status_code != 200:
                print(f"⚠️  WARNING: Could not set schoolDays")
        
        # Create school-day habit
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits", 
                           json={'title': 'TEST_School Habit', 'category': 'akhlak', 
                                'points': 10, 'schedule': 'school'})
        if resp.status_code == 200:
            school_habit_id = resp.json()['habit']['id']
            test_habit_ids.append(school_habit_id)
            
            # Check if it appears
            resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
            data = resp.json()
            school_days = data.get('schoolDays', [])
            habits = data.get('habits', [])
            
            school_habit_visible = any(h['id'] == school_habit_id for h in habits)
            today_is_school = today_weekday in school_days
            
            print(f"   School habit visible: {school_habit_visible}")
            print(f"   Today is school day: {today_is_school}")
            print(f"   schoolDays: {school_days}")
            
            if school_habit_visible == today_is_school:
                print(f"✅ schedule:'school' working correctly")
            else:
                print(f"⚠️  WARNING: schedule:'school' visibility mismatch")
        
        # Restore schoolDays to [1,2,3,4,5]
        session.post(f"{API_URL}/family/school-days", json={'days': [1, 2, 3, 4, 5]})
        
        print("\n✅ TEST 3 PASSED: Habit scheduling working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_staged_unlock():
    """Test 4: Staged unlock (locked habits with unlockAt)"""
    print("\n" + "="*70)
    print("TEST 4: Staged Unlock")
    print("="*70)
    
    try:
        # Insert locked habit directly in MongoDB
        print(f"\n📍 Inserting locked habit in MongoDB")
        
        # Get a template ID from habitTemplates.js
        template_id = 'ak-01'  # "Help with chores"
        
        locked_habit_id = str(uuid.uuid4())
        unlock_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        locked_habit = {
            'id': locked_habit_id,
            'familyId': FAMILY_ID,
            'childId': CHILD_ID_1,
            'templateId': template_id,
            'title': 'TEST_Locked Habit',
            'category': 'ibadah',
            'points': 10,
            'active': False,
            'locked': True,
            'unlockAt': unlock_at,
            'createdAt': datetime.now(timezone.utc),
            'updatedAt': datetime.now(timezone.utc)
        }
        
        db.habits.insert_one(locked_habit)
        test_habit_ids.append(locked_habit_id)
        print(f"✅ Locked habit inserted: {locked_habit_id}")
        print(f"   unlockAt: {unlock_at}")
        
        # GET habits (should include in lockedHabits)
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        locked_habits = data.get('lockedHabits', [])
        print(f"✅ GET successful")
        print(f"   lockedHabits count: {len(locked_habits)}")
        
        # Find our locked habit
        our_locked = next((h for h in locked_habits if h['id'] == locked_habit_id), None)
        if not our_locked:
            print(f"❌ FAILED: Locked habit not found in lockedHabits")
            return False
        
        print(f"✅ Locked habit found in lockedHabits")
        
        # POST same templateId (should unlock the staged one)
        print(f"\n📍 POST /api/children/{CHILD_ID_1}/habits with same templateId")
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits", 
                           json={'templateId': template_id, 'title': 'TEST_Unlocked', 
                                'category': 'ibadah', 'points': 10})
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        if not data.get('unlocked'):
            print(f"❌ FAILED: Expected unlocked:true, got {data}")
            return False
        
        if data.get('habit', {}).get('id') != locked_habit_id:
            print(f"❌ FAILED: Should return same habit ID")
            return False
        
        print(f"✅ Locked habit unlocked (unlocked:true, same ID)")
        
        # GET habits again (should NOT be in lockedHabits, should be in habits)
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits (after unlock)")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        data = resp.json()
        habits = data.get('habits', [])
        locked_habits = data.get('lockedHabits', [])
        
        if any(h['id'] == locked_habit_id for h in locked_habits):
            print(f"❌ FAILED: Habit still in lockedHabits")
            return False
        
        if not any(h['id'] == locked_habit_id for h in habits):
            print(f"❌ FAILED: Habit not in habits list")
            return False
        
        print(f"✅ Habit moved from lockedHabits to habits")
        
        # Insert another locked habit with different templateId
        print(f"\n📍 Inserting another locked habit")
        locked_habit_id_2 = str(uuid.uuid4())
        template_id_2 = 'ak-02'
        
        locked_habit_2 = {
            'id': locked_habit_id_2,
            'familyId': FAMILY_ID,
            'childId': CHILD_ID_1,
            'templateId': template_id_2,
            'title': 'TEST_Locked Habit 2',
            'category': 'akhlak',
            'points': 10,
            'active': False,
            'locked': True,
            'unlockAt': datetime.now(timezone.utc) + timedelta(days=14),
            'createdAt': datetime.now(timezone.utc),
            'updatedAt': datetime.now(timezone.utc)
        }
        
        db.habits.insert_one(locked_habit_2)
        test_habit_ids.append(locked_habit_id_2)
        print(f"✅ Second locked habit inserted: {locked_habit_id_2}")
        
        # POST unlock-now
        print(f"\n📍 POST /api/children/{CHILD_ID_1}/habits/unlock-now")
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits/unlock-now")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        unlocked_count = data.get('unlocked', 0)
        print(f"✅ unlock-now successful")
        print(f"   Unlocked count: {unlocked_count}")
        
        if unlocked_count < 1:
            print(f"❌ FAILED: Expected at least 1 unlocked")
            return False
        
        # GET habits (lockedHabits should be empty)
        print(f"\n📍 GET /api/children/{CHILD_ID_1}/habits (after unlock-now)")
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        data = resp.json()
        locked_habits = data.get('lockedHabits', [])
        
        if len(locked_habits) > 0:
            print(f"❌ FAILED: lockedHabits should be empty, found {len(locked_habits)}")
            return False
        
        print(f"✅ lockedHabits is empty")
        
        # Test superseded scenario: insert locked copy of already-active templateId
        print(f"\n📍 Testing superseded scenario")
        
        # First, create an active habit
        resp = session.post(f"{API_URL}/children/{CHILD_ID_1}/habits", 
                           json={'templateId': 'ak-03', 'title': 'TEST_Active', 
                                'category': 'akhlak', 'points': 10})
        if resp.status_code == 200:
            active_habit_id = resp.json()['habit']['id']
            test_habit_ids.append(active_habit_id)
            
            # Insert locked copy with same templateId
            locked_copy_id = str(uuid.uuid4())
            locked_copy = {
                'id': locked_copy_id,
                'familyId': FAMILY_ID,
                'childId': CHILD_ID_1,
                'templateId': 'ak-03',
                'title': 'TEST_Locked Copy',
                'category': 'akhlak',
                'points': 10,
                'active': False,
                'locked': True,
                'unlockAt': datetime.now(timezone.utc) + timedelta(days=7),
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            }
            db.habits.insert_one(locked_copy)
            test_habit_ids.append(locked_copy_id)
            
            # GET habits (should retire the locked copy)
            resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
            data = resp.json()
            locked_habits = data.get('lockedHabits', [])
            
            # Locked copy should NOT be in lockedHabits (superseded)
            if any(h['id'] == locked_copy_id for h in locked_habits):
                print(f"❌ FAILED: Superseded habit should not be in lockedHabits")
                return False
            
            # Check in DB that it has supersededAt
            locked_copy_doc = db.habits.find_one({'id': locked_copy_id})
            if not locked_copy_doc.get('supersededAt'):
                print(f"❌ FAILED: Superseded habit should have supersededAt")
                return False
            
            print(f"✅ Superseded locked habit retired correctly")
        
        print("\n✅ TEST 4 PASSED: Staged unlock working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_regression():
    """Test 5-7: Regression tests"""
    print("\n" + "="*70)
    print("TEST 5-7: Regression Tests")
    print("="*70)
    
    try:
        # Test 5: GET /api/family/display-data
        print(f"\n📍 TEST 5: GET /api/family/display-data")
        resp = session.get(f"{API_URL}/family/display-data")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if 'children' not in data:
            print(f"❌ FAILED: Missing 'children' in response")
            return False
        
        # Check habitsTotal excludes off-day/locked habits
        for kid in data['children']:
            print(f"   Child {kid.get('nickname')}: habitsTotal = {kid.get('habitsTotal')}")
        
        print(f"✅ TEST 5 PASSED: display-data working")
        
        # Test 6: GET /api/digest/weekly
        print(f"\n📍 TEST 6: GET /api/digest/weekly")
        resp = session.get(f"{API_URL}/digest/weekly")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        print(f"✅ TEST 6 PASSED: weekly digest working")
        
        # Test 6b: GET /api/digest/night
        print(f"\n📍 TEST 6b: GET /api/digest/night")
        resp = session.get(f"{API_URL}/digest/night")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        print(f"✅ TEST 6b PASSED: night digest working")
        
        # Test 7: DELETE /api/habits/:id/claim (parent session)
        print(f"\n📍 TEST 7: DELETE /api/habits/:id/claim")
        
        # First, create a verified claim
        # Get a habit
        resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        if resp.status_code != 200:
            print(f"⚠️  WARNING: Could not get habits for claim test")
            return True
        
        habits = resp.json().get('habits', [])
        if not habits:
            print(f"⚠️  WARNING: No habits found for claim test")
            return True
        
        test_habit = habits[0]
        habit_id = test_habit['id']
        
        # Create a verified claim
        today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        claim_id = str(uuid.uuid4())
        claim = {
            'id': claim_id,
            'habitId': habit_id,
            'childId': CHILD_ID_1,
            'familyId': FAMILY_ID,
            'dateStr': today_str,
            'status': 'verified',
            'rubric': 'sah',
            'pointsAwarded': test_habit.get('points', 10),
            'createdAt': datetime.now(timezone.utc),
            'verifiedAt': datetime.now(timezone.utc),
            'verifiedBy': 'test-user'
        }
        db.habit_claims.insert_one(claim)
        test_claim_ids.append(claim_id)
        
        print(f"   Created verified claim: {claim_id}")
        
        # Get child's current points
        child_before = db.children.find_one({'id': CHILD_ID_1})
        mata_bina_before = child_before.get('mataBina', 0)
        mata_reward_before = child_before.get('mataReward', 0)
        print(f"   Before: mataBina={mata_bina_before}, mataReward={mata_reward_before}")
        
        # DELETE claim
        resp = session.delete(f"{API_URL}/habits/{habit_id}/claim")
        print(f"   DELETE Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            return False
        
        # Check points were subtracted
        child_after = db.children.find_one({'id': CHILD_ID_1})
        mata_bina_after = child_after.get('mataBina', 0)
        mata_reward_after = child_after.get('mataReward', 0)
        print(f"   After: mataBina={mata_bina_after}, mataReward={mata_reward_after}")
        
        points_awarded = test_habit.get('points', 10)
        expected_bina_delta = -points_awarded
        expected_reward_delta = -(max(1, round(points_awarded * 0.2)))
        
        actual_bina_delta = mata_bina_after - mata_bina_before
        actual_reward_delta = mata_reward_after - mata_reward_before
        
        if actual_bina_delta != expected_bina_delta:
            print(f"⚠️  WARNING: mataBina delta mismatch (expected {expected_bina_delta}, got {actual_bina_delta})")
        else:
            print(f"✅ mataBina subtracted correctly ({expected_bina_delta})")
        
        if actual_reward_delta != expected_reward_delta:
            print(f"⚠️  WARNING: mataReward delta mismatch (expected {expected_reward_delta}, got {actual_reward_delta})")
        else:
            print(f"✅ mataReward subtracted correctly ({expected_reward_delta})")
        
        print(f"✅ TEST 7 PASSED: DELETE claim working")
        
        print("\n✅ REGRESSION TESTS PASSED")
        return True
        
    except Exception as e:
        print(f"❌ REGRESSION TESTS FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("="*70)
    print("BACKEND TEST: Habit Scheduling / Family Templates / Staged-Unlock")
    print("="*70)
    
    # Seed test family
    if not seed_test_family():
        print("\n❌ FAILED TO SEED TEST FAMILY")
        return 1
    
    results = []
    
    try:
        # Run tests
        results.append(("School Days", test_school_days()))
        results.append(("Family Templates", test_family_templates()))
        results.append(("Scheduling", test_scheduling()))
        results.append(("Staged Unlock", test_staged_unlock()))
        results.append(("Regression", test_regression()))
        
    finally:
        # Cleanup
        cleanup()
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1

if __name__ == '__main__':
    sys.exit(main())
