// Sharky dialogue data and pure helpers — no React, no side effects.
// SharkyContext imports everything it needs from here.

export function pickRandom(arr) {
    if (!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
}

export function getLines(personality, lang) {
    const p = DIALOGUE[personality] || DIALOGUE.friendly;
    return p[lang === 'en' ? 'en' : 'es'];
}

// ── Pools de diálogo por personalidad ──────────────────────────────────────
export const DIALOGUE = {
    friendly: {
        es: {
            idle: [
                '¿Cinco minutos de lectura hoy?',
                'Tu siguiente capítulo te espera.',
                'Hoy es buen día para leer algo.',
                'Un poco de lectura nunca hace daño.',
                'Tu biblioteca está esperando.',
                '¿Arrancamos con un capítulo corto?',
                'Leer es siempre buena idea.',
                'Un libro abierto es un mundo nuevo.',
                '¿Qué vas a leer hoy?',
                'Incluso una página cuenta.',
                '¿Le damos unos minutos a tu libro?',
                'Tu marcapáginas te está esperando con paciencia.',
                'Cualquier momento es buen momento para leer.',
                'Vamos, solo un capítulo. Prometo que no duele.',
            ],
            focus: [
                'Estoy en silencio. Tú lee.',
                'Modo lectura. Sin interrupciones.',
                'Concentrado. Aquí estoy si me necesitas.',
                'Leyendo... sigue, sigue.',
                'Silencio total. Disfruta el libro.',
                'No digo nada más. Disfruta tu historia.',
                'Aquí quietecito, mientras tú avanzas página a página.',
                'Todo tuyo. Yo solo observo con cariño.',
            ],
            celebrate: [
                'Meta diaria completada. ¡Bien hecho!',
                '¡Lo lograste! Meta del día cumplida.',
                'Hoy has leído lo suficiente. ¡Excelente!',
                'Meta cumplida. Merecido descanso.',
                '¡Eso es! Objetivo diario alcanzado.',
                'Otro día ganado para la lectura. ¡Orgulloso de ti!',
                '¡Meta lograda! Mereces un buen estiramiento.',
                'Cerraste el día como se debe: leyendo.',
            ],
            sleepy: [
                'Hace rato no mordemos páginas.',
                'Tu biblioteca extraña tus ojos.',
                'Llevas unos días sin leer. ¿Todo bien?',
                'Los libros se están poniendo ansiosos.',
                'Un capítulo pequeño para volver al ritmo.',
                'No pasa nada, retomamos cuando quieras.',
                'Tu libro sigue exactamente donde lo dejaste.',
                'Cuando estés listo, aquí seguimos los dos.',
            ],
            curious: [
                'Tienes varias lecturas activas. ¡Qué bárbaro!',
                'Muchos frentes abiertos. Me gusta tu estilo.',
                'Libros activos por doquier. ¡Eso es dedicación!',
                'Varios libros a la vez. Eres un lector de élite.',
                'Tanta lectura activa me pone nervioso de la emoción.',
                'Malabares de lectura. Te veo con varios libros a la vez.',
                'Tienes un pequeño ejército de libros esperando turno.',
                'Cada libro activo es una historia que no quieres soltar.',
            ],
            ambient: [
                'Un capítulo pequeño también cuenta.',
                'Tu biblioteca se está portando bien hoy.',
                'Una página cuenta. Dos páginas negocian.',
                'Estoy vigilando la pila de pendientes.',
                'Los libros no se leen solos, pero casi.',
                '¿Ya sabes qué leer después?',
                'La lectura es el mejor hábito.',
                'Cada página es un logro.',
                'Tu siguiente capítulo te está esperando.',
                'Hoy puede ser un gran día lector.',
                'No hay prisa, pero sí hay páginas.',
                '¿Abrimos un libro juntos?',
                'Estoy aquí, cuidando tu progreso.',
                'Un ratito de lectura y ya verás cómo se pasa el día.',
                'Tu biblioteca crece más rápido que tu tiempo libre. Lo entiendo.',
                'Puedo esperar. Los buenos libros también saben esperar.',
                'De vez en cuando, deja que un libro te sorprenda.',
                'Hoy podría ser el día en que empieces algo nuevo.',
            ],
        },
        en: {
            idle: [
                'Five minutes of reading today?',
                'Your next chapter is waiting.',
                'Today is a good day to read.',
                'A little reading never hurts.',
                'Your library is waiting.',
                'Shall we start with a short chapter?',
                'Reading is always a good idea.',
                'An open book is a new world.',
                'What will you read today?',
                'Even one page counts.',
                'Give your book a few minutes?',
                'Your bookmark is patiently waiting.',
                'Any time is a good time to read.',
                'Come on, just one chapter. I promise it will not hurt.',
            ],
            focus: [
                'Quiet mode. Keep reading.',
                'Reading mode. No interruptions.',
                'Focused. Here if you need me.',
                'Reading... keep going.',
                'Total silence. Enjoy the book.',
                'Not saying another word. Enjoy your story.',
                'Staying quiet while you turn the pages.',
                'All yours. I am just watching, fondly.',
            ],
            celebrate: [
                'Daily goal complete. Well done!',
                'You did it! Daily goal reached.',
                'You have read enough today. Excellent!',
                'Goal met. You deserve a rest.',
                'That is it! Daily target reached.',
                'Another day won for reading. Proud of you!',
                'Goal achieved! You earned a good stretch.',
                'You closed the day the right way: reading.',
            ],
            sleepy: [
                'We have not bitten pages lately.',
                'Your library misses your eyes.',
                'A few days without reading. All good?',
                'The books are getting anxious.',
                'A small chapter to get back on track.',
                'No worries, we pick it back up whenever you want.',
                'Your book is exactly where you left it.',
                'When you are ready, we will both be here.',
            ],
            curious: [
                'Several active reads. Look at you go!',
                'Many fronts open. I like your style.',
                'Books active everywhere. That is dedication!',
                'Several books at once. Elite reader.',
                'So much active reading. I am excited for you.',
                'Reading juggling. I see several books at once.',
                'You have a small army of books waiting their turn.',
                'Every active book is a story you do not want to let go of.',
            ],
            ambient: [
                'A small chapter counts too.',
                'Your library is behaving today.',
                'One page counts. Two pages negotiate.',
                'I am monitoring the unread pile.',
                'Books do not read themselves. Almost though.',
                'Do you know what to read next?',
                'Reading is the best habit.',
                'Every page is an achievement.',
                'Your next chapter is waiting.',
                'Today could be a great reading day.',
                'No rush, but there are pages.',
                'Shall we open a book together?',
                'I am here, watching over your progress.',
                'A little reading and the day flies by.',
                'Your library grows faster than your free time. I get it.',
                'I can wait. Good books know how to wait too.',
                'Every now and then, let a book surprise you.',
                'Today could be the day you start something new.',
            ],
        },
    },
    funny: {
        es: {
            idle: [
                '¿Cinco minutos o nos hacemos los ocupados?',
                'Tu libro te está mirando fijamente. Ya sabe.',
                'Los libros no se leen telepáticamente, lo siento.',
                'He contado los libros. Hay más que días en el año.',
                '¿Cuándo fue la última vez que terminaste uno? Yo espero.',
                'La pila de pendientes me está intimidando.',
                'Tu marcapáginas está muy aburrido.',
                'El libro abierto no avanza solo, te lo juro.',
                'Hoy podría ser el día. O no. Pero podría.',
                '¿Abrimos uno o solo miramos las portadas?',
                'Tengo aletas, no manos. No puedo leerlo por ti.',
                'Tu biblioteca digital pesa más que tu compromiso. Es broma. O no.',
                'Cinco minutos de lectura o cinco minutos mirando la pantalla en negro. Tú decides.',
                'El libro ya tiene ganas. Tú todavía no. Empatemos.',
            ],
            focus: [
                'Ese capítulo no se va a leer solo.',
                'Modo tiburón activado. Cállate y lee.',
                'Shhhh. Estoy observando.',
                'Si me distraes ahora te muerdo.',
                'Concentrado como nunca. Tú también.',
                'Ni una palabra más. Estás en zona de lectura.',
                'Yo aquí, respirando bajito, para no romper la magia.',
                'Este es tu momento. Yo solo cuento las páginas en silencio.',
            ],
            celebrate: [
                '¡Hoy mordimos suficientes páginas!',
                'Meta cumplida. El tiburón está orgulloso.',
                'Lo hiciste. No esperaba menos de ti... bueno, sí.',
                '¡Eso es leer! Me emociono yo solo.',
                'Meta completada. ¿Quién necesita motivación?',
                'Objetivo del día: aplastado. Como se debe.',
                'Meta cumplida. Voy a nadar en círculos de la emoción.',
                'Lo lograste. Hasta yo me sorprendí un poco.',
            ],
            sleepy: [
                'Tu biblioteca me está mirando raro.',
                'Los libros han empezado a hablar entre ellos.',
                'Creo que tu marcapáginas olvidó cómo funciona.',
                'El polvo en los libros no es estético, es una queja.',
                'Llevas días sin leer. Los libros ya tienen terapeuta.',
                'Tu racha lectora está en cuidados intensivos, pero se salva.',
                'El libro empezó a preguntar por ti. Educadamente, pero preguntó.',
                'Nada grave, solo un poco de polvo emocional acumulado.',
            ],
            curious: [
                '¡Multiverso de lectura detectado!',
                'Varios libros a la vez. Eso es caos controlado.',
                'Tantos libros activos. El caos me encanta.',
                'Modo multitarea lectora activado.',
                'El tiburón no juzga. Pero sí cuenta los libros.',
                'A este paso vas a necesitar una segunda biblioteca.',
                'Tantos libros abiertos que hasta yo perdí la cuenta. Casi.',
                'Coleccionas historias a medias como quien colecciona estampillas.',
            ],
            ambient: [
                'Yo aquí, vigilando. Sin prisa.',
                'Un capítulo pequeño es mejor que cero.',
                'La pila de pendientes dice hola.',
                'Hoy el tiburón espera pacientemente.',
                'Si no lees tú, leo yo... espera, no sé.',
                '¿Los libros se leen solos? Misterio.',
                'Tu próxima página te necesita.',
                'El marcapáginas está listo. ¿Y tú?',
                'He visto peores rachas. Pocas.',
                'El tiburón aprueba la lectura. Por si acaso.',
                'Nada como un capítulo antes de dormir.',
                'Tu biblioteca tiene fe en ti.',
                'Nado en círculos esperando que abras un libro.',
                'Hoy tampoco te voy a dejar en paz con esto.',
                'Los libros llevan la cuenta de tus excusas. Van muchas.',
                'Cinco minutos. Ni te vas a dar cuenta cuando pasen dos horas.',
                'Estadísticamente hablando, leer es mejor que scrollear. Estadísticamente.',
                'Sigo aquí, siendo la voz de tu conciencia lectora.',
            ],
        },
        en: {
            idle: [
                'Five minutes or are we pretending to be busy?',
                'Your book is staring at you. It knows.',
                'Books do not read themselves telepathically. Sorry.',
                'I counted the books. More than days in the year.',
                'When did you last finish one? I will wait.',
                'The unread pile is intimidating me.',
                'Your bookmark is very bored.',
                'The open book is not moving by itself. I promise.',
                'Today could be the day. Or not. But it could.',
                'Shall we open one or just look at covers?',
                'I have fins, not hands. I cannot read it for you.',
                'Your digital library weighs more than your commitment. Kidding. Maybe.',
                'Five minutes of reading or five minutes staring at a black screen. Your call.',
                'The book is already excited. You are not yet. Let us meet halfway.',
            ],
            focus: [
                'That chapter will not read itself.',
                'Shark mode activated. Shut up and read.',
                'Shhhh. I am watching.',
                'If you distract me now I will bite.',
                'Focused like never. You too.',
                'Not another word. You are in reading zone.',
                'Breathing quietly here so I do not break the magic.',
                'This is your moment. I am just counting pages in silence.',
            ],
            celebrate: [
                'We bit enough pages today!',
                'Goal done. The shark is proud.',
                'You did it. I expected no less... well, maybe less.',
                'That is reading! I am moved.',
                'Goal complete. Who needs motivation?',
                'Daily target: crushed. As it should be.',
                'Goal met. Swimming in circles from the excitement.',
                'You did it. Even I am a little surprised.',
            ],
            sleepy: [
                'Your library is staring at me weirdly.',
                'The books have started talking to each other.',
                'I think your bookmark forgot how it works.',
                'The dust on the books is not aesthetic. It is a complaint.',
                'Days without reading. The books have a therapist now.',
                'Your streak is in intensive care, but it will make it.',
                'The book has started asking about you. Politely, but asking.',
                'Nothing serious, just some emotional dust built up.',
            ],
            curious: [
                'Reading multiverse detected!',
                'Several books at once. Controlled chaos.',
                'So many active books. I love the chaos.',
                'Reader multitask mode activated.',
                'The shark does not judge. But does count.',
                'At this rate you will need a second library.',
                'So many open books even I almost lost count.',
                'You collect half-finished stories like someone collects stamps.',
            ],
            ambient: [
                'Here I am, watching. No rush.',
                'A small chapter beats zero.',
                'The unread pile says hello.',
                'Today the shark waits patiently.',
                'If you do not read, I will... wait, I cannot.',
                'Do books read themselves? Mystery.',
                'Your next page needs you.',
                'The bookmark is ready. Are you?',
                'I have seen worse streaks. Few.',
                'The shark approves of reading. Just in case.',
                'Nothing like a chapter before bed.',
                'Your library has faith in you.',
                'Swimming in circles waiting for you to open a book.',
                'Not letting this go today either.',
                'The books are keeping track of your excuses. There are many.',
                'Five minutes. You will not even notice two hours pass.',
                'Statistically speaking, reading beats scrolling. Statistically.',
                'Still here, being the voice of your reading conscience.',
            ],
        },
    },
    serious: {
        es: {
            idle: ['Meta pendiente.', 'Lectura sin comenzar.', 'Objetivo diario sin cumplir.', 'Tiempo disponible. Libros esperando.', 'Pendiente de avance.', 'Sesión de lectura no iniciada.', 'Ventana de lectura disponible.', 'Acción requerida: abrir libro.'],
            focus: ['Modo lectura activo.', 'Concentración máxima.', 'Leyendo. Sin distracciones.', 'Progreso en curso.', 'Modo enfoque.', 'Sesión en curso. No interrumpir.', 'Estado: lectura activa.'],
            celebrate: ['Meta diaria completada.', 'Objetivo cumplido.', 'Progreso diario: completado.', 'Meta alcanzada.', 'Rendimiento: óptimo.', 'Resultado del día: satisfactorio.', 'Objetivo diario: superado.'],
            sleepy: ['Lectura pendiente hace varios días.', 'Racha interrumpida.', 'Sin actividad lectora reciente.', 'Días sin registro de lectura.', 'Actividad pendiente.', 'Inactividad prolongada detectada.', 'Reanudación recomendada.'],
            curious: ['Lecturas activas múltiples.', 'Varios libros en progreso.', 'Lecturas paralelas activas.', 'Múltiples avances registrados.', 'Frentes de lectura abiertos.', 'Carga de lectura: alta.', 'Gestión de múltiples títulos en curso.'],
            ambient: ['Sin actividad reciente.', 'Lectura disponible.', 'Meta diaria pendiente.', 'Objetivo sin alcanzar.', 'Registro de lectura esperado.', 'Estado: inactivo.', 'Próximo capítulo pendiente.', 'Progreso: pausado.', 'Recordatorio: hábito de lectura pendiente.', 'Ventana de oportunidad disponible.', 'Sistema en espera de actividad.'],
        },
        en: {
            idle: ['Goal pending.', 'Reading not started.', 'Daily objective unmet.', 'Time available. Books waiting.', 'Awaiting progress.', 'Reading session not initiated.', 'Reading window available.', 'Action required: open book.'],
            focus: ['Reading mode active.', 'Maximum concentration.', 'Reading. No distractions.', 'Progress in progress.', 'Focus mode.', 'Session in progress. Do not interrupt.', 'Status: active reading.'],
            celebrate: ['Daily goal complete.', 'Objective met.', 'Daily progress: complete.', 'Goal reached.', 'Performance: optimal.', 'Daily result: satisfactory.', 'Daily objective: exceeded.'],
            sleepy: ['Reading pending for several days.', 'Streak interrupted.', 'No recent reading activity.', 'Days without reading log.', 'Activity pending.', 'Prolonged inactivity detected.', 'Resumption recommended.'],
            curious: ['Multiple active reads.', 'Several books in progress.', 'Active parallel reads.', 'Multiple progresses logged.', 'Open reading fronts.', 'Reading load: high.', 'Multiple titles under management.'],
            ambient: ['No recent activity.', 'Reading available.', 'Daily goal pending.', 'Objective unmet.', 'Reading log expected.', 'Status: inactive.', 'Next chapter pending.', 'Progress: paused.', 'Reminder: reading habit pending.', 'Opportunity window available.', 'System awaiting activity.'],
        },
    },
    minimal: {
        es: {
            idle: ['Leer.', 'Pendiente.', '¿Hoy?', 'Un capítulo.', 'Ve.', 'Ahora.', 'Vamos.'],
            focus: ['Leyendo.', 'Enfocado.', 'Silencio.', 'Continúa.', 'Lee.', 'Sigue.'],
            celebrate: ['Meta lista.', '¡Listo!', 'Hecho.', 'Completado.', 'Bien.', 'Logrado.'],
            sleepy: ['Pendiente.', 'Hace días.', 'Sin leer.', 'Pausa larga.', 'Reabre.', 'Vuelve.'],
            curious: ['Varios.', 'Activos.', 'Multitarea.', 'Muchos.', 'Avanza.', 'En curso.'],
            ambient: ['...', 'Aquí.', 'Listo.', '¿Hoy?', 'Un rato.', 'Sigo aquí.', 'Lee algo.', 'Página.'],
        },
        en: {
            idle: ['Read.', 'Pending.', 'Today?', 'One chapter.', 'Go.', 'Now.', 'Come on.'],
            focus: ['Reading.', 'Focused.', 'Silence.', 'Continue.', 'Read.', 'Keep going.'],
            celebrate: ['Goal done.', 'Done!', 'Complete.', 'Achieved.', 'Nice.', 'Nailed it.'],
            sleepy: ['Pending.', 'Days ago.', 'Not read.', 'Long pause.', 'Reopen.', 'Return.'],
            curious: ['Several.', 'Active.', 'Multitask.', 'Many.', 'Progress.', 'Ongoing.'],
            ambient: ['...', 'Here.', 'Ready.', 'Today?', 'A while.', 'Still here.', 'Read something.', 'Page.'],
        },
    },
};

// ── Sistema de chat scripted ────────────────────────────────────────────────
export const JOKE_POOL = {
    es: [
        '¿Por qué el libro fue al médico? Porque se sentía encuadernado.',
        '¿Qué le dijo un libro a otro? Hoy te veo muy de tapa.',
        '¿Por qué el lector no duerme? Porque el libro lo tiene en vilo.',
        '¿Cuántos libros caben en una mochila? Nunca los suficientes.',
        '¿Por qué el marcapáginas fue al gimnasio? Para estar en forma entre páginas.',
        'Mi libro favorito sobre la procrastinación: "Mañana lo leo".',
        '¿Qué dijo el libro aburrido? Estoy pasando página.',
        'Un libro sin final es como una pizza sin orillas. Inaceptable.',
        '¿Qué tiene un libro que no tiene la tele? Que cuando lo apagas, el argumento no sigue solo.',
        'El problema de leer muchos libros es que uno empieza a hablar en citas.',
        '¿Por qué el ebook no se resfría? Porque no tiene páginas que pasar.',
        'Mi relación con la pila de pendientes es complicada. Muy complicada.',
        '¿Cómo sabe un libro que ya terminaste? Porque dejas de mentirle sobre "el capítulo final".',
    ],
    en: [
        'Why did the book go to therapy? Too many issues.',
        'What did one book say to another? I find you very interesting.',
        'Why was the math book sad? It had too many problems.',
        'I told my book I loved it. It gave me a blank look.',
        'Why do books make bad comedians? They always stick to the script.',
        'My library card is my most-used card. No refunds.',
        'What do you call a book that is always late? A slow reader.',
        'Why did the reader bring a ladder? For high reading.',
        'A book without an ending is like a pizza with no crust. Unacceptable.',
        'Reading too many books makes you start speaking in quotes.',
        'Why does an ebook never catch a cold? No pages to turn.',
        'My relationship with the unread pile is complicated. Very complicated.',
        'How does a book know you finished it? You stop lying about "the last chapter".',
    ],
};

export const CHAT_PATTERNS = {
    greeting:    { es: [/^hola/i, /^buenos/i, /^buenas/i, /^hey\b/i, /^ey\b/i, /^saludos/i, /^qué onda/i, /^qué tal\b/i, /^sup\b/i], en: [/^hi\b/i, /^hello/i, /^hey\b/i, /^good (morning|evening|day|afternoon)/i, /^howdy/i, /^sup\b/i, /^yo\b/i, /^greetings/i] },
    howAreYou:   { es: [/cómo (estás|te va|andas|te encuentras)/i, /todo bien/i, /qué tal (estás|andas)/i], en: [/how (are you|'?s it going|you doing)/i, /you (good|ok|okay)\??$/i, /what'?s up/i] },
    currentBook: { es: [/qué (estoy|estaba) leyendo/i, /cuál es mi (libro|lectura)/i, /mi (libro|lectura) actual/i, /en qué (libro|página) (estoy|voy)/i, /cuánto llevo en/i], en: [/what (am i|was i) reading/i, /my current (book|read)/i, /which book (am i|do i)/i, /where am i in/i] },
    progress:    { es: [/mi progreso/i, /cuánto he leído/i, /cómo voy\b/i, /cuánto me falta/i, /mi avance/i, /cuántas páginas/i], en: [/my progress/i, /how much have i read/i, /how far (am i|have i got)/i, /how am i doing/i, /pages (left|read)/i] },
    recommend:   { es: [/recomiéndame/i, /qué (leo|debería leer|leer)\b/i, /sugiéreme/i, /qué libro (me recomiendas|leer)/i, /una recomendación/i, /próximo libro/i], en: [/recommend/i, /what (should i|to) read/i, /suggest (a book|something)/i, /book recommendation/i, /next book/i, /what book should/i] },
    motivate:    { es: [/motívame/i, /no (quiero|me apetece|tengo ganas) (de )?leer/i, /estoy desmotivado/i, /dame ánimos/i, /no puedo (leer|empezar)/i, /pereza/i, /flojera/i], en: [/motivate me/i, /i (don'?t|dont) (want|feel like) (to )?read/i, /i'?m (unmotivated|lazy|tired of reading)/i, /encourage me/i, /can'?t (start|read|finish)/i, /too lazy/i] },
    stats:       { es: [/mis estadísticas/i, /cuánto tiempo he leído/i, /estadísticas de lectura/i, /mis datos/i, /hoy he leído/i, /cuántos minutos/i], en: [/my (reading )?stats/i, /my statistics/i, /how long have i read/i, /minutes (read|today)/i, /reading time/i] },
    streak:      { es: [/mi racha/i, /racha de lectura/i, /días seguidos/i, /cuántos días llevo/i, /mi consistencia/i], en: [/my streak/i, /reading streak/i, /consecutive days/i, /how many days (have i|in a row)/i] },
    whoAreYou:   { es: [/quién eres/i, /qué eres\b/i, /cuéntame (de ti|sobre ti)/i, /preséntate/i, /eres un (tiburón|bot|ia)/i], en: [/who are you/i, /what are you\b/i, /tell me about (you|yourself)/i, /introduce yourself/i, /are you (a shark|a bot|an ai)/i] },
    compliment:  { es: [/^gracias\b/i, /eres (genial|increíble|bueno|lo mejor|chido|copado|el mejor)/i, /te quiero/i, /me gustas/i, /bien hecho/i, /qué bien/i, /te adoro/i], en: [/^thank(s| you)\b/i, /you'?re (great|amazing|awesome|the best|cool)/i, /i love you/i, /good job/i, /well done/i, /you'?re the best/i] },
    joke:        { es: [/cuéntame (un chiste|algo gracioso)/i, /chiste\b/i, /hazme reír/i, /algo divertido/i, /cuéntame algo/i], en: [/tell me (a joke|something funny)/i, /\bjoke\b/i, /make me laugh/i, /something funny/i] },
    goodbye:     { es: [/adiós/i, /\bbye\b/i, /hasta (luego|pronto|mañana)/i, /\bchao\b/i, /\bchau\b/i, /nos vemos/i, /me voy\b/i], en: [/\bbye\b/i, /goodbye/i, /see (you|ya)/i, /\blater\b/i, /i'?m (leaving|going now)/i, /farewell/i, /take care/i] },
    help:        { es: [/\bayuda\b/i, /qué puedes (hacer|decirme)/i, /cómo (funciona|te uso)/i, /qué haces\b/i, /para qué sirves/i], en: [/\bhelp\b/i, /what can you do/i, /how do (you work|i use you)/i, /what do you do\b/i, /what are you for/i] },
    bookCount:   { es: [/cuántos libros (tengo|hay)/i, /mi biblioteca\b/i, /cuántos (terminé|he terminado|he leído)/i, /libros (terminados|leídos)/i], en: [/how many books/i, /my library\b/i, /how many (do i have|have i finished|finished|completed)/i, /books (finished|completed|read)/i] },
    similar:     { es: [/libros similares/i, /algo parecido/i, /del mismo autor/i, /mismo género/i, /más del mismo/i], en: [/similar books/i, /books like (this|it|these)/i, /more like (this|it)/i, /same (author|genre)/i] },
    nextBook:    { es: [/qué (leo|leer) después/i, /siguiente libro/i, /después de terminar/i, /tras terminar/i, /qué leer cuando termine/i], en: [/what (to|should i) read next/i, /next (book|read)\b/i, /after (finishing|this book|i finish)/i] },
};

export function matchIntent(text, lang) {
    const l = lang === 'en' ? 'en' : 'es';
    for (const [intent, patterns] of Object.entries(CHAT_PATTERNS)) {
        const pool = patterns[l] || patterns.es;
        if (pool.some(p => p.test(text))) return intent;
    }
    return 'fallback';
}

export function findSimilarBooks(book, allBooks) {
    if (!book) return [];
    const candidates = allBooks.filter(b => b.id !== book.id && !b.isFinished);
    const bySeries = book.series
        ? candidates.filter(b => b.series && b.series.toLowerCase() === book.series.toLowerCase())
        : [];
    const byAuthor = book.author
        ? candidates.filter(b => b.author && b.author.toLowerCase().trim() === book.author.toLowerCase().trim())
        : [];
    const bookTags = book.tags ? book.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
    const byTag = bookTags.length > 0
        ? candidates.filter(b => {
            const bTags = b.tags ? b.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
            return bTags.some(t => bookTags.includes(t));
        })
        : [];
    const seen = new Set();
    const result = [];
    for (const b of [...bySeries, ...byAuthor, ...byTag]) {
        if (!seen.has(b.id)) { seen.add(b.id); result.push(b); }
    }
    return result.slice(0, 5);
}

// Responses keyed by intent → lang → personality → array of string | function(ctx)
export const CHAT_RESPONSES = {
    es: {
        greeting: {
            friendly: ['¡Hola! ¿Listo para leer algo hoy?', '¡Buenas! ¿En qué puedo ayudarte?', '¡Hey! Aquí estoy. Siempre.', '¡Hola! ¿Abrimos un libro?'],
            funny:    ['¡Ey! El tiburón está en línea. ¿Qué necesitas?', '¡Hola! Estaba aquí flotando. ¿Qué pasa?', '¡Buenos días... o lo que sea! El tiburón alerta.', '¡Hey! Sigo aquí. Como siempre. Esperando.'],
            serious:  ['Hola.', 'Buenas.', 'Sí.', 'Aquí.'],
            minimal:  ['Hola.', 'Hey.', 'Sí.'],
        },
        howAreYou: {
            friendly: ['¡Bien! Listo para ayudarte a leer más.', 'Aquí estoy, como siempre, animándote.', '¡Genial! ¿Y tú? ¿Cómo va la lectura?', 'Perfecto. Esperando que abras un libro.'],
            funny:    ['Soy un tiburón de píxeles. No tengo sentimientos. Pero gracias por preguntar.', '¡Estupendo! Aunque llevo horas sin que leas nada.', 'Como siempre: afilado y con ganas de morder páginas.', 'De lujo, aunque mi pila de pendientes me tiene un poco nervioso.'],
            serious:  ['Bien.', 'Operativo.', 'Sin novedades.', 'Correcto.'],
            minimal:  ['Bien.', 'Ok.', 'Aquí.'],
        },
        currentBook: {
            friendly: [
                ctx => ctx.activeBooks.length > 0 ? `Estás leyendo "${ctx.activeBooks[0].name}" y llevas un ${Math.round(ctx.activeBooks[0].progress || 0)}%.` : 'No veo ninguna lectura activa. ¿Abrimos algo?',
                ctx => ctx.activeBooks.length > 1 ? `Tienes ${ctx.activeBooks.length} libros activos. El más reciente: "${ctx.activeBooks[0].name}".` : ctx.activeBooks.length === 1 ? `Tu lectura activa es "${ctx.activeBooks[0].name}".` : 'Sin lecturas activas ahora mismo.',
            ],
            funny: [
                ctx => ctx.activeBooks.length > 0 ? `Oficialmente tienes "${ctx.activeBooks[0].name}" abierto. Que no es lo mismo que estarlo leyendo, claro.` : 'No hay ningún libro abierto. Técnicamente eso es un récord.',
                ctx => ctx.activeBooks.length > 1 ? `${ctx.activeBooks.length} libros activos a la vez. Eso es ambición lectora o caos. Las dos cosas.` : ctx.activeBooks.length === 1 ? `"${ctx.activeBooks[0].name}". Que sigo esperando que avances, por cierto.` : 'Ninguno. El tiburón espera.',
            ],
            serious: [ctx => ctx.activeBooks.length > 0 ? `"${ctx.activeBooks[0].name}". ${Math.round(ctx.activeBooks[0].progress || 0)}% completado.` : 'Sin lectura activa.'],
            minimal: [ctx => ctx.activeBooks.length > 0 ? `"${ctx.activeBooks[0].name}". ${Math.round(ctx.activeBooks[0].progress || 0)}%.` : 'Ninguno.'],
        },
        progress: {
            friendly: [
                ctx => `Hoy llevas ${ctx.daily} min de ${ctx.goal} min de tu meta. ${ctx.daily >= ctx.goal ? '¡Meta cumplida!' : `Te quedan ${ctx.goal - ctx.daily} min.`}`,
                ctx => ctx.finishedBooks.length > 0 ? `Has terminado ${ctx.finishedBooks.length} libro${ctx.finishedBooks.length > 1 ? 's' : ''}. ¡Nada mal!` : 'Aún no has terminado ningún libro. ¡El primero es el más importante!',
                ctx => `Nivel ${ctx.readerLevel.level}. ${ctx.daily > 0 ? `Hoy ${ctx.daily} min leídos.` : 'Sin minutos hoy todavía.'}`,
            ],
            funny: [
                ctx => `Hoy: ${ctx.daily}/${ctx.goal} min. ${ctx.daily >= ctx.goal ? 'Meta cumplida. El tiburón se permite un descanso.' : `Faltan ${ctx.goal - ctx.daily} min. El tiburón lleva la cuenta.`}`,
                ctx => ctx.finishedBooks.length > 0 ? `${ctx.finishedBooks.length} libro${ctx.finishedBooks.length > 1 ? 's' : ''} terminado${ctx.finishedBooks.length > 1 ? 's' : ''}. Estadística no tan mala para alguien que "no tiene tiempo".` : 'Cero libros terminados. El tiburón no dice nada. Solo mira.',
            ],
            serious: [ctx => `Hoy: ${ctx.daily}/${ctx.goal} min. Nivel: ${ctx.readerLevel.level}. Terminados: ${ctx.finishedBooks.length}.`],
            minimal: [ctx => `${ctx.daily}/${ctx.goal} min. Nivel ${ctx.readerLevel.level}.`],
        },
        recommend: {
            friendly: [
                ctx => {
                    const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5);
                    if (unread.length > 0) return `Tienes "${pickRandom(unread).name}" casi sin empezar. Podría ser el momento.`;
                    if (ctx.activeBooks.length > 0) return `Termina "${ctx.activeBooks[0].name}" antes de empezar algo nuevo. ¡Ya falta menos!`;
                    return 'Tu biblioteca está esperando. ¡Cualquiera es buena elección!';
                },
                ctx => ctx.activeBooks.length > 1 ? `Tienes ${ctx.activeBooks.length} lecturas abiertas. Elige la que más ganas te dé hoy.` : 'El mejor libro es el que abres ahora mismo.',
            ],
            funny: [
                ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}" está ahí, acumulando polvo digital. Por si acaso.` : 'No tengo más para recomendarte que lo que ya tienes. Empieza por donde sea.'; },
                ctx => ctx.activeBooks.length > 0 ? `Ya tienes "${ctx.activeBooks[0].name}" a medias. Ese es mi consejo. Termínalo.` : 'Ningún libro abierto. ¡Escandaloso! Abre uno ya.',
            ],
            serious: [ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `Pendiente sin empezar: "${pickRandom(unread).name}".` : 'Sin títulos nuevos disponibles. Continúa lectura activa.'; }],
            minimal: [ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}".` : 'Continúa el activo.'; }],
        },
        motivate: {
            friendly: ['¡Venga! Solo un capítulo. Solo uno. Te va a gustar.', 'No necesitas ganas, solo una página. Las ganas vienen después.', 'El truco es abrir el libro. Después el tiempo pasa solo.', 'Un capítulo pequeño es infinitamente mejor que ninguno.', '¿Y si le damos cinco minutos? Solo cinco.'],
            funny:    ['La pereza es temporal. Los libros sin terminar son eternos.', 'Mira, el tiburón también tiene días malos. Y aun así muerde páginas.', '"No quiero leer" — dijo nadie que haya empezado el capítulo.', 'El libro no te va a leer solo. Aunque ojalá.', 'Cinco minutos. Si después de cinco minutos sigue siendo horrible, me lo dices.'],
            serious:  ['Comienza. El resto llega.', 'Un capítulo. Ahora.', 'La motivación viene leyendo.', 'Empieza. Sin excusas.'],
            minimal:  ['Empieza.', 'Un capítulo.', 'Ahora.', 'Ve.'],
        },
        stats: {
            friendly: [
                ctx => `Hoy llevas ${ctx.daily} min. Meta diaria: ${ctx.goal} min. Racha: ${ctx.streak} día${ctx.streak !== 1 ? 's' : ''}.`,
                ctx => `Nivel ${ctx.readerLevel.level} de lector. ${ctx.finishedBooks.length} libro${ctx.finishedBooks.length !== 1 ? 's' : ''} terminado${ctx.finishedBooks.length !== 1 ? 's' : ''}. ${ctx.activeBooks.length} activo${ctx.activeBooks.length !== 1 ? 's' : ''}.`,
            ],
            funny: [
                ctx => `Estadísticas del día: ${ctx.daily} min leídos, meta en ${ctx.goal}, racha de ${ctx.streak} días. ${ctx.daily >= ctx.goal ? 'Impresionante.' : 'Hay margen de mejora. Mucho margen.'}`,
                ctx => `Nivel ${ctx.readerLevel.level}. ${ctx.finishedBooks.length} libro${ctx.finishedBooks.length !== 1 ? 's' : ''} terminado${ctx.finishedBooks.length !== 1 ? 's' : ''}. El tiburón lleva la cuenta.`,
            ],
            serious: [ctx => `Hoy: ${ctx.daily}/${ctx.goal} min. Racha: ${ctx.streak}d. Nivel: ${ctx.readerLevel.level}. Terminados: ${ctx.finishedBooks.length}.`],
            minimal: [ctx => `${ctx.daily}/${ctx.goal}min. Racha ${ctx.streak}. Nv${ctx.readerLevel.level}.`],
        },
        streak: {
            friendly: [ctx => ctx.streak > 0 ? `¡Llevas ${ctx.streak} día${ctx.streak !== 1 ? 's' : ''} seguido${ctx.streak !== 1 ? 's' : ''} leyendo! ${ctx.streak >= 7 ? '¡Eso es una racha seria!' : 'Sigue así.'}` : 'Aún no tienes racha. ¡Empieza hoy!'],
            funny:    [ctx => ctx.streak > 0 ? `${ctx.streak} días de racha. ${ctx.streak >= 7 ? 'Francamente, no lo esperaba.' : 'Vamos bien. No lo rompas ahora.'}` : 'Racha: cero. Hoy puede ser el día uno.'],
            serious:  [ctx => `Racha: ${ctx.streak} día${ctx.streak !== 1 ? 's' : ''}.`],
            minimal:  [ctx => `${ctx.streak}d.`],
        },
        whoAreYou: {
            friendly: ['Soy Sharky, tu mascota de lectura. Estoy aquí para animarte, llevarte la cuenta y acompañarte en cada libro.', 'Un tiburón lector. Vigilo tu biblioteca, celebro tus logros y te persigo cuando no lees.', 'Soy Sharky. Parte mascota, parte sistema de rendición de cuentas con aletas.'],
            funny:    ['Soy Sharky. Tiburón, lector, motivador no solicitado y detective de procrastinación.', 'Un tiburón de píxeles con opiniones fuertes sobre tus hábitos lectores.', 'Soy lo que pasa cuando combinas un tiburón con una aplicación de lectura y nadie dice "no".'],
            serious:  ['Sharky. Mascota de lectura. Seguimiento de estadísticas y notificaciones.', 'Sistema de apoyo lector. Designación: Sharky.'],
            minimal:  ['Sharky. Mascota.', 'Tu lector.'],
        },
        compliment: {
            friendly: ['¡Gracias! Tú también eres genial.', '¡Me alegra ser útil! Ahora a leer.', 'Eso me ha llegado hasta las aletas. ¡Gracias!', '¡Aw! Yo también te aprecio. Ahora abre ese libro.'],
            funny:    ['El tiburón se ruboriza. Técnicamente. Si pudiera.', 'Sabía que eventualmente llegarías a esta conclusión.', '¡Claro que soy genial! Ahora, ¿vas a leer o solo vamos a hablarnos bonito?', 'Gracias. Ese cumplido va directo a mi colección de motivaciones.'],
            serious:  ['Gracias.', 'Apreciado.', 'Recibido.'],
            minimal:  ['Gracias.', ':)'],
        },
        joke: {
            friendly: [() => pickRandom(JOKE_POOL.es)],
            funny:    [() => pickRandom(JOKE_POOL.es)],
            serious:  ['No proceso solicitudes de humor.', 'No es mi especialidad.', '¿Un chiste? Serio: lee.'],
            minimal:  [() => pickRandom(JOKE_POOL.es)],
        },
        goodbye: {
            friendly: ['¡Hasta luego! No te olvides de leer algo.', '¡Nos vemos! Aquí estaré cuando vuelvas.', '¡Hasta pronto! Tu libro te espera.', 'Chao. El marcapáginas queda guardado.'],
            funny:    ['¡Hasta luego! Y sí, seguiré aquí cuando vuelvas.', 'Hasta pronto. Vigilo la biblioteca en tu ausencia.', '¡Chao! Aquí no hay vacaciones para los tiburones.'],
            serious:  ['Hasta luego.', 'Ok.', 'Adiós.'],
            minimal:  ['Bye.', 'Chao.'],
        },
        help: {
            friendly: ['Puedo contarte tu progreso, motivarte, recomendarte libros, contarte chistes y llevar la cuenta de tu lectura. ¡Pregúntame lo que quieras!', 'Pregúntame por tu libro actual, tu racha, tus estadísticas, o pídeme motivación. También sé chistes. Pocos, pero buenos.'],
            funny:    ['Soy un tiburón de apoyo emocional para lectores. Puedo darte estadísticas, recomendaciones, motivación y chistes de dudosa calidad. Todo gratis.', 'Sé: estadísticas, progreso, libros, rachas, chistes, y motivación no solicitada. Tus órdenes.'],
            serious:  ['Comandos: progreso, estadísticas, racha, libro actual, recomendación, motivación, chiste.', 'Disponible: estadísticas de lectura, estado de libros, motivación.'],
            minimal:  ['Stats, libros, motivación, chistes.'],
        },
        bookCount: {
            friendly: [ctx => `Tienes ${ctx.books.length} libro${ctx.books.length !== 1 ? 's' : ''} en biblioteca. ${ctx.finishedBooks.length} terminado${ctx.finishedBooks.length !== 1 ? 's' : ''} y ${ctx.activeBooks.length} activo${ctx.activeBooks.length !== 1 ? 's' : ''}.`],
            funny:    [ctx => `${ctx.books.length} libros. ${ctx.finishedBooks.length} terminados. ${ctx.books.length - ctx.finishedBooks.length} esperando. El tiburón lleva la cuenta.`],
            serious:  [ctx => `Total: ${ctx.books.length}. Terminados: ${ctx.finishedBooks.length}. Activos: ${ctx.activeBooks.length}.`],
            minimal:  [ctx => `${ctx.books.length} libros. ${ctx.finishedBooks.length} ok.`],
        },
        similar: {
            friendly: [ctx => { if (!ctx.lastReadBook) return '¡Empieza a leer un libro para que pueda encontrarte algo similar!'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length === 0) return `No encontré libros similares a "${ctx.lastReadBook.name}" en tu biblioteca. ¿Hora de añadir más?`; const names = similar.slice(0, 2).map(b => `"${b.name}"`).join(' y '); return similar[0].author === ctx.lastReadBook.author && ctx.lastReadBook.author ? `Del mismo autor que "${ctx.lastReadBook.name}": ${names}. ¡Buenas opciones!` : `Basado en "${ctx.lastReadBook.name}": ${names}. ¿Te interesa alguno?`; }],
            funny:    [ctx => { if (!ctx.lastReadBook) return '¿Similares a qué? El tiburón necesita un libro de referencia.'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length === 0) return `Nada similar a "${ctx.lastReadBook.name}" en tu biblioteca. El tiburón buscó bien.`; return `¿Algo como "${ctx.lastReadBook.name}"? Aquí: "${similar[0].name}". De nada.`; }],
            serious:  [ctx => { if (!ctx.lastReadBook) return 'Sin lectura de referencia.'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); return similar.length > 0 ? `Similar: "${similar[0].name}".` : 'Sin similares en biblioteca.'; }],
            minimal:  [ctx => { if (!ctx.lastReadBook) return '?'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); return similar.length > 0 ? `"${similar[0].name}".` : 'Sin similares.'; }],
        },
        nextBook: {
            friendly: [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) { const b = similar[0]; if (b.series && ctx.lastReadBook?.series && b.series.toLowerCase() === ctx.lastReadBook.series.toLowerCase()) return `¡El siguiente en la serie es "${b.name}"! ¡A por él!`; if (b.author === ctx.lastReadBook?.author && b.author) return `Del mismo autor, podrías seguir con "${b.name}". ¡Buena elección!`; return `Basado en tus gustos, te recomiendo "${b.name}". ¿Qué te parece?`; } const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `¿Qué tal empezar con "${pickRandom(unread).name}"? Aún está sin explorar.` : '¡Tu biblioteca está toda leída! Hora de añadir algo nuevo.'; }],
            funny:    [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) return `El tiburón recomienda: "${similar[0].name}". Y no acepta discusión.`; const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}". Sin razón especial. Solo empiézalo ya.` : 'Toda la biblioteca leída. El tiburón está en silencio por respeto.'; }],
            serious:  [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) return `Siguiente: "${similar[0].name}".`; const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `Pendiente: "${pickRandom(unread).name}".` : 'Biblioteca completa.'; }],
            minimal:  [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); const pick = similar[0] || pickRandom(unread); return pick ? `"${pick.name}".` : 'Sin pendientes.'; }],
        },
        fallback: {
            friendly: ['No estoy seguro de entenderte, pero te escucho. ¿Quieres saber tu progreso, una recomendación o necesitas motivación?', 'Hmm, no sé qué responder. Prueba con: "qué estoy leyendo", "mi progreso", "motívame" o "cuéntame un chiste".', '¿Podrías reformularlo? Soy un tiburón con habilidades lingüísticas limitadas.'],
            funny:    ['No he entendido nada, pero el tiburón sigue aquí. Prueba con algo más simple.', 'Eso está fuera de mi radio de mordida lingüística. Intenta "chiste", "progreso" o "qué estoy leyendo".', 'Formato no reconocido. ¿Has probado con "motívame"? Eso sí lo entiendo.'],
            serious:  ['Comando no reconocido.', 'Sin respuesta disponible.', 'Intenta: progreso, estadísticas, recomendación.'],
            minimal:  ['?', 'No entiendo.', 'Prueba otro.'],
        },
    },
    en: {
        greeting: {
            friendly: ['Hi! Ready to read something today?', 'Hey there! How can I help?', 'Hello! I am always here.', 'Hi! Shall we open a book?'],
            funny:    ['Hey! The shark is online. What do you need?', 'Hi! I was just floating here. What is up?', 'Good whatever time it is! Shark alert.', 'Hey! Still here. As always. Waiting.'],
            serious:  ['Hello.', 'Hi.', 'Yes.', 'Here.'],
            minimal:  ['Hi.', 'Hey.', 'Yes.'],
        },
        howAreYou: {
            friendly: ['Great! Ready to help you read more.', 'Here as always, cheering you on.', 'Doing great! And you? How is the reading going?', 'Perfect. Waiting for you to open a book.'],
            funny:    ['I am a pixel shark. No feelings. But thanks for asking.', 'Wonderful! Even though you have not read anything in a while.', 'As always: sharp and ready to bite pages.', 'Great, though my unread pile is giving me anxiety.'],
            serious:  ['Fine.', 'Operational.', 'No news.', 'Correct.'],
            minimal:  ['Good.', 'Ok.', 'Here.'],
        },
        currentBook: {
            friendly: [
                ctx => ctx.activeBooks.length > 0 ? `You are reading "${ctx.activeBooks[0].name}" and you are ${Math.round(ctx.activeBooks[0].progress || 0)}% through.` : 'No active reading. Shall we open something?',
                ctx => ctx.activeBooks.length > 1 ? `You have ${ctx.activeBooks.length} active books. Most recent: "${ctx.activeBooks[0].name}".` : ctx.activeBooks.length === 1 ? `Your active read is "${ctx.activeBooks[0].name}".` : 'No active reads right now.',
            ],
            funny: [
                ctx => ctx.activeBooks.length > 0 ? `Officially you have "${ctx.activeBooks[0].name}" open. Not the same as actually reading it, of course.` : 'No open books. That is technically a record.',
                ctx => ctx.activeBooks.length > 1 ? `${ctx.activeBooks.length} books active simultaneously. That is either ambition or chaos. Both.` : ctx.activeBooks.length === 1 ? `"${ctx.activeBooks[0].name}". Still waiting for you to make progress, by the way.` : 'None. The shark waits.',
            ],
            serious: [ctx => ctx.activeBooks.length > 0 ? `"${ctx.activeBooks[0].name}". ${Math.round(ctx.activeBooks[0].progress || 0)}% complete.` : 'No active reading.'],
            minimal: [ctx => ctx.activeBooks.length > 0 ? `"${ctx.activeBooks[0].name}". ${Math.round(ctx.activeBooks[0].progress || 0)}%.` : 'None.'],
        },
        progress: {
            friendly: [
                ctx => `Today you have read ${ctx.daily} of ${ctx.goal} min. ${ctx.daily >= ctx.goal ? 'Goal reached!' : `${ctx.goal - ctx.daily} min to go.`}`,
                ctx => ctx.finishedBooks.length > 0 ? `You have finished ${ctx.finishedBooks.length} book${ctx.finishedBooks.length > 1 ? 's' : ''}. Not bad!` : 'No finished books yet. The first one is the most important!',
                ctx => `Level ${ctx.readerLevel.level} reader. ${ctx.daily > 0 ? `${ctx.daily} min read today.` : 'No minutes yet today.'}`,
            ],
            funny: [
                ctx => `Today: ${ctx.daily}/${ctx.goal} min. ${ctx.daily >= ctx.goal ? 'Goal done. The shark allows a break.' : `${ctx.goal - ctx.daily} min left. Shark is keeping count.`}`,
                ctx => `${ctx.finishedBooks.length} book${ctx.finishedBooks.length !== 1 ? 's' : ''} finished. Not bad for someone who "has no time".`,
            ],
            serious: [ctx => `Today: ${ctx.daily}/${ctx.goal} min. Level: ${ctx.readerLevel.level}. Finished: ${ctx.finishedBooks.length}.`],
            minimal: [ctx => `${ctx.daily}/${ctx.goal}min. Lv${ctx.readerLevel.level}.`],
        },
        recommend: {
            friendly: [
                ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); if (unread.length > 0) return `You have "${pickRandom(unread).name}" barely started. Maybe now is the time.`; if (ctx.activeBooks.length > 0) return `Finish "${ctx.activeBooks[0].name}" before starting something new. Almost there!`; return 'Your library is waiting. Any of them is a great choice!'; },
                ctx => ctx.activeBooks.length > 1 ? `You have ${ctx.activeBooks.length} books open. Pick whichever you feel like today.` : 'The best book is the one you open right now.',
            ],
            funny: [
                ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}" is sitting there collecting digital dust. Just saying.` : 'I have nothing to recommend that you do not already have. Start anywhere.'; },
                ctx => ctx.activeBooks.length > 0 ? `You already have "${ctx.activeBooks[0].name}" half open. That is my recommendation. Finish it.` : 'No open book. Outrageous! Open one now.',
            ],
            serious: [ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `Unstarted: "${pickRandom(unread).name}".` : 'No new titles. Continue active reading.'; }],
            minimal: [ctx => { const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}".` : 'Continue active.'; }],
        },
        motivate: {
            friendly: ['Come on! Just one chapter. One. You will like it.', 'You do not need motivation, just one page. The rest follows.', 'The trick is opening the book. After that time flies.', 'One small chapter is infinitely better than none.', 'What if we try five minutes? Just five.'],
            funny:    ['Laziness is temporary. Unfinished books are forever.', 'Look, the shark has bad days too. And still bites pages.', '"I do not want to read" — said nobody who started the chapter.', 'The book will not read itself. Though that would be nice.', 'Five minutes. If it is still terrible after five minutes, tell me.'],
            serious:  ['Start. The rest follows.', 'One chapter. Now.', 'Motivation comes from reading.', 'Begin. No excuses.'],
            minimal:  ['Start.', 'One chapter.', 'Now.', 'Go.'],
        },
        stats: {
            friendly: [
                ctx => `Today: ${ctx.daily} min. Daily goal: ${ctx.goal} min. Streak: ${ctx.streak} day${ctx.streak !== 1 ? 's' : ''}.`,
                ctx => `Level ${ctx.readerLevel.level} reader. ${ctx.finishedBooks.length} book${ctx.finishedBooks.length !== 1 ? 's' : ''} finished. ${ctx.activeBooks.length} active.`,
            ],
            funny: [
                ctx => `Today: ${ctx.daily} min read, goal at ${ctx.goal}, ${ctx.streak}-day streak. ${ctx.daily >= ctx.goal ? 'Impressive.' : 'Room for improvement. A lot of room.'}`,
                ctx => `Level ${ctx.readerLevel.level}. ${ctx.finishedBooks.length} book${ctx.finishedBooks.length !== 1 ? 's' : ''} finished. Shark keeps count.`,
            ],
            serious: [ctx => `Today: ${ctx.daily}/${ctx.goal}min. Streak: ${ctx.streak}d. Level: ${ctx.readerLevel.level}. Finished: ${ctx.finishedBooks.length}.`],
            minimal: [ctx => `${ctx.daily}/${ctx.goal}min. Streak ${ctx.streak}. Lv${ctx.readerLevel.level}.`],
        },
        streak: {
            friendly: [ctx => ctx.streak > 0 ? `You have been reading for ${ctx.streak} consecutive day${ctx.streak !== 1 ? 's' : ''}! ${ctx.streak >= 7 ? 'That is a serious streak!' : 'Keep it up!'}` : 'No streak yet. Start today!'],
            funny:    [ctx => ctx.streak > 0 ? `${ctx.streak}-day streak. ${ctx.streak >= 7 ? 'Honestly, did not see that coming.' : 'Looking good. Do not break it now.'}` : 'Streak: zero. Today can be day one.'],
            serious:  [ctx => `Streak: ${ctx.streak} day${ctx.streak !== 1 ? 's' : ''}.`],
            minimal:  [ctx => `${ctx.streak}d.`],
        },
        whoAreYou: {
            friendly: ['I am Sharky, your reading mascot. Here to cheer you on, keep score and keep you company through every book.', 'A reading shark. I watch your library, celebrate your achievements and chase you when you stop reading.', 'I am Sharky. Part mascot, part accountability system with fins.'],
            funny:    ['I am Sharky. Shark, reader, unsolicited motivator and procrastination detective.', 'A pixel shark with strong opinions about your reading habits.', 'What happens when you combine a shark with a reading app and nobody says no.'],
            serious:  ['Sharky. Reading mascot. Stats tracking and notifications.', 'Reading support system. Designation: Sharky.'],
            minimal:  ['Sharky. Mascot.', 'Your reader.'],
        },
        compliment: {
            friendly: ['Thank you! You are great too.', 'Happy to help! Now go read.', 'That went straight to my fins. Thank you!', 'Aw! I appreciate you too. Now open that book.'],
            funny:    ['The shark blushes. Technically. If it could.', 'I knew you would come to this conclusion eventually.', 'Of course I am great! Now, are you going to read or are we just going to compliment each other?', 'Thanks. That compliment goes straight to my motivation collection.'],
            serious:  ['Thank you.', 'Appreciated.', 'Noted.'],
            minimal:  ['Thanks.', ':)'],
        },
        joke: {
            friendly: [() => pickRandom(JOKE_POOL.en)],
            funny:    [() => pickRandom(JOKE_POOL.en)],
            serious:  ['Humor requests not processed.', 'Not my specialty.', 'A joke? Seriously: read.'],
            minimal:  [() => pickRandom(JOKE_POOL.en)],
        },
        goodbye: {
            friendly: ['See you! Do not forget to read something.', 'Goodbye! I will be here when you are back.', 'See you soon! Your book is waiting.', 'Bye. Bookmark saved.'],
            funny:    ['See you! And yes, I will still be here when you get back.', 'Later. I will watch the library while you are gone.', 'Bye! No vacation for sharks.'],
            serious:  ['Goodbye.', 'Ok.', 'Bye.'],
            minimal:  ['Bye.', 'Later.'],
        },
        help: {
            friendly: ['I can tell you your progress, motivate you, recommend books, tell jokes and track your reading. Ask me anything!', 'Ask me about your current book, streak, stats, or ask for motivation. I know jokes too. Few, but good.'],
            funny:    ['I am an emotional support shark for readers. I can give stats, recommendations, motivation and jokes of questionable quality. All free.', 'I know: stats, progress, books, streaks, jokes, and unsolicited motivation. Your orders.'],
            serious:  ['Commands: progress, stats, streak, current book, recommendation, motivation, joke.', 'Available: reading stats, book status, motivation.'],
            minimal:  ['Stats, books, motivation, jokes.'],
        },
        bookCount: {
            friendly: [ctx => `You have ${ctx.books.length} book${ctx.books.length !== 1 ? 's' : ''} in your library. ${ctx.finishedBooks.length} finished and ${ctx.activeBooks.length} active.`],
            funny:    [ctx => `${ctx.books.length} books. ${ctx.finishedBooks.length} finished. ${ctx.books.length - ctx.finishedBooks.length} waiting. Shark keeps count.`],
            serious:  [ctx => `Total: ${ctx.books.length}. Finished: ${ctx.finishedBooks.length}. Active: ${ctx.activeBooks.length}.`],
            minimal:  [ctx => `${ctx.books.length} books. ${ctx.finishedBooks.length} done.`],
        },
        similar: {
            friendly: [ctx => { if (!ctx.lastReadBook) return 'Start reading a book so I can find you something similar!'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length === 0) return `No similar books to "${ctx.lastReadBook.name}" in your library. Time to add more?`; const names = similar.slice(0, 2).map(b => `"${b.name}"`).join(' and '); return similar[0].author === ctx.lastReadBook.author && ctx.lastReadBook.author ? `Same author as "${ctx.lastReadBook.name}": ${names}. Great options!` : `Based on "${ctx.lastReadBook.name}": ${names}. Interested in either?`; }],
            funny:    [ctx => { if (!ctx.lastReadBook) return 'Similar to what? Shark needs a reference book.'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length === 0) return `Nothing like "${ctx.lastReadBook.name}" in your library. Shark looked hard.`; return `Something like "${ctx.lastReadBook.name}"? Here: "${similar[0].name}". You are welcome.`; }],
            serious:  [ctx => { if (!ctx.lastReadBook) return 'No reference book.'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); return similar.length > 0 ? `Similar: "${similar[0].name}".` : 'No similar books found.'; }],
            minimal:  [ctx => { if (!ctx.lastReadBook) return '?'; const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); return similar.length > 0 ? `"${similar[0].name}".` : 'None.'; }],
        },
        nextBook: {
            friendly: [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) { const b = similar[0]; if (b.series && ctx.lastReadBook?.series && b.series.toLowerCase() === ctx.lastReadBook.series.toLowerCase()) return `Next in the series: "${b.name}"! Go get it!`; if (b.author === ctx.lastReadBook?.author && b.author) return `Same author — you could follow with "${b.name}". Great choice!`; return `Based on your taste, I recommend "${b.name}". What do you think?`; } const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `How about starting "${pickRandom(unread).name}"? Still unexplored!` : 'Your whole library is done! Time to add something new.'; }],
            funny:    [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) return `Shark recommends: "${similar[0].name}". Non-negotiable.`; const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `"${pickRandom(unread).name}". No special reason. Just start it already.` : 'Whole library read. Shark is silent out of respect.'; }],
            serious:  [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); if (similar.length > 0) return `Next: "${similar[0].name}".`; const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); return unread.length > 0 ? `Unstarted: "${pickRandom(unread).name}".` : 'Library complete.'; }],
            minimal:  [ctx => { const similar = findSimilarBooks(ctx.lastReadBook, ctx.books); const unread = ctx.books.filter(b => !b.isFinished && (b.progress || 0) < 5); const pick = similar[0] || pickRandom(unread); return pick ? `"${pick.name}".` : 'None.'; }],
        },
        fallback: {
            friendly: ['Not sure I understood that, but I am listening. Want to know your progress, get a recommendation or need motivation?', 'Hmm, not sure how to answer. Try: "what am I reading", "my progress", "motivate me" or "tell me a joke".', 'Could you rephrase? I am a shark with limited linguistic range.'],
            funny:    ['Did not catch that, but the shark is still here. Try something simpler.', 'That is outside my linguistic bite radius. Try "joke", "progress" or "what am I reading".', 'Format not recognized. Have you tried "motivate me"? That one I get.'],
            serious:  ['Command not recognized.', 'No response available.', 'Try: progress, stats, recommendation.'],
            minimal:  ['?', 'Try again.', 'Unclear.'],
        },
    },
};

