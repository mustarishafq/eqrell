// Shared helpers for Parent Dashboard tabs (Tasks / Reports / Profile)
export const pick = (lang) => (ms, en, id, ar) =>
  lang === 'ar' ? (ar ?? en) : lang === 'en' ? en : lang === 'id' ? (id ?? ms) : ms

export const FAV_COLOR_MAP = {
  green: '#00B894', yellow: '#FFB703', orange: '#FF8A00', coral: '#FF5D6E',
  blue: '#2D9CDB', purple: '#9C7BD9', pink: '#EC4899', fresh: '#4CAF50',
}
export const colorOf = (child) => FAV_COLOR_MAP[child?.favColor] || (typeof child?.favColor === 'string' && child.favColor.startsWith('#') ? child.favColor : '#00B894')

export const habitTitle = (h, lang) => h?.i18n?.[lang]?.title || h?.title || '—'

export const TabHeader = ({ icon, title, sub, right }) => (
  <div className="bg-white rounded-3xl p-4 shadow-eq-card flex items-center gap-3 flex-shrink-0">
    <div className="w-12 h-12 rounded-2xl bg-eq-cream/60 flex items-center justify-center flex-shrink-0">
      <img src={icon} alt="" className="w-10 h-10 object-contain" />
    </div>
    <div className="flex-1 min-w-0">
      <h2 className="text-eq-ink font-extrabold text-xl leading-tight">{title}</h2>
      {sub && <p className="text-eq-ink/60 text-xs leading-snug mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
)
