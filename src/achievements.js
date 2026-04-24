export const ACHIEVEMENTS = [
    { id: 'first_open',       emoji: '📖', name: 'Primera Página',      desc: 'Abre tu primer libro',                        rarity: 'common',    condition: ({ books }) => books.some(b => b.lastReadDate > 0) },
    { id: 'library_5',        emoji: '📚', name: 'Bibliófilo',           desc: 'Añade 5 libros a tu biblioteca',              rarity: 'common',    condition: ({ books }) => books.filter(b => !b.loading).length >= 5 },
    { id: 'library_20',       emoji: '🏛️', name: 'Archivero',            desc: 'Añade 20 libros a tu biblioteca',             rarity: 'rare',      condition: ({ books }) => books.filter(b => !b.loading).length >= 20 },
    { id: 'first_finish',     emoji: '🏁', name: 'Fin del Capítulo',     desc: 'Termina tu primer libro',                     rarity: 'rare',      condition: ({ books }) => books.some(b => b.isFinished) },
    { id: 'books_finished_5', emoji: '🏆', name: 'Coleccionista',        desc: 'Termina 5 libros',                            rarity: 'epic',      condition: ({ books }) => books.filter(b => b.isFinished).length >= 5 },
    { id: 'books_finished_10',emoji: '👑', name: 'Gran Lector',          desc: 'Termina 10 libros',                           rarity: 'legendary', condition: ({ books }) => books.filter(b => b.isFinished).length >= 10 },
    { id: 'streak_7',         emoji: '🔥', name: 'Semana Perfecta',      desc: 'Mantén una racha de 7 días',                  rarity: 'rare',      condition: ({ stats }) => (stats.streak || 0) >= 7 },
    { id: 'streak_30',        emoji: '⚡', name: 'Mes Imparable',        desc: 'Mantén una racha de 30 días',                 rarity: 'epic',      condition: ({ stats }) => (stats.streak || 0) >= 30 },
    { id: 'streak_100',       emoji: '🌟', name: 'Centenario',           desc: 'Mantén una racha de 100 días',                rarity: 'legendary', condition: ({ stats }) => (stats.streak || 0) >= 100 },
    { id: 'time_60',          emoji: '⏱️', name: 'Primera Hora',         desc: 'Lee 1 hora en total',                         rarity: 'common',    condition: ({ stats }) => (stats.timeRead || 0) >= 60 },
    { id: 'time_600',         emoji: '🕐', name: 'Maratón',              desc: 'Lee 10 horas en total',                       rarity: 'rare',      condition: ({ stats }) => (stats.timeRead || 0) >= 600 },
    { id: 'time_6000',        emoji: '🧠', name: 'Sabio',                desc: 'Lee 100 horas en total',                      rarity: 'legendary', condition: ({ stats }) => (stats.timeRead || 0) >= 6000 },
    { id: 'pages_100',        emoji: '📄', name: 'Hojeador',             desc: 'Pasa 100 páginas',                            rarity: 'common',    condition: ({ stats }) => (stats.pagesTurned || 0) >= 100 },
    { id: 'pages_1000',       emoji: '📜', name: 'Devorador',            desc: 'Pasa 1000 páginas',                           rarity: 'epic',      condition: ({ stats }) => (stats.pagesTurned || 0) >= 1000 },
    { id: 'bookmarks_10',     emoji: '🔖', name: 'Cartógrafo',           desc: 'Añade 10 marcadores o subrayados',            rarity: 'rare',      condition: ({ books }) => books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0) >= 10 },
    { id: 'vocab_10',         emoji: '📝', name: 'Lexicógrafo',          desc: 'Guarda 10 palabras en vocabulario',           rarity: 'rare',      condition: ({ vocabulary }) => vocabulary.length >= 10 },
    { id: 'wpm_300',          emoji: '🚀', name: 'Lector Veloz',         desc: 'Alcanza una velocidad de 300 WPM',            rarity: 'epic',      condition: ({ stats }) => stats.timeRead > 10 && Math.round((stats.pagesTurned * 250) / stats.timeRead) >= 300 },
    { id: 'night_owl',        emoji: '🦉', name: 'Búho Nocturno',        desc: 'Lee después de medianoche',                   rarity: 'rare',      condition: ({ stats }) => ((stats.hourlyLog || {})[0] || 0) + ((stats.hourlyLog || {})[23] || 0) > 0 },
    { id: 'early_bird',       emoji: '🌅', name: 'Madrugador',           desc: 'Lee antes de las 6 de la mañana',             rarity: 'rare',      condition: ({ stats }) => [4, 5].some(h => ((stats.hourlyLog || {})[h] || 0) > 0) },
    { id: 'quote_exported',   emoji: '🖼️', name: 'Artista de Citas',     desc: 'Exporta una cita como imagen',                rarity: 'rare',      condition: ({ stats }) => !!stats.quoteExported },
    { id: 'yearly_goal',      emoji: '🎯', name: 'Propósito Cumplido',   desc: 'Completa tu meta anual de lectura',           rarity: 'epic',      condition: ({ books, yearlyGoal }) => { const y = new Date().getFullYear(); return books.filter(b => b.isFinished && b.dateFinished && new Date(b.dateFinished).getFullYear() === y).length >= (yearlyGoal || 12); } },
    { id: 'workshop_user',    emoji: '🔧', name: 'Personalizador',       desc: 'Activa tu primer addon en el Workshop',       rarity: 'common',    condition: ({ addons }) => Object.values(addons || {}).some(Boolean) },
    { id: 'all_themes',       emoji: '🎨', name: 'Diseñador',            desc: 'Prueba los 3 temas disponibles',              rarity: 'rare',      condition: ({ stats }) => (stats.themesUsed || []).length >= 3 },
];

export const RARITY = {
    common:    { label: 'Común',    color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)' },
    rare:      { label: 'Raro',     color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
    epic:      { label: 'Épico',    color: '#a855f7', bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.4)' },
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
};

export const checkNewAchievements = (context, existing) =>
    ACHIEVEMENTS.filter(a => !existing[a.id] && a.condition(context));
