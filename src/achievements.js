export const ACHIEVEMENTS = [
    { id: 'first_open',        emoji: '📖', name: 'Primera Pagina',         desc: 'Abre tu primer libro',                              rarity: 'common',    condition: ({ books }) => books.some((b) => b.lastReadDate > 0) },
    { id: 'library_5',         emoji: '📚', name: 'Bibliofilo',             desc: 'Anade 5 libros a tu biblioteca',                    rarity: 'common',    condition: ({ books }) => books.filter((b) => !b.loading).length >= 5 },
    { id: 'library_20',        emoji: '🏛️', name: 'Archivero',              desc: 'Anade 20 libros a tu biblioteca',                   rarity: 'rare',      condition: ({ books }) => books.filter((b) => !b.loading).length >= 20 },
    { id: 'library_50',        emoji: '🗄️', name: 'Curador',                desc: 'Anade 50 libros a tu biblioteca',                   rarity: 'epic',      condition: ({ books }) => books.filter((b) => !b.loading).length >= 50 },
    { id: 'first_finish',      emoji: '🏁', name: 'Fin del Capitulo',       desc: 'Termina tu primer libro',                           rarity: 'rare',      condition: ({ books }) => books.some((b) => b.isFinished) },
    { id: 'books_finished_5',  emoji: '🏆', name: 'Coleccionista',          desc: 'Termina 5 libros',                                  rarity: 'epic',      condition: ({ books }) => books.filter((b) => b.isFinished).length >= 5 },
    { id: 'books_finished_10', emoji: '👑', name: 'Gran Lector',            desc: 'Termina 10 libros',                                 rarity: 'legendary', condition: ({ books }) => books.filter((b) => b.isFinished).length >= 10 },
    { id: 'books_finished_20', emoji: '🏰', name: 'Biblioteca Conquistada', desc: 'Termina 20 libros',                                 rarity: 'legendary', condition: ({ books }) => books.filter((b) => b.isFinished).length >= 20 },
    { id: 'streak_7',          emoji: '🔥', name: 'Semana Perfecta',        desc: 'Manten una racha de 7 dias',                        rarity: 'rare',      condition: ({ stats }) => (stats.streak || 0) >= 7 },
    { id: 'streak_30',         emoji: '⚡', name: 'Mes Imparable',          desc: 'Manten una racha de 30 dias',                       rarity: 'epic',      condition: ({ stats }) => (stats.streak || 0) >= 30 },
    { id: 'streak_100',        emoji: '🌟', name: 'Centenario',             desc: 'Manten una racha de 100 dias',                      rarity: 'legendary', condition: ({ stats }) => (stats.streak || 0) >= 100 },
    { id: 'streak_365',        emoji: '🌌', name: 'Ano Imparable',          desc: 'Manten una racha de 365 dias',                      rarity: 'legendary', condition: ({ stats }) => (stats.streak || 0) >= 365 },
    { id: 'time_60',           emoji: '⏱️', name: 'Primera Hora',           desc: 'Lee 1 hora en total',                               rarity: 'common',    condition: ({ stats }) => (stats.timeRead || 0) >= 60 },
    { id: 'time_600',          emoji: '🕐', name: 'Maraton',                desc: 'Lee 10 horas en total',                             rarity: 'rare',      condition: ({ stats }) => (stats.timeRead || 0) >= 600 },
    { id: 'time_1800',         emoji: '🪫', name: 'Resistencia',            desc: 'Lee 30 horas en total',                             rarity: 'epic',      condition: ({ stats }) => (stats.timeRead || 0) >= 1800 },
    { id: 'time_6000',         emoji: '🧠', name: 'Sabio',                  desc: 'Lee 100 horas en total',                            rarity: 'legendary', condition: ({ stats }) => (stats.timeRead || 0) >= 6000 },
    { id: 'pages_100',         emoji: '📄', name: 'Hojeador',               desc: 'Pasa 100 paginas',                                  rarity: 'common',    condition: ({ stats }) => (stats.pagesTurned || 0) >= 100 },
    { id: 'pages_1000',        emoji: '📜', name: 'Devorador',              desc: 'Pasa 1000 paginas',                                 rarity: 'epic',      condition: ({ stats }) => (stats.pagesTurned || 0) >= 1000 },
    { id: 'pages_5000',        emoji: '🌊', name: 'Tormenta de Paginas',    desc: 'Pasa 5000 paginas',                                 rarity: 'legendary', condition: ({ stats }) => (stats.pagesTurned || 0) >= 5000 },
    { id: 'bookmarks_10',      emoji: '🔖', name: 'Cartografo',             desc: 'Anade 10 marcadores o subrayados',                  rarity: 'rare',      condition: ({ books }) => books.reduce((sum, b) => sum + (b.bookmarks?.length || 0), 0) >= 10 },
    { id: 'bookmarks_25',      emoji: '🗂️', name: 'Archivista',             desc: 'Anade 25 marcadores o subrayados',                  rarity: 'epic',      condition: ({ books }) => books.reduce((sum, b) => sum + (b.bookmarks?.length || 0), 0) >= 25 },
    { id: 'vocab_10',          emoji: '📝', name: 'Lexicografo',            desc: 'Guarda 10 palabras en vocabulario',                 rarity: 'rare',      condition: ({ vocabulary }) => vocabulary.length >= 10 },
    { id: 'vocab_50',          emoji: '🧾', name: 'Maestro del Lexico',     desc: 'Guarda 50 palabras en vocabulario',                 rarity: 'legendary', condition: ({ vocabulary }) => vocabulary.length >= 50 },
    { id: 'night_owl',         emoji: '🦉', name: 'Buho Nocturno',          desc: 'Lee despues de medianoche',                         rarity: 'rare',      condition: ({ stats }) => ((stats.hourlyLog || {})[0] || 0) + ((stats.hourlyLog || {})[23] || 0) > 0 },
    { id: 'early_bird',        emoji: '🌅', name: 'Madrugador',             desc: 'Lee antes de las 6 de la manana',                   rarity: 'rare',      condition: ({ stats }) => [4, 5].some((h) => ((stats.hourlyLog || {})[h] || 0) > 0) },
    { id: 'quote_exported',    emoji: '🖼️', name: 'Artista de Citas',       desc: 'Exporta una cita como imagen',                      rarity: 'rare',      condition: ({ stats }) => !!stats.quoteExported },
    { id: 'yearly_goal',       emoji: '🎯', name: 'Proposito Cumplido',     desc: 'Completa tu meta anual de lectura',                 rarity: 'epic',      condition: ({ books, yearlyGoal }) => { const year = new Date().getFullYear(); return books.filter((b) => b.isFinished && b.dateFinished && new Date(b.dateFinished).getFullYear() === year).length >= (yearlyGoal || 12); } },
    { id: 'workshop_user',     emoji: '🔧', name: 'Personalizador',         desc: 'Activa tu primer addon en el Workshop',             rarity: 'common',    condition: ({ addons }) => Object.values(addons || {}).some(Boolean) },
    { id: 'all_themes',        emoji: '🎨', name: 'Disenador',              desc: 'Prueba los 3 temas disponibles',                    rarity: 'rare',      condition: ({ stats }) => (stats.themesUsed || []).length >= 3 },
    { id: 'favorites_10',      emoji: '⭐', name: 'Estanteria Dorada',      desc: 'Marca 10 libros como favoritos',                    rarity: 'epic',      condition: ({ books }) => books.filter((b) => b.isFav).length >= 10 },
    { id: 'addon_dyslexia',    emoji: 'Aa', name: 'Lectura Comoda',          desc: 'Activa el modo dislexia',                           rarity: 'common',    addonAchievement: true, visibleWhen: ({ addons }) => !!addons?.dyslexiaMode, condition: ({ addons }) => !!addons?.dyslexiaMode },
    { id: 'addon_sharky',      emoji: '🦈', name: 'Companero de Lectura',     desc: 'Activa la mascota Sharky',                          rarity: 'common',    addonAchievement: true, visibleWhen: ({ addons }) => !!addons?.sharkyMascot, condition: ({ addons }) => !!addons?.sharkyMascot },
    { id: 'sharky_pet',        emoji: '♥', name: 'Caricia Marina',           desc: 'Acaricia a Sharky con click derecho',               rarity: 'rare',      addonAchievement: true, visibleWhen: ({ addons, stats }) => !!addons?.sharkyMascot || (stats?.sharkyPets || 0) > 0, condition: ({ addons, stats }) => !!addons?.sharkyMascot && (stats?.sharkyPets || 0) >= 1 },
    { id: 'addon_roulette',    emoji: '🎲', name: 'Azar Controlado',          desc: 'Usa la ruleta de libros',                           rarity: 'rare',      addonAchievement: true, visibleWhen: ({ addons, stats }) => !!addons?.bookRoulette || (stats?.rouletteSpins || 0) > 0, condition: ({ addons, stats }) => !!addons?.bookRoulette && (stats?.rouletteSpins || 0) >= 1 },
    { id: 'addons_5_active',   emoji: '🧩', name: 'Taller Activo',            desc: 'Ten 5 addons activos al mismo tiempo',              rarity: 'epic',      addonAchievement: true, visibleWhen: ({ addons }) => Object.values(addons || {}).filter(Boolean).length >= 1, condition: ({ addons }) => Object.values(addons || {}).filter(Boolean).length >= 5 },

    // ── v3.7 — Nuevos logros ─────────────────────────────────────────────────
    // Biblioteca
    { id: 'library_100',       emoji: '🏛️', name: 'Gran Archivo',             desc: 'Añade 100 libros a tu biblioteca',                  rarity: 'epic',      condition: ({ books }) => books.filter(b => !b.loading).length >= 100 },
    { id: 'library_200',       emoji: '🌆', name: 'Ciudad de Libros',         desc: 'Añade 200 libros a tu biblioteca',                  rarity: 'legendary', condition: ({ books }) => books.filter(b => !b.loading).length >= 200 },
    // Libros terminados
    { id: 'books_finished_30', emoji: '🎖️', name: 'Veterano Lector',          desc: 'Termina 30 libros',                                 rarity: 'legendary', condition: ({ books }) => books.filter(b => b.isFinished).length >= 30 },
    { id: 'books_finished_50', emoji: '🌟', name: 'Medio Centenar',           desc: 'Termina 50 libros',                                 rarity: 'legendary', condition: ({ books }) => books.filter(b => b.isFinished).length >= 50 },
    // Rachas
    { id: 'streak_14',         emoji: '🌊', name: 'Dos Semanas',              desc: 'Mantén una racha de 14 días',                       rarity: 'rare',      condition: ({ stats }) => (stats.streak || 0) >= 14 },
    // Tiempo
    { id: 'time_120',          emoji: '⏳', name: 'Dos Horas',                desc: 'Lee 2 horas en total',                              rarity: 'common',    condition: ({ stats }) => (stats.timeRead || 0) >= 120 },
    { id: 'time_12000',        emoji: '🔭', name: 'Dos Centenares',           desc: 'Lee 200 horas en total',                            rarity: 'legendary', condition: ({ stats }) => (stats.timeRead || 0) >= 12000 },
    // Páginas
    { id: 'pages_10000',       emoji: '📦', name: 'Diez Mil Páginas',         desc: 'Pasa 10.000 páginas',                               rarity: 'legendary', condition: ({ stats }) => (stats.pagesTurned || 0) >= 10000 },
    // Anotaciones
    { id: 'bookmarks_50',      emoji: '🗃️', name: 'Colección de Ideas',       desc: 'Añade 50 marcadores o subrayados',                  rarity: 'epic',      condition: ({ books }) => books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0) >= 50 },
    { id: 'bookmarks_100',     emoji: '📚', name: 'Mente Subrayada',          desc: 'Añade 100 marcadores o subrayados',                 rarity: 'legendary', condition: ({ books }) => books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0) >= 100 },
    // Vocabulario
    { id: 'vocab_25',          emoji: '📖', name: 'Lexicón Creciente',        desc: 'Guarda 25 palabras en vocabulario',                 rarity: 'rare',      condition: ({ vocabulary }) => vocabulary.length >= 25 },
    // Lector de PDF
    { id: 'first_pdf',         emoji: '📋', name: 'Lector de Documentos',     desc: 'Abre tu primer PDF',                                rarity: 'common',    condition: ({ books }) => books.some(b => b.type === 'pdf' && b.lastReadDate > 0) },
    // Series
    { id: 'series_starter',    emoji: '🎬', name: 'Inicio de Saga',           desc: 'Empieza a leer una serie',                          rarity: 'rare',      condition: ({ books }) => books.some(b => b.series && b.lastReadDate > 0) },
    { id: 'series_completer',  emoji: '🏅', name: 'Serie Completa',           desc: 'Termina todos los libros de una serie',             rarity: 'epic',      condition: ({ books }) => { const seriesMap = {}; books.forEach(b => { if (!b.series) return; if (!seriesMap[b.series]) seriesMap[b.series] = { total: 0, done: 0 }; seriesMap[b.series].total++; if (b.isFinished) seriesMap[b.series].done++; }); return Object.values(seriesMap).some(s => s.total >= 2 && s.done === s.total); } },
    // Sistema de niveles
    { id: 'level_5',           emoji: '⭐', name: 'Lector Consagrado',        desc: 'Alcanza el nivel 5',                                rarity: 'rare',      condition: ({ books, stats, addonConfig }) => { const xp = Math.max(0,(stats.timeRead||0)*2)+books.filter(b=>b.isFinished).length*80+books.reduce((s,b)=>s+(b.bookmarks?.length||0)*8,0); return Math.floor(xp/((addonConfig?.levelSystem?.xpPerLevel)||100))+1>=5; } },
    { id: 'level_10',          emoji: '💎', name: 'Maestro del Nivel',        desc: 'Alcanza el nivel 10',                               rarity: 'epic',      condition: ({ books, stats, addonConfig }) => { const xp = Math.max(0,(stats.timeRead||0)*2)+books.filter(b=>b.isFinished).length*80+books.reduce((s,b)=>s+(b.bookmarks?.length||0)*8,0); return Math.floor(xp/((addonConfig?.levelSystem?.xpPerLevel)||100))+1>=10; } },
    // Hábitos
    { id: 'dedicated_session', emoji: '🧘', name: 'Sesión Profunda',          desc: 'Lee más de 60 minutos en un solo libro',            rarity: 'rare',      condition: ({ books }) => books.some(b => (b.readingMinutes || 0) >= 60) },
    { id: 'favorites_5',       emoji: '💛', name: 'Elegidos del Corazón',     desc: 'Marca 5 libros como favoritos',                     rarity: 'common',    condition: ({ books }) => books.filter(b => b.isFav).length >= 5 },
    { id: 'two_series',        emoji: '🗺️', name: 'Explorador de Sagas',      desc: 'Ten libros de 2 series distintas',                  rarity: 'rare',      condition: ({ books }) => new Set(books.map(b => b.series).filter(Boolean)).size >= 2 },
    // Horarios especiales
    { id: 'night_marathon',    emoji: '🌃', name: 'Maratón Nocturno',         desc: 'Lee más de 30 minutos pasada la medianoche',        rarity: 'epic',      condition: ({ stats }) => ((stats.hourlyLog||{})[0]||0)+((stats.hourlyLog||{})[1]||0)+((stats.hourlyLog||{})[2]||0) >= 30 },
    { id: 'weekend_reader',    emoji: '🛋️', name: 'Lector de Fin de Semana',  desc: 'Lee 3 horas en un único día',                       rarity: 'epic',      condition: ({ stats }) => Object.values(stats.minutesByDay||{}).some(m => m >= 180) },
    // Integración y exportación
    { id: 'obsidian_exporter', emoji: '🔗', name: 'Puente al Vault',          desc: 'Exporta tus anotaciones a Obsidian',                rarity: 'rare',      condition: () => { try { return !!localStorage.getItem('sr_obsidian_exported'); } catch(_) { return false; } } },
    // Ruleta
    { id: 'roulette_10',       emoji: '🎰', name: 'Fortuna Lectora',          desc: 'Usa la ruleta de libros 10 veces',                  rarity: 'epic',      addonAchievement: true, visibleWhen: ({ addons, stats }) => !!addons?.bookRoulette || (stats?.rouletteSpins||0) > 0, condition: ({ addons, stats }) => !!addons?.bookRoulette && (stats?.rouletteSpins||0) >= 10 },
    { id: 'reading_plan',      emoji: '📆', name: 'Planificador Lector',      desc: 'Establece un plan de lectura con fecha objetivo',   rarity: 'rare',      condition: ({ stats }) => !!stats.readingPlanSet },
];

export const RARITY = {
    common: { label: 'Comun', color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)' },
    rare: { label: 'Raro', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
    epic: { label: 'Epico', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' },
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
};

export const isAchievementVisible = (achievement, context = {}, existing = {}) =>
    !!existing[achievement.id] || !achievement.addonAchievement || !achievement.visibleWhen || achievement.visibleWhen(context);

export const checkNewAchievements = (context, existing) =>
    ACHIEVEMENTS.filter((achievement) => !existing[achievement.id] && achievement.condition(context));
