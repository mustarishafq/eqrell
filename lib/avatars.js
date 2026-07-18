/**
 * EQrel Avatar Library — Cohort A
 * 32 pre-rendered characters (16 boys + 16 girls)
 * Assets located at /public/avatars/boys/ and /public/avatars/girls/
 *
 * Every avatar has an `id` (used as the primary key in DB) and searchable tags
 * so the picker UI can filter/scroll intuitively.
 */

export const BOY_AVATARS = [
  { id: 'B01', src: '/avatars/boys/B01.png', tags: ['kopiah', 'putih', 'cerah'] },
  { id: 'B02', src: '/avatars/boys/B02.png', tags: ['songkok', 'sederhana'] },
  { id: 'B03', src: '/avatars/boys/B03.png', tags: ['rambut', 'pendek', 'sederhana'] },
  { id: 'B04', src: '/avatars/boys/B04.png', tags: ['rambut', 'cacak', 'sawo'] },
  { id: 'B05', src: '/avatars/boys/B05.png', tags: ['songkok', 'cermin-mata', 'sederhana'] },
  { id: 'B06', src: '/avatars/boys/B06.png', tags: ['rambut', 'kerinting', 'sederhana'] },
  { id: 'B07', src: '/avatars/boys/B07.png', tags: ['kopiah', 'putih', 'tahi-lalat', 'cerah'] },
  { id: 'B08', src: '/avatars/boys/B08.png', tags: ['serban', 'sederhana'] },

  { id: 'B09', src: '/avatars/boys/B09.png', tags: ['topi', 'cap', 'sederhana'] },
  { id: 'B10', src: '/avatars/boys/B10.png', tags: ['rambut', 'pendek', 'cerah'] },
  { id: 'B11', src: '/avatars/boys/B11.png', tags: ['rambut', 'cermin-mata', 'sederhana'] },
  { id: 'B12', src: '/avatars/boys/B12.png', tags: ['rambut', 'kerinting', 'sawo'] },
  { id: 'B13', src: '/avatars/boys/B13.png', tags: ['songkok', 'cerah'] },
  { id: 'B14', src: '/avatars/boys/B14.png', tags: ['songkok', 'gelap'] },
  { id: 'B15', src: '/avatars/boys/B15.png', tags: ['rambut', 'pendek', 'sederhana'] },
  { id: 'B16', src: '/avatars/boys/B16.png', tags: ['topeng', 'wira', 'sederhana'] },
]

export const GIRL_AVATARS = [
  { id: 'G01', src: '/avatars/girls/G01.png', tags: ['hijab', 'ungu', 'sederhana'] },
  { id: 'G02', src: '/avatars/girls/G02.png', tags: ['hijab', 'pink', 'cerah'] },
  { id: 'G03', src: '/avatars/girls/G03.png', tags: ['hijab', 'teal', 'sederhana'] },
  { id: 'G04', src: '/avatars/girls/G04.png', tags: ['hijab', 'coral', 'cerah'] },
  { id: 'G05', src: '/avatars/girls/G05.png', tags: ['hijab', 'hitam', 'sederhana'] },
  { id: 'G06', src: '/avatars/girls/G06.png', tags: ['rambut', 'reben-kuning', 'sederhana'] },
  { id: 'G07', src: '/avatars/girls/G07.png', tags: ['rambut', 'pendek', 'cerah'] },
  { id: 'G08', src: '/avatars/girls/G08.png', tags: ['ekor-kuda', 'sederhana'] },

  { id: 'G09', src: '/avatars/girls/G09.png', tags: ['rambut', 'cermin-mata', 'sederhana'] },
  { id: 'G10', src: '/avatars/girls/G10.png', tags: ['rambut', 'clip', 'cerah'] },
  { id: 'G11', src: '/avatars/girls/G11.png', tags: ['rambut', 'headband-pink', 'sederhana'] },
  { id: 'G12', src: '/avatars/girls/G12.png', tags: ['rambut', 'headband-pink', 'cerah'] },
  { id: 'G13', src: '/avatars/girls/G13.png', tags: ['rambut', 'bob', 'sederhana'] },
  { id: 'G14', src: '/avatars/girls/G14.png', tags: ['rambut', 'headband-kuning', 'sawo'] },
  { id: 'G15', src: '/avatars/girls/G15.png', tags: ['hijab', 'putih', 'cermin-mata', 'cerah'] },
  { id: 'G16', src: '/avatars/girls/G16.png', tags: ['sanggul', 'topeng-wira', 'cerah'] },
]

export const AVATAR_BY_ID = Object.fromEntries(
  [...BOY_AVATARS, ...GIRL_AVATARS].map((a) => [a.id, a])
)

export const DEFAULT_BOY_ID = 'B01'
export const DEFAULT_GIRL_ID = 'G01'