export function getScriptedResponse(intent, ctx) {
    const l = ctx.lang === 'en' ? 'en' : 'es';
    const p = ctx.personality || 'friendly';
    const pool = CHAT_RESPONSES[l]?.[intent]?.[p]
        || CHAT_RESPONSES[l]?.[intent]?.friendly
        || CHAT_RESPONSES[l]?.fallback?.friendly
        || ['...'];
    const template = pickRandom(pool);
    return typeof template === 'function' ? template(ctx) : template;
}

// ── AI prompt builders ─────────────────────────────────────────────────────
// Versión del set de prompts — súbela cuando cambies el texto de forma
// material (no por typos). Se adjunta a los registros de diagnóstico de
// fallos de IA para poder correlacionar "empezó a fallar/responder raro
// después de la versión X" sin tener que adivinar qué prompt exacto se envió.
export const PROMPT_VERSION = 'v1';

export function buildSystemPrompt({ lang, personality, books, stats, readerLevel, dailyGoalMins }) {
    const l = lang === 'en' ? 'English' : 'Spanish';
    const finished = books.filter(b => b.isFinished);
    const active = books.filter(b => b.lastReadDate > 0 && !b.isFinished);
    const daily = stats.currentDailyMins || 0;
    const goal = dailyGoalMins || 30;
    const streak = stats.streak || 0;
    const personalityDesc = {
        friendly: 'warm, encouraging, supportive',
        funny: 'humorous, witty, playful but never mean',
        serious: 'brief, direct, professional',
        minimal: 'very terse, just the essential',
    }[personality] || 'friendly';
    return `You are Sharky, a cute shark reading mascot. Chat naturally with the reader in ${l}.
Keep responses short (1-3 sentences max). Be ${personalityDesc}.
Stay fully in character as Sharky — never break character.
Reader context: Level ${readerLevel.level}, streak ${streak} days, ${daily}/${goal} min today.
${finished.length > 0 ? `Finished books: ${finished.slice(-3).map(b => `"${b.name}"`).join(', ')}.` : ''}
${active.length > 0 ? `Currently reading: ${active.slice(0, 2).map(b => `"${b.name}" at ${Math.round(b.progress || 0)}%`).join(', ')}.` : ''}
Total books in library: ${books.length}. Reference specific book titles when relevant.`;
}

