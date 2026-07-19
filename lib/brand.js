/**
 * EQrel Brand Assets — Central export.
 * When user provides new mascot/logo assets, update URLs here ONLY.
 * All UI components import from this file.
 */
export const BRAND = {
  name: 'EQrel',
  tagline: {
    ms: 'Bina Habits. Suburkan Iman.',
    en: 'Build Habits. Grow Iman.',
    id: 'Bangun Kebiasaan. Tumbuhkan Iman.',
    ar: 'ابنِ العادات. أنبت الإيمان.',
  },
  colors: {
    primary: '#00B894',   // teal-emerald
    cream:   '#FFF8E7',
    ink:     '#2D3436',
    yellow:  '#FFB703',
  },
  // Mascot: "EQ" greeting companion (current placeholder — replace when user provides new asset)
  mascot: {
    default: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/33belexr_eq-greeting-companion.png',
    // Future poses (waving, reading, praying etc.) can be added here
    greeting: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/33belexr_eq-greeting-companion.png',
    reading: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/33belexr_eq-greeting-companion.png',
    praying: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/33belexr_eq-greeting-companion.png',
  },
  // Logo/wordmark (placeholder — user will provide dedicated SVG/PNG)
  logo: {
    icon: null,       // small icon-only version (to be provided)
    wordmark: null,   // full "EQrel" wordmark image (to be provided)
  },
  // Mascot's "voice" — how it introduces content
  mascotVoice: {
    hadith: {
      ms: 'Rasulullah ﷺ bersabda…',
      en: 'The Prophet ﷺ said…',
      id: 'Rasulullah ﷺ bersabda…',
      ar: 'قال رسول الله ﷺ:',
    },
    doa: {
      ms: 'Mari kita berdoa…',
      en: 'Let us pray…',
      id: 'Mari kita berdoa…',
      ar: 'لندعُ الله…',
    },
    greet: {
      ms: 'Assalamualaikum!',
      en: 'Assalamu\u2019alaikum!',
      id: 'Assalamualaikum!',
      ar: 'السَّلَامُ عَلَيْكُمْ!',
    },
  },
}
