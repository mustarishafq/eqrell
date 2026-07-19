#!/usr/bin/env python3
"""
Test suite for GET /api/family/streak endpoint
Tests all 9 scenarios specified in the review request
"""

import os
import sys
import asyncio
import aiohttp
from datetime import datetime, timedelta
from jose import jwt
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')

# MongoDB client
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

def generate_jwt_and_session(user_id, email, name):
    """Generate a JWT token and create session in DB for testing"""
    sid = f'test-session-{user_id}'
    payload = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'name': name,
        'iat': datetime.utcnow().timestamp(),
        'exp': (datetime.utcnow() + timedelta(days=30)).timestamp()
    }
    
    # Create session in database
    expires_at = datetime.utcnow() + timedelta(days=30)
    db.sessions.insert_one({
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': expires_at,
        'createdAt': datetime.utcnow()
    })
    
    return jwt.encode(payload, AUTH_SECRET, algorithm='HS256')

def get_date_str(days_offset=0):
    """Get date string in YYYY-MM-DD format with offset from today"""
    date = datetime.utcnow() + timedelta(days=days_offset)
    return date.strftime('%Y-%m-%d')

def cleanup_test_data():
    """Clean up all test data"""
    try:
        db.users.delete_many({'id': {'$regex': '^test-streak-'}})
        db.families.delete_many({'id': {'$regex': '^test-streak-'}})
        db.children.delete_many({'id': {'$regex': '^test-streak-'}})
        db.habit_claims.delete_many({'childId': {'$regex': '^test-streak-'}})
        db.sessions.delete_many({'userId': {'$regex': '^test-streak-'}})
        print("✓ Test data cleaned up")
    except Exception as e:
        print(f"✗ Cleanup error: {e}")