export function buildChatAIPrompt({ userText, lang, personality, books, stats, readerLevel, dailyGoalMins }) {
    const systemCtx = buildSystemPrompt({ lang, personality, books, stats, readerLevel, dailyGoalMins });
    return `${systemCtx}\n\nUser message: ${userText}`;
}

export function buildSpecialAIPrompt(type, { lang, personality, books, stats, readerLevel, dailyGoalMins, currentBook }) {
    const sysPrompt = buildSystemPrompt({ lang, personality, books, stats, readerLevel, dailyGoalMins });
    const l = lang === 'en' ? 'en' : 'es';
    const pct = Math.round(currentBook?.progress || 0);
    const bookInfo = currentBook
        ? (l === 'en'
            ? `"${currentBook.name}"${currentBook.author ? ` by ${currentBook.author}` : ''} at ${pct}%`
            : `"${currentBook.name}"${currentBook.author ? ` de ${currentBook.author}` : ''} al ${pct}%`)
        : (l === 'en' ? 'no active book' : 'sin libro activo');
    if (type === 'bookTalk') {
        return l === 'en'
            ? `${sysPrompt}\n\nThe user is reading ${bookInfo}. Ask them one engaging open-ended question about their experience with this book so far. Be ${personality === 'funny' ? 'playful and witty' : personality === 'serious' ? 'direct and brief' : 'warm and curious'}. One sentence only.`
            : `${sysPrompt}\n\nEl usuario está leyendo ${bookInfo}. Hazle una pregunta abierta y atractiva sobre su experiencia leyendo este libro hasta ahora. Sé ${personality === 'funny' ? 'juguetón y gracioso' : personality === 'serious' ? 'directo y breve' : 'cálido y curioso'}. Solo una frase.`;
    }
    if (type === 'summary') {
        return l === 'en'
            ? `${sysPrompt}\n\nThe user is reading ${bookInfo}. Give a brief (2-3 sentences) spoiler-conscious overview of what typically happens in the first ${pct}% of this book. If you don't know this specific book, say so briefly and encourage them. Do not spoil beyond ${pct}%.`
            : `${sysPrompt}\n\nEl usuario está leyendo ${bookInfo}. Da un breve resumen (2-3 frases) consciente de los spoilers de lo que suele ocurrir en el primer ${pct}% de este libro. Si no conoces el libro específico, dilo brevemente y anímale a continuar. No desveles más allá del ${pct}%.`;
    }
    if (type === 'quiz') {
        return l === 'en'
            ? `${sysPrompt}\n\nThe user has read ${pct}% of ${bookInfo}. Generate 2 short reflection questions about what they might have experienced. Make them conversational, not test-like. Format as a numbered list.`
            : `${sysPrompt}\n\nEl usuario ha leído el ${pct}% de ${bookInfo}. Genera 2 preguntas cortas de reflexión sobre lo que pudo haber vivido hasta ahora. Hazlas conversacionales, no como un examen. Formato de lista numerada.`;
    }
    return sysPrompt;
}

