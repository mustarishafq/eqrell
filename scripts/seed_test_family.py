#!/usr/bin/env python3
"""Seed a complete test family (parent + 2 kids + baseline habits + perPrayer Wudhu)
for frontend UI testing. Prints session cookie value + child IDs to stdout.

Usage:
    python /app/scripts/seed_test_family.py
"""
import os
import sys
import uuid
from datetime import datetime, timedelta

# Add /app to path to import if needed
sys.path.insert(0, '/app')

from jose import jwt
from pymongo import MongoClient

# Config
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')

# Read AUTH_SECRET from /app/.env if not set
if AUTH_SECRET == 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08':
    try:
        with open('/app/.env') as f:
            for line in f:
                if line.startswith('AUTH_SECRET='):
                    AUTH_SECRET = line.strip().split('=', 1)[1].strip('"').strip("'")
                    break
    except Exception:
        pass

# Random IDs
suffix = uuid.uuid4().hex[:8]
FAMILY_ID = f'test-fam-{suffix}'
USER_ID = f'test-user-{suffix}'
SESSION_ID = f'test-session-{suffix}'
CHILD_ID_1 = f'test-child-a-{suffix}'
CHILD_ID_2 = f'test-child-b-{suffix}'
EMAIL = f'test-{suffix}@eqrel.local'

# Connect
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

now = datetime.utcnow()
today_str = now.strftime('%Y-%m-%d')

# 1. Family
db.families.insert_one({
    'id': FAMILY_ID,
    'name': 'Keluarga Test',
    'code': f'TEST{suffix[:4].upper()}',
    'ownerUserId': USER_ID,
    'createdAt': now,
    'displayConfig': {
        'photos': [],
        'showHabits': True,
        'azanId': 'default',
        'dimMode': 'auto',
    },
    'zikirCount': 0,
})

# 2. User (parent)
db.users.insert_one({
    'id': USER_ID,
    'email': EMAIL,
    'name': 'Test Parent',
    'familyId': FAMILY_ID,
    'role': 'parent',
    'createdAt': now,
})

# 3. Session record
db.sessions.insert_one({
    'sid': SESSION_ID,
    'userId': USER_ID,
    'email': EMAIL,
    'createdAt': now,
    'expiresAt': now + timedelta(days=30),
})

# 4. Two children
db.children.insert_many([
    {
        'id': CHILD_ID_1, 'familyId': FAMILY_ID,
        'nickname': 'Ali', 'ageBand': 'k1',
        'avatarId': 'boy-1', 'favColor': '#00B894',
        'mataBina': 0, 'mataReward': 0,
        'createdAt': now,
    },
    {
        'id': CHILD_ID_2, 'familyId': FAMILY_ID,
        'nickname': 'Aisyah', 'ageBand': 'k1',
        'avatarId': 'girl-1', 'favColor': '#E84393',
        'mataBina': 0, 'mataReward': 0,
        'createdAt': now,
    },
])

# 5. Baseline habits for Ali (child 1)
habits = [
    # Solat Subuh — daily, subuh session
    {
        'id': f'test-habit-subuh-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ib-01', 'category': 'ibadah',
        'session': 'subuh', 'recurring': 'daily',
        'title': 'Solat Subuh', 'desc': 'Solat berjemaah subuh',
        'points': 20, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Solat Zohor
    {
        'id': f'test-habit-zohor-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ib-02', 'category': 'ibadah',
        'session': 'zohor', 'recurring': 'daily',
        'title': 'Solat Zohor', 'desc': '',
        'points': 20, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Wudhu — perPrayer (5x/day)
    {
        'id': f'test-habit-wudhu-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ib-10', 'category': 'ibadah',
        'session': 'anytime', 'recurring': 'perPrayer',
        'title': 'Wudhu', 'desc': 'Wudhu betul sebelum solat',
        'points': 10, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Baca doa makan — anytime
    {
        'id': f'test-habit-doa-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ib-06', 'category': 'ibadah',
        'session': 'anytime', 'recurring': 'daily',
        'title': 'Baca doa sebelum makan', 'desc': '',
        'points': 5, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Berus gigi — anytime
    {
        'id': f'test-habit-gigi-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ks-01', 'category': 'kesihatan',
        'session': 'anytime', 'recurring': 'daily',
        'title': 'Berus gigi', 'desc': 'Pagi & malam',
        'points': 10, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Tidur awal — sebelumTidur
    {
        'id': f'test-habit-tidur-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': 'ks-04', 'category': 'kesihatan',
        'session': 'sebelumTidur', 'recurring': 'daily',
        'title': 'Tidur awal', 'desc': 'Sebelum 10 malam',
        'points': 15, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
    # Doa selepas solat — perPrayer (custom)
    {
        'id': f'test-habit-doasolat-{suffix}',
        'familyId': FAMILY_ID, 'childId': CHILD_ID_1,
        'templateId': None, 'category': 'ibadah',
        'session': 'anytime', 'recurring': 'perPrayer',
        'title': 'Doa selepas solat', 'desc': 'Zikir + tasbih',
        'points': 5, 'frequency': 'daily', 'active': True,
        'assignedBy': USER_ID, 'createdAt': now, 'updatedAt': now,
    },
]
db.habits.insert_many(habits)

# 6. Sign JWT (must include iat and exp for jose (JS) to accept)
import time
now_epoch = int(time.time())
exp_epoch = now_epoch + 30 * 24 * 60 * 60  # 30 days
payload = {
    'sid': SESSION_ID,
    'userId': USER_ID,
    'email': EMAIL,
    'name': 'Test Parent',
    'familyId': FAMILY_ID,
    'role': 'parent',
    'iat': now_epoch,
    'exp': exp_epoch,
}
token = jwt.encode(payload, AUTH_SECRET, algorithm='HS256')

# 7. Print output for consumer
print(f'COOKIE={token}')
print(f'FAMILY_ID={FAMILY_ID}')
print(f'USER_ID={USER_ID}')
print(f'CHILD_ID_1={CHILD_ID_1}')
print(f'CHILD_ID_2={CHILD_ID_2}')
print(f'SESSION_ID={SESSION_ID}')

# Save to file for cleanup
with open('/tmp/eqrel_test_ids.txt', 'w') as f:
    f.write(f'FAMILY_ID={FAMILY_ID}\n')
    f.write(f'USER_ID={USER_ID}\n')
    f.write(f'CHILD_ID_1={CHILD_ID_1}\n')
    f.write(f'CHILD_ID_2={CHILD_ID_2}\n')
    f.write(f'SESSION_ID={SESSION_ID}\n')
    for h in habits:
        f.write(f'HABIT_ID={h["id"]}\n')

client.close()