async def test_streak_endpoint():
    """Main test suite for /api/family/streak endpoint"""
    
    print("\n" + "="*80)
    print("TESTING: GET /api/family/streak endpoint")
    print("="*80 + "\n")
    
    # Clean up before starting
    cleanup_test_data()
    
    async with aiohttp.ClientSession() as session:
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 1: Auth required — 401 if no session
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 1] Auth required — 401 if no session")
        try:
            async with session.get(f"{API_URL}/family/streak") as resp:
                assert resp.status == 401, f"Expected 401, got {resp.status}"
                print("✅ PASS: Returns 401 without session")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 2: No family → returns zero response
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 2] No family → returns zero response")
        try:
            # Create user without family
            user_id = 'test-streak-user-no-family'
            db.users.insert_one({
                'id': user_id,
                'email': 'nofamily@test.local',
                'name': 'No Family User',
                'familyId': None,
                'role': None
            })
            
            token = generate_jwt_and_session(user_id, 'nofamily@test.local', 'No Family User')
            cookies = {'eqrel_session': token}
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 0, f"Expected streak=0, got {data['streak']}"
                assert data['longestStreak'] == 0, f"Expected longestStreak=0, got {data['longestStreak']}"
                assert data['todayDone'] == False, f"Expected todayDone=False, got {data['todayDone']}"
                assert data['days'] == [], f"Expected empty days array, got {data['days']}"
                print("✅ PASS: Returns zero response for user without family")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 3: No children in family → zero response
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 3] No children in family → zero response")
        try:
            # Create user with family but no children
            user_id = 'test-streak-user-no-children'
            family_id = 'test-streak-family-no-children'
            
            db.families.insert_one({
                'id': family_id,
                'code': 'NOCHILDZ',
                'createdAt': datetime.utcnow()
            })
            
            db.users.insert_one({
                'id': user_id,
                'email': 'nochildren@test.local',
                'name': 'No Children User',
                'familyId': family_id,
                'role': 'ibu'
            })
            
            token = generate_jwt_and_session(user_id, 'nochildren@test.local', 'No Children User')
            cookies = {'eqrel_session': token}
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 0, f"Expected streak=0, got {data['streak']}"
                assert data['longestStreak'] == 0, f"Expected longestStreak=0, got {data['longestStreak']}"
                assert data['todayDone'] == False, f"Expected todayDone=False, got {data['todayDone']}"
                assert data['days'] == [], f"Expected empty days array, got {data['days']}"
                print("✅ PASS: Returns zero response for family without children")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # Setup for remaining tests: Create family with children
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[SETUP] Creating test family with 2 children...")
        
        family_id = 'test-streak-family-main'
        user_id = 'test-streak-user-main'
        child1_id = 'test-streak-child-1'
        child2_id = 'test-streak-child-2'
        
        db.families.insert_one({
            'id': family_id,
            'code': 'STREAK01',
            'createdAt': datetime.utcnow()
        })
        
        db.users.insert_one({
            'id': user_id,
            'email': 'main@test.local',
            'name': 'Main Test User',
            'familyId': family_id,
            'role': 'ibu'
        })
        
        db.children.insert_one({
            'id': child1_id,
            'familyId': family_id,
            'nickname': 'Child One',
            'dob': '2018-01-01',
            'gender': 'male',
            'avatarId': 'B01',
            'createdAt': datetime.utcnow()
        })
        
        db.children.insert_one({
            'id': child2_id,
            'familyId': family_id,
            'nickname': 'Child Two',
            'dob': '2020-01-01',
            'gender': 'female',
            'avatarId': 'G01',
            'createdAt': datetime.utcnow()
        })
        
        token = generate_jwt_and_session(user_id, 'main@test.local', 'Main Test User')
        cookies = {'eqrel_session': token}
        
        print("✓ Test family created with 2 children")
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 4: Basic streak — done today only
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 4] Basic streak — done today only")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert 1 claim for today
            today_str = get_date_str(0)
            db.habit_claims.insert_one({
                'habitId': 'habit-1',
                'childId': child1_id,
                'dateStr': today_str,
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 1, f"Expected streak=1, got {data['streak']}"
                assert data['todayDone'] == True, f"Expected todayDone=True, got {data['todayDone']}"
                assert data['longestStreak'] == 1, f"Expected longestStreak=1, got {data['longestStreak']}"
                print(f"✅ PASS: streak=1, todayDone=True, longestStreak=1")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 5: Yesterday only (grace period)
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 5] Yesterday only (grace period)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert 1 claim for yesterday
            yesterday_str = get_date_str(-1)
            db.habit_claims.insert_one({
                'habitId': 'habit-1',
                'childId': child1_id,
                'dateStr': yesterday_str,
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 1, f"Expected streak=1 (grace period), got {data['streak']}"
                assert data['todayDone'] == False, f"Expected todayDone=False, got {data['todayDone']}"
                assert data['longestStreak'] == 1, f"Expected longestStreak=1, got {data['longestStreak']}"
                print(f"✅ PASS: streak=1 (grace period), todayDone=False, longestStreak=1")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 6: 3-day streak ending today
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 6] 3-day streak ending today")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert claims for today, yesterday, day-before-yesterday
            for offset in [0, -1, -2]:
                date_str = get_date_str(offset)
                db.habit_claims.insert_one({
                    'habitId': f'habit-{offset}',
                    'childId': child1_id,
                    'dateStr': date_str,
                    'status': 'verified',
                    'rubric': 'sah',
                    'pointsAwarded': 10,
                    'claimedAt': datetime.utcnow(),
                    'verifiedAt': datetime.utcnow()
                })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 3, f"Expected streak=3, got {data['streak']}"
                assert data['todayDone'] == True, f"Expected todayDone=True, got {data['todayDone']}"
                assert data['longestStreak'] == 3, f"Expected longestStreak=3, got {data['longestStreak']}"
                print(f"✅ PASS: streak=3, todayDone=True, longestStreak=3")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 7: Broken streak with grace
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 7] Broken streak with grace (gap of 2 days)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert claims for today and 3 days ago (gap of 2 days)
            db.habit_claims.insert_one({
                'habitId': 'habit-today',
                'childId': child1_id,
                'dateStr': get_date_str(0),
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            db.habit_claims.insert_one({
                'habitId': 'habit-3days',
                'childId': child1_id,
                'dateStr': get_date_str(-3),
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 1, f"Expected streak=1 (only today counts), got {data['streak']}"
                assert data['todayDone'] == True, f"Expected todayDone=True, got {data['todayDone']}"
                print(f"✅ PASS: streak=1 (broken by gap), todayDone=True")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 8: Longest ≠ current
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 8] Longest ≠ current (5-day run 20 days ago + 2-day current)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert 5-day run 20 days ago
            for offset in range(-24, -19):  # Days -24 to -20 (5 days)
                db.habit_claims.insert_one({
                    'habitId': f'habit-old-{offset}',
                    'childId': child1_id,
                    'dateStr': get_date_str(offset),
                    'status': 'verified',
                    'rubric': 'sah',
                    'pointsAwarded': 10,
                    'claimedAt': datetime.utcnow(),
                    'verifiedAt': datetime.utcnow()
                })
            
            # Insert 2-day current streak (today and yesterday)
            for offset in [0, -1]:
                db.habit_claims.insert_one({
                    'habitId': f'habit-current-{offset}',
                    'childId': child1_id,
                    'dateStr': get_date_str(offset),
                    'status': 'verified',
                    'rubric': 'sah',
                    'pointsAwarded': 10,
                    'claimedAt': datetime.utcnow(),
                    'verifiedAt': datetime.utcnow()
                })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 2, f"Expected streak=2, got {data['streak']}"
                assert data['longestStreak'] == 5, f"Expected longestStreak=5, got {data['longestStreak']}"
                assert data['todayDone'] == True, f"Expected todayDone=True, got {data['todayDone']}"
                print(f"✅ PASS: streak=2, longestStreak=5, todayDone=True")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 9: Multi-child ANY (only 1 child has claim today)
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 9] Multi-child ANY (only 1 child has claim today)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Only child1 has claim today, child2 has none
            db.habit_claims.insert_one({
                'habitId': 'habit-child1',
                'childId': child1_id,
                'dateStr': get_date_str(0),
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 1, f"Expected streak=1 (at least 1 child counts), got {data['streak']}"
                assert data['todayDone'] == True, f"Expected todayDone=True, got {data['todayDone']}"
                print(f"✅ PASS: streak=1 (multi-child ANY logic works)")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 10: Rubric filter (belum doesn't count)
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 10] Rubric filter (belum doesn't count)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert claim with rubric='belum' today
            db.habit_claims.insert_one({
                'habitId': 'habit-belum',
                'childId': child1_id,
                'dateStr': get_date_str(0),
                'status': 'verified',
                'rubric': 'belum',
                'pointsAwarded': 0,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 0, f"Expected streak=0 (belum doesn't count), got {data['streak']}"
                assert data['todayDone'] == False, f"Expected todayDone=False, got {data['todayDone']}"
                print(f"✅ PASS: streak=0 (belum filtered out correctly)")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 11: Cross-family isolation
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 11] Cross-family isolation")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Create another family with child
            other_family_id = 'test-streak-family-other'
            other_child_id = 'test-streak-child-other'
            
            db.families.insert_one({
                'id': other_family_id,
                'code': 'OTHER01',
                'createdAt': datetime.utcnow()
            })
            
            db.children.insert_one({
                'id': other_child_id,
                'familyId': other_family_id,
                'nickname': 'Other Child',
                'dob': '2019-01-01',
                'gender': 'male',
                'avatarId': 'B02',
                'createdAt': datetime.utcnow()
            })
            
            # Insert claim for other family's child today
            db.habit_claims.insert_one({
                'habitId': 'habit-other',
                'childId': other_child_id,
                'dateStr': get_date_str(0),
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'verifiedAt': datetime.utcnow()
            })
            
            # Our main user should see streak=0 (other family's claims don't count)
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                assert data['streak'] == 0, f"Expected streak=0 (cross-family isolation), got {data['streak']}"
                assert data['todayDone'] == False, f"Expected todayDone=False, got {data['todayDone']}"
                print(f"✅ PASS: streak=0 (cross-family claims not counted)")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
        
        # ═══════════════════════════════════════════════════════════════════════════
        # TEST 12: Days array (14 days, oldest first, YYYY-MM-DD format)
        # ═══════════════════════════════════════════════════════════════════════════
        print("\n[TEST 12] Days array (14 days, oldest first, YYYY-MM-DD format)")
        try:
            # Clean previous claims
            db.habit_claims.delete_many({'childId': {'$in': [child1_id, child2_id]}})
            
            # Insert claims for specific days in the last 14 days
            # Let's do: today, -2, -5, -7, -10 (5 days with claims)
            claim_days = [0, -2, -5, -7, -10]
            for offset in claim_days:
                db.habit_claims.insert_one({
                    'habitId': f'habit-day-{offset}',
                    'childId': child1_id,
                    'dateStr': get_date_str(offset),
                    'status': 'verified',
                    'rubric': 'sah',
                    'pointsAwarded': 10,
                    'claimedAt': datetime.utcnow(),
                    'verifiedAt': datetime.utcnow()
                })
            
            async with session.get(f"{API_URL}/family/streak", cookies=cookies) as resp:
                assert resp.status == 200, f"Expected 200, got {resp.status}"
                data = await resp.json()
                
                # Check days array
                days = data['days']
                assert len(days) == 14, f"Expected 14 days, got {len(days)}"
                
                # Check format and order (oldest first)
                for i, day in enumerate(days):
                    assert 'date' in day, f"Day {i} missing 'date' field"
                    assert 'done' in day, f"Day {i} missing 'done' field"
                    
                    # Check date format YYYY-MM-DD
                    date_str = day['date']
                    assert len(date_str) == 10, f"Date format incorrect: {date_str}"
                    assert date_str[4] == '-' and date_str[7] == '-', f"Date format incorrect: {date_str}"
                    
                    # Verify it's a valid date
                    try:
                        datetime.strptime(date_str, '%Y-%m-%d')
                    except ValueError:
                        raise AssertionError(f"Invalid date format: {date_str}")
                
                # Check that days are in ascending order (oldest first)
                for i in range(len(days) - 1):
                    date1 = datetime.strptime(days[i]['date'], '%Y-%m-%d')
                    date2 = datetime.strptime(days[i+1]['date'], '%Y-%m-%d')
                    assert date1 < date2, f"Days not in ascending order: {days[i]['date']} >= {days[i+1]['date']}"
                
                # Check that the last day is today
                today_str = get_date_str(0)
                assert days[-1]['date'] == today_str, f"Last day should be today ({today_str}), got {days[-1]['date']}"
                
                # Check that specific days have correct 'done' status
                # Today (offset 0) should be done
                assert days[-1]['done'] == True, f"Today should be done=True"
                
                # Day -2 should be done
                day_minus_2_str = get_date_str(-2)
                day_minus_2 = next((d for d in days if d['date'] == day_minus_2_str), None)
                assert day_minus_2 is not None, f"Day -2 ({day_minus_2_str}) not found in days array"
                assert day_minus_2['done'] == True, f"Day -2 should be done=True"
                
                # Day -1 should NOT be done (we didn't insert a claim for it)
                day_minus_1_str = get_date_str(-1)
                day_minus_1 = next((d for d in days if d['date'] == day_minus_1_str), None)
                assert day_minus_1 is not None, f"Day -1 ({day_minus_1_str}) not found in days array"
                assert day_minus_1['done'] == False, f"Day -1 should be done=False"
                
                print(f"✅ PASS: Days array has 14 days, oldest first, correct format YYYY-MM-DD")
                print(f"   Sample days: {days[0]['date']} (oldest) ... {days[-1]['date']} (today)")
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False
    
    # ═══════════════════════════════════════════════════════════════════════════
    # All tests passed!
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED (12/12)")
    print("="*80 + "\n")
    
    # Clean up after all tests
    cleanup_test_data()
    
    return True

if __name__ == '__main__':
    try:
        result = asyncio.run(test_streak_endpoint())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        cleanup_test_data()
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        cleanup_test_data()
        sys.exit(1)
