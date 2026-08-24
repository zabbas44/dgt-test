// Achievement badges. A section badge is earned by sitting that section's
// 30-question test; the tier is the best score you have ever scored on it.
// 27/30 is the real DGT pass mark, so gold is deliberately set there.
export const TIERS = [
  { key: 'platinum', min: 1.0,   icon: '💎', en: 'Platinum', es: 'Platino' },
  { key: 'gold',     min: 0.9,   icon: '🥇', en: 'Gold',     es: 'Oro' },
  { key: 'silver',   min: 0.833, icon: '🥈', en: 'Silver',   es: 'Plata' },
  { key: 'bronze',   min: 0.666, icon: '🥉', en: 'Bronze',   es: 'Bronce' },
]

export function tierFor(best, outOf) {
  if (!outOf || !best) return null
  const r = best / outOf
  return TIERS.find((t) => r >= t.min) || null
}

export const badgeFor = (sectionBest, key) => {
  const rec = sectionBest?.[key]
  if (!rec || !rec.best) return null
  const tier = tierFor(rec.best, rec.outOf || 30)
  return tier ? { ...tier, best: rec.best, outOf: rec.outOf || 30, attempts: rec.attempts || 0 } : null
}

// How many of the 14 sections have a badge, and how many are gold or better.
export function badgeSummary(sectionBest, topics) {
  let earned = 0, gold = 0
  for (const t of topics) {
    const b = badgeFor(sectionBest, t.key)
    if (!b) continue
    earned++
    if (b.key === 'gold' || b.key === 'platinum') gold++
  }
  return { earned, gold, total: topics.length }
}
