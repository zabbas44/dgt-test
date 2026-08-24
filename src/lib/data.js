// Loads the question bank. The offline single-file build inlines the data on
// `window.__DGT_QUESTIONS__`; the normal build fetches it from /data.
export async function loadQuestions() {
  if (typeof window !== 'undefined' && window.__DGT_QUESTIONS__) {
    return window.__DGT_QUESTIONS__
  }
  const url = new URL('data/questions.json', document.baseURI)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load questions.json (${res.status})`)
  return res.json()
}

// Where the photos live. The offline single-file build sets
// window.__DGT_IMG_BASE__ so one copy of the images can serve both builds.
export const imgUrl = (file) => {
  const base = (typeof window !== 'undefined' && window.__DGT_IMG_BASE__) || new URL('img/', document.baseURI).href
  return `${base}${file}`
}
