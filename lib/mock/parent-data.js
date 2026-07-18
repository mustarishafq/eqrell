// Mock data for Cohort A Dashboard demo
// Replace with real API calls after auth setup

export const mockParent = {
  id: 'demo-parent-1',
  name: 'Mama',
  email: 'mama@demo.eqrel.com',
  familyId: 'fam-demo-1',
  avatar: null,
  locale: 'ms',
}

// DOB used to auto-calculate age & age band
export const mockChildren = [
  {
    id: 'child-adam',
    nickname: 'Adam',
    dob: '2020-03-15',
    gender: 'male',
    ageBand: '5-6',
    avatarType: 'boy-kopiah-white',
    skinTone: 'light',
    hasGlasses: false,
    favColor: 'green',
    preferredLang: 'ms',
    todayCompleted: 5,
    todayTotal: 6,
    lightLevel: 100,
    blackClouds: 0,
    buildingCount: 3,
  },
  {
    id: 'child-aisyah',
    nickname: 'Aisyah',
    dob: '2022-08-20',
    gender: 'female',
    ageBand: '3-4',
    avatarType: 'girl-hijab-coral',
    skinTone: 'light',
    hasGlasses: false,
    favColor: 'coral',
    preferredLang: 'ms',
    todayCompleted: 4,
    todayTotal: 4,
    lightLevel: 100,
    blackClouds: 0,
    buildingCount: 2,
  },
]

export const mockFamily = {
  id: 'fam-demo-1',
  name: 'Keluarga Demo',
  streakDays: 42,
  pendingVerifications: 2,
  timezone: 'Asia/Kuala_Lumpur',
  locationCity: 'Kuala Lumpur',
  familyQuestActive: false,
}