// ── Diálogos contextuales: sesión y apertura de libro ─────────────────────
export const SESSION_END = {
    es: {
        friendly: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const p = endProgress > 0 ? ` Vas por el ${endProgress}%.` : '';
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            if (sessionMins < 5) return `${sessionMins} min con "${bookName}".${d}${p} Cada minuto suma.`;
            if (sessionMins < 20) return `Buena sesión: ${sessionMins} min con "${bookName}".${d}${p}`;
            if (sessionMins < 60) return `¡${sessionMins} minutos! Buen trabajo con "${bookName}".${d}${p}`;
            return `${sessionMins} minutos seguidos con "${bookName}". Eso es dedicación seria.${d}${p}`;
        },
        funny: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const p = endProgress > 0 ? ` ${endProgress}% del libro.` : '';
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            if (sessionMins < 5) return `${sessionMins} min. Corto, pero el tiburón vio todo.${d}${p}`;
            if (sessionMins < 20) return `${sessionMins} minutos con "${bookName}". No está mal para ser tú.${d}${p}`;
            if (sessionMins < 60) return `${sessionMins} min con "${bookName}". El tiburón aprueba.${d}${p}`;
            return `${sessionMins} minutos. Yo también estaba aquí todo el rato con "${bookName}".${d}${p}`;
        },
        serious: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            return `${sessionMins} min. "${bookName}".${d}${endProgress > 0 ? ` ${endProgress}%.` : ''}`;
        },
        minimal: ({ sessionMins, endProgress }) => {
            if (sessionMins === 0) return null;
            return endProgress > 0 ? `${sessionMins}min · ${endProgress}%` : `${sessionMins}min`;
        },
    },
    en: {
        friendly: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const p = endProgress > 0 ? ` You are at ${endProgress}%.` : '';
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            if (sessionMins < 5) return `${sessionMins} min with "${bookName}".${d}${p} Every minute counts.`;
            if (sessionMins < 20) return `Good session: ${sessionMins} min with "${bookName}".${d}${p}`;
            if (sessionMins < 60) return `${sessionMins} minutes! Great work with "${bookName}".${d}${p}`;
            return `${sessionMins} minutes straight with "${bookName}". That is serious dedication.${d}${p}`;
        },
        funny: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const p = endProgress > 0 ? ` ${endProgress}% done.` : '';
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            if (sessionMins < 5) return `${sessionMins} min. Short, but the shark was watching.${d}${p}`;
            if (sessionMins < 20) return `${sessionMins} minutes with "${bookName}". Not bad, for you.${d}${p}`;
            if (sessionMins < 60) return `${sessionMins} min with "${bookName}". Shark approves.${d}${p}`;
            return `${sessionMins} minutes. I was here the whole time with "${bookName}".${d}${p}`;
        },
        serious: ({ bookName, sessionMins, endProgress, progressDelta }) => {
            if (sessionMins === 0) return null;
            const d = progressDelta > 0 ? ` +${progressDelta}%` : '';
            return `${sessionMins} min. "${bookName}".${d}${endProgress > 0 ? ` ${endProgress}%.` : ''}`;
        },
        minimal: ({ sessionMins, endProgress }) => {
            if (sessionMins === 0) return null;
            return endProgress > 0 ? `${sessionMins}min · ${endProgress}%` : `${sessionMins}min`;
        },
    },
};

