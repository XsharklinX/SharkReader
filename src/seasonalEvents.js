// Eventos estacionales de Sharky: fechas señaladas del calendario lector +
// aniversario de la cuenta. Lógica pura y testeable — SharkyContext decide
// cuándo mostrarlos y evita repetirlos el mismo día.

const SEASONAL_EVENTS = [
    { id: 'newyear', month: 1, day: 1, emoji: '🎉',
      es: '¡Feliz año nuevo lector! Que este año se llene de páginas.',
      en: 'Happy new reading year! May it be full of pages.' },
    { id: 'bookday', month: 4, day: 23, emoji: '📖',
      es: 'Hoy es el Día Internacional del Libro. ¡A celebrar leyendo!',
      en: "It's World Book Day. Let's celebrate by reading!" },
    { id: 'summer', month: 6, day: 21, emoji: '☀️',
      es: 'Empieza el verano. Buen momento para leer bajo la sombra.',
      en: 'Summer begins. Good time to read in the shade.' },
    { id: 'halloween', month: 10, day: 31, emoji: '🎃',
      es: 'Noche de Halloween... ¿algo de terror en la lista de lectura?',
      en: 'Halloween night... anything spooky on your reading list?' },
    { id: 'christmas', month: 12, day: 24, emoji: '🎄',
      es: 'Feliz Nochebuena. ¿Un libro bajo el árbol?',
      en: 'Merry Christmas Eve. A book under the tree?' },
    { id: 'yearend', month: 12, day: 31, emoji: '🥂',
      es: 'Último día del año. ¿Cerramos un libro pendiente?',
      en: 'Last day of the year. Shall we finish a pending book?' },
];

// Evento estacional activo hoy, o null. `now` inyectable para testear.
export function getActiveSeasonalEvent(now = new Date(), lang = 'es') {
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const event = SEASONAL_EVENTS.find(e => e.month === month && e.day === day);
    if (!event) return null;
    const l = lang === 'en' ? 'en' : 'es';
    return { id: event.id, emoji: event.emoji, message: `${event.emoji} ${event[l]}` };
}

// Aniversario de la cuenta (mismo día/mes que `joinedAt`, al menos 1 año después).
export function getAppAnniversaryEvent(joinedAt, now = Date.now(), lang = 'es') {
    if (!joinedAt) return null;
    const start = new Date(joinedAt);
    const current = new Date(now);
    if (start.getMonth() !== current.getMonth() || start.getDate() !== current.getDate()) return null;
    const years = current.getFullYear() - start.getFullYear();
    if (years < 1) return null;
    const l = lang === 'en' ? 'en' : 'es';
    const message = l === 'en'
        ? `🦈 ${years} year${years > 1 ? 's' : ''} since you joined SharkReader!`
        : `🦈 ¡${years} año${years > 1 ? 's' : ''} desde que llegaste a SharkReader!`;
    return { id: 'app-anniversary', years, message };
}
