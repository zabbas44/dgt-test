// The 14 study areas used to slice progress. Keys match the `t` field in questions.json.
export const TOPICS = [
  { key: 'senales',        icon: '🚸', en: 'Signs & signals',        es: 'Señales y semáforos' },
  { key: 'normas',         icon: '🛣️', en: 'Rules of the road',      es: 'Normas de circulación' },
  { key: 'maniobras',      icon: '↩️', en: 'Manoeuvres',             es: 'Maniobras' },
  { key: 'velocidad',      icon: '⏱️', en: 'Speed & distance',       es: 'Velocidad y distancias' },
  { key: 'prioridad',      icon: '⚖️', en: 'Priority & junctions',   es: 'Prioridad e intersecciones' },
  { key: 'adelantamiento', icon: '↗️', en: 'Overtaking',             es: 'Adelantamiento' },
  { key: 'estacionamiento',icon: '🅿️', en: 'Stopping & parking',     es: 'Parada y estacionamiento' },
  { key: 'seguridad',      icon: '🦺', en: 'Safety & risk factors',  es: 'Seguridad vial' },
  { key: 'vehiculo',       icon: '🔧', en: 'Vehicle & mechanics',    es: 'El vehículo y mecánica' },
  { key: 'documentacion',  icon: '📄', en: 'Documents & penalties',  es: 'Documentación y sanciones' },
  { key: 'accidentes',     icon: '🚑', en: 'Accidents & first aid',  es: 'Accidentes y primeros auxilios' },
  { key: 'salud',          icon: '🍺', en: 'Alcohol, drugs & health',es: 'Alcohol, drogas y salud' },
  { key: 'medioambiente',  icon: '🌱', en: 'Environment & eco-driving', es: 'Medio ambiente y conducción eficiente' },
  { key: 'transporte',     icon: '🚚', en: 'Loads, trailers & passengers', es: 'Carga, remolques y pasajeros' },
]

export const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.key, t]))
export const topicName = (key, lang) => (TOPIC_MAP[key] ? TOPIC_MAP[key][lang] : key)
export const topicIcon = (key) => (TOPIC_MAP[key] ? TOPIC_MAP[key].icon : '•')