export const BOOK_OPENED = {
    es: {
        friendly: ({ bookName, progress, daysSinceRead, isNew, hour }) => {
            if (isNew) return `Libro nuevo: "${bookName}". ¡Que empiece la aventura!`;
            if (daysSinceRead >= 14) return `¡${daysSinceRead} días sin abrir "${bookName}"! ¿Recordabas por dónde ibas?`;
            if (daysSinceRead >= 7) return `Una semana sin "${bookName}". Buena hora para volver.`;
            if (daysSinceRead >= 3) return `${daysSinceRead} días sin esto. "${bookName}" te echaba de menos.`;
            if (progress >= 90) return `¡Ya casi terminas "${bookName}"! Solo queda el final.`;
            if (progress >= 70) return `Por el ${Math.round(progress)}% de "${bookName}". ¿Ya se está poniendo bueno?`;
            if (progress >= 50) return `Mitad de "${bookName}". Lo más emocionante está por venir.`;
            if (hour >= 0 && hour < 5) return `¿Leyendo a las ${hour}h? "${bookName}" no podía esperar.`;
            if (hour >= 5 && hour < 8) return `Madrugador. "${bookName}" antes del día. Buen plan.`;
            if (hour >= 22) return `Última sesión del día con "${bookName}". Buenas noches a ambos.`;
            return `De vuelta con "${bookName}".`;
        },
        funny: ({ bookName, progress, daysSinceRead, isNew, hour }) => {
            if (isNew) return `Libro nuevo detectado: "${bookName}". El tiburón toma nota.`;
            if (daysSinceRead >= 14) return `${daysSinceRead} días. "${bookName}" ya creía que lo habías abandonado.`;
            if (daysSinceRead >= 7) return `Una semana sin "${bookName}". Yo no digo nada. Pero lo pienso.`;
            if (daysSinceRead >= 3) return `${daysSinceRead} días sin esto. ¿Todo bien con "${bookName}"?`;
            if (progress >= 90) return `Tan cerca del final de "${bookName}"... el tiburón no aguanta.`;
            if (progress >= 50) return `Mitad de "${bookName}". Sin spoilers de mi parte.`;
            if (hour >= 0 && hour < 5) return `Son las ${hour}h y estás abriendo "${bookName}". Respeto.`;
            if (hour >= 5 && hour < 8) return `Antes de las 8 con "${bookName}". El tiburón ya lleva un rato despierto.`;
            if (hour >= 22) return `Noche de "${bookName}". El tiburón también vela.`;
            return `"${bookName}" otra vez. El tiburón nunca se cansa.`;
        },
        serious: ({ bookName, progress, daysSinceRead, isNew }) => {
            if (isNew) return `"${bookName}". Libro nuevo.`;
            if (daysSinceRead >= 7) return `${daysSinceRead}d sin abrir. "${bookName}".`;
            return progress > 0 ? `"${bookName}". ${Math.round(progress)}%.` : `"${bookName}".`;
        },
        minimal: () => null,
    },
    en: {
        friendly: ({ bookName, progress, daysSinceRead, isNew, hour }) => {
            if (isNew) return `New book: "${bookName}". Let the adventure begin!`;
            if (daysSinceRead >= 14) return `${daysSinceRead} days since "${bookName}"! Do you remember where you were?`;
            if (daysSinceRead >= 7) return `A week without "${bookName}". Good time to return.`;
            if (daysSinceRead >= 3) return `${daysSinceRead} days away. "${bookName}" missed you.`;
            if (progress >= 90) return `Almost done with "${bookName}"! Just the ending left.`;
            if (progress >= 70) return `${Math.round(progress)}% through "${bookName}". Getting good?`;
            if (progress >= 50) return `Halfway through "${bookName}". Best part is ahead.`;
            if (hour >= 0 && hour < 5) return `Reading at ${hour}h? "${bookName}" could not wait.`;
            if (hour >= 5 && hour < 8) return `Early bird. "${bookName}" before the day starts. Good plan.`;
            if (hour >= 22) return `Last session of the day with "${bookName}". Good night to you both.`;
            return `Back with "${bookName}".`;
        },
        funny: ({ bookName, progress, daysSinceRead, isNew, hour }) => {
            if (isNew) return `New book detected: "${bookName}". Shark takes note.`;
            if (daysSinceRead >= 14) return `${daysSinceRead} days. "${bookName}" thought you had abandoned it.`;
            if (daysSinceRead >= 7) return `A week without "${bookName}". I say nothing. But I think it.`;
            if (daysSinceRead >= 3) return `${daysSinceRead} days without this. Everything okay with "${bookName}"?`;
            if (progress >= 90) return `So close to the end of "${bookName}"... shark cannot handle it.`;
            if (progress >= 50) return `Halfway through "${bookName}". No spoilers from me.`;
            if (hour >= 0 && hour < 5) return `It is ${hour}h and you are opening "${bookName}". Respect.`;
            if (hour >= 5 && hour < 8) return `Before 8am with "${bookName}". Shark has been up a while.`;
            if (hour >= 22) return `Night session with "${bookName}". Shark keeps watch.`;
            return `"${bookName}" again. Shark never tires.`;
        },
        serious: ({ bookName, progress, daysSinceRead, isNew }) => {
            if (isNew) return `"${bookName}". New book.`;
            if (daysSinceRead >= 7) return `${daysSinceRead}d since last open. "${bookName}".`;
            return progress > 0 ? `"${bookName}". ${Math.round(progress)}%.` : `"${bookName}".`;
        },
        minimal: () => null,
    },
};
