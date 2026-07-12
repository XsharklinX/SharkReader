import { useState, useEffect, useCallback, useMemo } from 'react';
import { saveAppData } from '../db';
import { useStableReaderBook } from './useStableReaderBook';

// Dominio de "orquestación del lector": qué tabs hay abiertas, cuál está activa,
// el panel derecho (split view) y los saltos a CFI pendientes por tab. Extraído
// de App.jsx (candidato de deuda técnica desde v3.6) para que abrir/cerrar/cambiar
// de libro no viva mezclado con biblioteca, workshop, sync, etc.
export function useReaderOrchestration({
    books,
    booksRef,
    booksById,
    addonsRef,
    sharkyActionsRef,
    addJournalEntry,
    setBooks,
    setLastReadId,
    setView,
    isDbLoaded,
    isStateHydrated,
    isResettingRef,
    openBookNotifyTimerRef,
}) {
    const [tabs, setTabs] = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);
    const [tabTargetCfi, setTabTargetCfi] = useState({});
    const [panelMode, setPanelMode] = useState(false);
    const [rightTabId, setRightTabId] = useState(null);

    // Persistencia de la sesión del lector (tabs abiertas, activa, split, CFIs pendientes)
    useEffect(() => {
        if (!isStateHydrated || isResettingRef.current) return;
        const session = { tabs, activeTabId, tabTargetCfi, panelMode, rightTabId };
        saveAppData('readerSession', session).then(ok => {
            if (ok === false) console.warn('[SharkReader] No se pudo persistir la sesion del lector');
        });
        localStorage.setItem('sharkreader_reader_session', JSON.stringify(session));
    }, [tabs, activeTabId, tabTargetCfi, panelMode, rightTabId, isStateHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

    // Saneamiento: si un libro deja de existir (borrado), sus tabs/CFIs pendientes también
    useEffect(() => {
        if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
        if (!books.length && tabs.length === 0) return;
        const validBookIds = new Set(books.map(book => book.id));
        const validTabs = tabs.filter(tab => validBookIds.has(tab.bookId));
        if (validTabs.length !== tabs.length) {
            setTabs(validTabs);
        }
        if (activeTabId && !validTabs.some(tab => tab.id === activeTabId)) {
            setActiveTabId(validTabs[0]?.id || null);
        }
        if (rightTabId && !validTabs.some(tab => tab.id === rightTabId)) {
            setRightTabId(null);
            setPanelMode(false);
        }
        setTabTargetCfi(prev => {
            const next = Object.fromEntries(Object.entries(prev).filter(([tabId]) => validTabs.some(tab => tab.id === tabId)));
            return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        });
    }, [books, tabs, activeTabId, rightTabId, isDbLoaded, isStateHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

    const openBook = useCallback((bookId, cfi = null) => {
        const bookToOpen = booksRef.current.find(book => book.id === bookId);
        const existing = tabs.find(t => t.bookId === bookId);
        if (existing) {
            setActiveTabId(existing.id);
            if (cfi) setTabTargetCfi(p => ({ ...p, [existing.id]: cfi }));
            setView('reader');
            return;
        }
        const tabId = 'tab_' + Date.now();
        const startMinutes = bookToOpen?.readingMinutes || 0;
        const startProgress = bookToOpen?.progress || 0;
        setTabs(prev => [...prev, { id: tabId, bookId, startMinutes, startProgress }]);
        setActiveTabId(tabId);
        if (cfi) setTabTargetCfi(p => ({ ...p, [tabId]: cfi }));
        setLastReadId(bookId);
        setBooks(prev => prev.map(b => {
            if (b.id !== bookId) return b;
            const now = Date.now();
            return { ...b, lastReadDate: now, dateStarted: b.dateStarted || now, progressUpdatedAt: now, updatedAt: now };
        }));
        setView('reader');
        const isNew = !bookToOpen?.lastReadDate;
        clearTimeout(openBookNotifyTimerRef.current);
        openBookNotifyTimerRef.current = setTimeout(() => {
            openBookNotifyTimerRef.current = null;
            sharkyActionsRef.current?.notifyBookOpened({
                bookName: bookToOpen?.name || '',
                progress: startProgress,
                lastReadDate: bookToOpen?.lastReadDate || null,
                isNew,
                hour: new Date().getHours(),
            });
        }, 800);
    }, [tabs, booksRef, setBooks, setLastReadId, setView, sharkyActionsRef, openBookNotifyTimerRef]);

    const closeTab = useCallback((tabId, e) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (!tabId) return;
        // On close: Reading Journal + Auto Bookmark + Sharky session summary
        setBooks(booksSnap => {
            const closingTab = tabs.find(t => t.id === tabId);
            if (closingTab) {
                const book = booksSnap.find(b => b.id === closingTab.bookId);
                if (book) {
                    if (addonsRef.current.readingJournal && book.readingMinutes > 0) {
                        addJournalEntry(book.name, book.readingMinutes, book.progress || 0);
                    }
                    if (addonsRef.current.autoBookmark && book.lastLocation) {
                        const alreadyBookmarked = book.bookmarks?.some(bm => bm.cfi === book.lastLocation);
                        if (!alreadyBookmarked) {
                            const autoMark = { cfi: book.lastLocation, note: `📌 Auto — ${new Date().toISOString().slice(0, 10)}`, date: new Date().toISOString().slice(0, 10) };
                            return booksSnap.map(b => b.id === closingTab.bookId ? { ...b, bookmarks: [...(b.bookmarks || []), autoMark], metadataUpdatedAt: Date.now(), updatedAt: Date.now() } : b);
                        }
                    }
                    const sessionMins = Math.round((book.readingMinutes || 0) - (closingTab.startMinutes || 0));
                    const startProgress = closingTab.startProgress ?? 0;
                    const endProgress = book.progress || 0;
                    const progressDelta = Math.max(0, endProgress - startProgress);
                    sharkyActionsRef.current?.notifySessionEnd({
                        bookName: book.name,
                        sessionMins,
                        startProgress,
                        endProgress,
                        progressDelta,
                    });
                }
            }
            return booksSnap;
        });
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId);
            if (activeTabId === tabId) {
                if (newTabs.length > 0) { setActiveTabId(newTabs[newTabs.length - 1].id); setView('reader'); }
                else { setActiveTabId(null); setView('library'); }
            }
            if (rightTabId === tabId) { setPanelMode(false); setRightTabId(null); }
            return newTabs;
        });
        setTabTargetCfi(prev => { const n = { ...prev }; delete n[tabId]; return n; });
    }, [activeTabId, rightTabId, tabs, addonsRef, sharkyActionsRef, setBooks, setView, addJournalEntry]);

    const closeBook = useCallback(() => {
        closeTab(activeTabId);
        if (document.fullscreenElement) document.exitFullscreen();
    }, [activeTabId, closeTab]);

    const switchReaderTab = useCallback((id) => {
        setActiveTabId(id);
        setView('reader');
    }, [setView]);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const currentBookData = useMemo(() => activeTab ? booksById.get(activeTab.bookId) || null : null, [activeTab, booksById]);
    const stableCurrentBookData = useStableReaderBook(currentBookData);
    const currentTargetCfi = tabTargetCfi[activeTabId] || null;
    const rightBookData = useMemo(() => {
        if (!panelMode || !rightTabId) return null;
        const rt = tabs.find(t => t.id === rightTabId);
        return rt ? booksById.get(rt.bookId) || null : null;
    }, [panelMode, rightTabId, tabs, booksById]);
    const stableRightBookData = useStableReaderBook(rightBookData);

    return {
        tabs, setTabs,
        activeTabId, setActiveTabId,
        tabTargetCfi, setTabTargetCfi,
        panelMode, setPanelMode,
        rightTabId, setRightTabId,
        openBook,
        closeTab,
        closeBook,
        switchReaderTab,
        activeTab,
        currentBookData,
        stableCurrentBookData,
        currentTargetCfi,
        rightBookData,
        stableRightBookData,
    };
}
