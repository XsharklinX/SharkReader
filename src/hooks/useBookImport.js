import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { saveBookToDB, saveBooksToDB } from '../db';
import { extractEpubMeta } from '../epubMeta';
import {
    getBookDedupKey,
    getBookTitleDedupKey,
    updateBookInList,
    toStoredBookRecord,
} from '../bookModel';

export function useBookImport({
    setBooks,
    activeObjectUrlsRef,
    bookDedupKeysRef,
    bookTitleDedupKeysRef,
    fileInputRef,
    folderInputRef,
    showNoticeToast,
    view,
    t,
    externalCatalogState,
    setExternalCatalogState,
    bookPayloadsToFiles,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [folderImport, setFolderImport] = useState(null);
    const [failedImportRetryQueue, setFailedImportRetryQueue] = useState([]);

    const folderImportQueueRef = useRef([]);
    const folderImportProcessingRef = useRef(false);
    const activeFolderImportIdRef = useRef(null);
    const cancelFolderImportRef = useRef(false);

    const resolveImportEntryToFile = useCallback(async (entry) => {
        if (!entry) return null;
        if (entry.dataBase64 || entry.data) {
            return bookPayloadsToFiles([entry])[0] || null;
        }
        if (!entry.path || !window.electronAPI?.readBookFile) return null;
        const payload = await window.electronAPI.readBookFile(entry.path);
        return payload ? (bookPayloadsToFiles([payload])[0] || null) : null;
    }, [bookPayloadsToFiles]);

    const yieldToUi = useCallback(() => new Promise(resolve => setTimeout(resolve, 0)), []);

    const beginFolderImportSession = useCallback((session, folderName = 'Carpeta') => {
        if (!session?.sessionId) return false;
        activeFolderImportIdRef.current = session.sessionId;
        cancelFolderImportRef.current = false;
        folderImportQueueRef.current = [];
        folderImportProcessingRef.current = false;
        setFolderImport({
            sessionId: session.sessionId,
            folderName: session.folderName || folderName,
            phase: 'scanning',
            discovered: 0,
            total: 0,
            imported: 0,
            metadataProcessed: 0,
            addedCount: 0,
            skippedDuplicates: 0,
            failedFiles: [],
            currentName: '',
            scanFinished: false,
            isCancelling: false,
        });
        return true;
    }, []);

    const processFiles = useCallback(async (files, options = {}) => {
        const valid = files.filter(f => /\.(epub|pdf)$/i.test(f.name));
        if (!valid.length) { showNoticeToast('Solo se aceptan archivos .epub y .pdf', 'warning'); return; }

        const existingKeys = new Set(bookDedupKeysRef.current);
        const existingTitleKeys = new Set(bookTitleDedupKeysRef.current);
        const seenKeys = new Set();
        const seenTitleKeys = new Set();
        const duplicateNames = [];
        const uniqueValid = [];

        for (const file of valid) {
            const dedupKey = getBookDedupKey(file);
            const titleDedupKey = getBookTitleDedupKey(file);
            if (
                existingKeys.has(dedupKey) ||
                existingTitleKeys.has(titleDedupKey) ||
                seenKeys.has(dedupKey) ||
                seenTitleKeys.has(titleDedupKey)
            ) {
                duplicateNames.push(file.name);
                continue;
            }
            seenKeys.add(dedupKey);
            seenTitleKeys.add(titleDedupKey);
            uniqueValid.push(file);
        }

        if (!uniqueValid.length) {
            if (duplicateNames.length) {
                showNoticeToast(`${duplicateNames.length} libro(s) duplicado(s) omitidos.`, 'warning');
            }
            valid.forEach(file => options.onFileSkipped?.(file, 'duplicate'));
            return { added: 0, skipped: duplicateNames.length, duplicates: duplicateNames };
        }

        const raceTimeout = (promise, ms, fallback = null) =>
            Promise.race([
                Promise.resolve(promise).catch((err) => {
                    console.error('[SharkReader] Error extrayendo metadata EPUB:', err);
                    return fallback;
                }),
                new Promise(r => setTimeout(() => r(fallback), ms))
            ]);

        const newBooks = uniqueValid.map(file => {
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const type = /\.pdf$/i.test(file.name) ? 'pdf' : 'epub';
            const unknownAuthor = t.unknownAuthor || 'Autor desconocido';
            const nativeMeta = type === 'epub' ? file.nativeMeta : null;
            const nativeTitle = (nativeMeta?.title || '').trim();
            const nativeAuthor = (nativeMeta?.creator || '').trim();
            return {
                id, file, type,
                url: URL.createObjectURL(file),
                sourcePath: file.sourcePath || null,
                name: nativeTitle || baseName,
                author: nativeAuthor || unknownAuthor,
                originalTitle: nativeTitle || baseName,
                originalAuthor: nativeAuthor || unknownAuthor,
                description: nativeMeta?.description || '',
                publisher: nativeMeta?.publisher || '',
                tags: nativeMeta?.subject || '',
                series: '',
                seriesIndex: 0,
                coverUrl: nativeMeta?.coverBase64 || null,
                color: `hsl(${200 + Math.random() * 40}, 70%, 40%)`,
                isFav: false,
                rating: 0,
                progress: 0,
                lastLocation: null,
                dateAdded: Date.now(),
                lastReadDate: 0,
                bookmarks: [],
                category: null,
                notes: '',
                isFinished: false,
                dateStarted: null,
                dateFinished: null,
                readingMinutes: 0,
                loading: false,
                updatedAt: Date.now(),
                progressUpdatedAt: Date.now(),
                metadataUpdatedAt: Date.now(),
            };
        });

        newBooks.forEach(book => {
            bookDedupKeysRef.current.add(getBookDedupKey(book));
            bookTitleDedupKeysRef.current.add(getBookTitleDedupKey(book));
        });

        newBooks.forEach(b => { if (b.url) activeObjectUrlsRef.current.add(b.url); });
        setBooks(prev => [...prev, ...newBooks]);

        if (duplicateNames.length) {
            console.warn('[SharkReader] Se omitieron libros duplicados:', duplicateNames);
            showNoticeToast(`${duplicateNames.length} libro(s) duplicado(s) omitidos.`, 'warning');
        }

        (async () => {
            for (const book of newBooks) {
                if (options.shouldContinue && !options.shouldContinue()) break;

                await saveBookToDB(toStoredBookRecord(book));
                let metadataNotified = false;
                const notifyMetadataProcessed = (result = null) => {
                    if (metadataNotified) return;
                    metadataNotified = true;
                    options.onMetadataProcessed?.(book, result);
                };

                if (book.type !== 'epub') {
                    notifyMetadataProcessed(null);
                    await yieldToUi();
                    continue;
                }

                try {
                    let meta = book.file.nativeMeta || null;
                    if (!meta) {
                        meta = await raceTimeout(extractEpubMeta(book.file), 15000, null);
                    }
                    if (!meta) {
                        notifyMetadataProcessed(null);
                        await yieldToUi();
                        continue;
                    }

                    const title = (meta.title || '').trim() || book.originalTitle;
                    const creator = (meta.creator || '').trim() || book.originalAuthor;
                    const updated = {
                        name: title,
                        author: creator,
                        originalTitle: title,
                        originalAuthor: creator,
                        coverBase64: meta.coverBase64 || null,
                        coverUrl: meta.coverBase64 || null,
                        description: meta.description || '',
                        publisher: meta.publisher || '',
                        tags: meta.subject || '',
                        metadataUpdatedAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    startTransition(() => {
                        setBooks(prev => updateBookInList(prev, book.id, updated));
                    });
                    await saveBookToDB(toStoredBookRecord({ ...book, ...updated }, {}, { includeFile: false }));
                    notifyMetadataProcessed(updated);
                } catch (err) {
                    console.error('[SharkReader] Error finalizando metadata del libro:', book.name, err);
                    notifyMetadataProcessed(null);
                }

                await yieldToUi();
            }
        })().catch(err => console.error('[SharkReader] Error procesando metadata en segundo plano:', err));
        return { added: newBooks.length, skipped: duplicateNames.length, duplicates: duplicateNames };
    }, [bookDedupKeysRef, bookTitleDedupKeysRef, activeObjectUrlsRef, setBooks, showNoticeToast, t, yieldToUi]);

    const finishFolderImportOverlay = useCallback((updater) => {
        setFolderImport(prev => {
            if (!prev) return prev;
            const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
            if (!next) return next;
            if (next.phase === 'done' || next.phase === 'cancelled' || next.phase === 'error' || next.phase === 'empty') {
                activeFolderImportIdRef.current = null;
                if (next.phase === 'done' && (next.failedFiles || []).length > 0) {
                    setFailedImportRetryQueue(next.failedFiles || []);
                    return next;
                }
                setTimeout(() => {
                    setFolderImport(current => current?.sessionId === next.sessionId ? null : current);
                }, next.phase === 'done' ? 1400 : 1800);
            }
            return next;
        });
    }, []);

    const pumpFolderImportQueue = useCallback(async () => {
        if (folderImportProcessingRef.current) return;
        folderImportProcessingRef.current = true;

        try {
            while (folderImportQueueRef.current.length) {
                if (cancelFolderImportRef.current) {
                    folderImportQueueRef.current = [];
                    break;
                }

                const nextBatch = folderImportQueueRef.current.shift();
                if (!nextBatch) continue;

                for (const entry of nextBatch.batch || []) {
                    if (cancelFolderImportRef.current) {
                        folderImportQueueRef.current = [];
                        break;
                    }

                    let file = null;
                    try {
                        file = await resolveImportEntryToFile(entry);
                    } catch (err) {
                        console.error('[SharkReader] No se pudo leer el archivo de la cola de importacion:', entry?.path || entry?.name, err);
                    }

                    if (!file) {
                        finishFolderImportOverlay(prev => {
                            if (!prev || prev.sessionId !== nextBatch.sessionId) return prev;
                            const metadataProcessed = Math.min(prev.total || 0, (prev.metadataProcessed || 0) + 1);
                            const failedFile = {
                                name: entry?.name || entry?.path || 'Archivo desconocido',
                                path: entry?.path || null,
                                reason: 'No se pudo leer el archivo',
                            };
                            const readyForDone = prev.scanFinished && metadataProcessed >= (prev.total || 0) && folderImportQueueRef.current.length === 0;
                            return {
                                ...prev,
                                metadataProcessed,
                                failedFiles: [...(prev.failedFiles || []), failedFile],
                                phase: readyForDone ? 'done' : (prev.scanFinished ? 'metadata' : prev.phase),
                            };
                        });
                        await yieldToUi();
                        continue;
                    }

                    await processFiles([file], {
                        shouldContinue: () => !cancelFolderImportRef.current,
                        onFileSkipped: (_, reason) => {
                            if (reason !== 'duplicate') return;
                            finishFolderImportOverlay(prev => {
                                if (!prev || prev.sessionId !== nextBatch.sessionId) return prev;
                                const metadataProcessed = Math.min(prev.total || 0, (prev.metadataProcessed || 0) + 1);
                                const skippedDuplicates = (prev.skippedDuplicates || 0) + 1;
                                const readyForDone = prev.scanFinished && metadataProcessed >= (prev.total || 0) && folderImportQueueRef.current.length === 0;
                                return {
                                    ...prev,
                                    metadataProcessed,
                                    skippedDuplicates,
                                    phase: readyForDone ? 'done' : (prev.scanFinished ? 'metadata' : prev.phase),
                                };
                            });
                        },
                        onMetadataProcessed: () => {
                            finishFolderImportOverlay(prev => {
                                if (!prev || prev.sessionId !== nextBatch.sessionId) return prev;
                                const metadataProcessed = Math.min(prev.total || 0, (prev.metadataProcessed || 0) + 1);
                                const addedCount = Math.min(prev.total || 0, (prev.addedCount || 0) + 1);
                                const readyForDone = prev.scanFinished && metadataProcessed >= (prev.total || 0) && folderImportQueueRef.current.length === 0;
                                return {
                                    ...prev,
                                    metadataProcessed,
                                    addedCount,
                                    phase: readyForDone ? 'done' : (prev.scanFinished ? 'metadata' : prev.phase),
                                };
                            });
                        }
                    });

                    await yieldToUi();
                }
            }
        } finally {
            folderImportProcessingRef.current = false;
            if (cancelFolderImportRef.current) {
                finishFolderImportOverlay(prev => {
                    if (!prev) return prev;
                    return { ...prev, phase: 'cancelled', scanFinished: true };
                });
            }
        }
    }, [finishFolderImportOverlay, processFiles, resolveImportEntryToFile, yieldToUi]);

    const cancelActiveFolderImport = useCallback(async () => {
        const sessionId = activeFolderImportIdRef.current;
        if (!sessionId) return;

        cancelFolderImportRef.current = true;
        folderImportQueueRef.current = [];
        setFolderImport(prev => prev && prev.sessionId === sessionId ? { ...prev, isCancelling: true } : prev);

        if (window.electronAPI?.cancelFolderImport) {
            await window.electronAPI.cancelFolderImport(sessionId);
        }
        if (!folderImportProcessingRef.current) {
            finishFolderImportOverlay(prev => prev && prev.sessionId === sessionId ? {
                ...prev,
                phase: 'cancelled',
                scanFinished: true,
            } : prev);
        }
    }, [finishFolderImportOverlay]);

    const retryFailedFolderImports = useCallback(async () => {
        const retryable = failedImportRetryQueue.filter(item => item?.path);
        if (!retryable.length) {
            setFolderImport(null);
            setFailedImportRetryQueue([]);
            return;
        }

        const retrySessionId = `retry-import-${Date.now()}`;
        activeFolderImportIdRef.current = retrySessionId;
        cancelFolderImportRef.current = false;
        setFolderImport({
            sessionId: retrySessionId,
            folderName: 'Reintento',
            phase: 'metadata',
            discovered: retryable.length,
            total: retryable.length,
            imported: 0,
            metadataProcessed: 0,
            addedCount: 0,
            skippedDuplicates: 0,
            failedFiles: [],
            currentName: '',
            scanFinished: true,
            isCancelling: false,
        });

        let processed = 0;
        const failures = [];
        for (const entry of retryable) {
            if (cancelFolderImportRef.current) break;
            try {
                const file = await resolveImportEntryToFile(entry);
                if (!file) throw new Error('No se pudo leer el archivo');
                await processFiles([file], {
                    shouldContinue: () => !cancelFolderImportRef.current,
                    onFileSkipped: (_, reason) => {
                        if (reason !== 'duplicate') return;
                        setFolderImport(prev => prev?.sessionId === retrySessionId ? {
                            ...prev,
                            skippedDuplicates: (prev.skippedDuplicates || 0) + 1,
                        } : prev);
                    },
                    onMetadataProcessed: () => {},
                });
            } catch (error) {
                failures.push({ ...entry, reason: error.message || 'No se pudo importar' });
            } finally {
                processed += 1;
                setFolderImport(prev => prev?.sessionId === retrySessionId ? {
                    ...prev,
                    imported: processed,
                    metadataProcessed: processed,
                    addedCount: Math.max(0, processed - failures.length - (prev.skippedDuplicates || 0)),
                    failedFiles: failures,
                } : prev);
                await yieldToUi();
            }
        }

        setFailedImportRetryQueue(failures);
        finishFolderImportOverlay(prev => prev?.sessionId === retrySessionId ? {
            ...prev,
            phase: cancelFolderImportRef.current ? 'cancelled' : 'done',
            failedFiles: failures,
            scanFinished: true,
        } : prev);
    }, [failedImportRetryQueue, finishFolderImportOverlay, processFiles, resolveImportEntryToFile, yieldToUi]);

    // Folder import progress IPC handlers
    useEffect(() => {
        if (!window.electronAPI?.onFolderImportProgress) return;

        const handleProgress = (payload) => {
            if (!payload?.sessionId) return;
            if (activeFolderImportIdRef.current && activeFolderImportIdRef.current !== payload.sessionId) return;

            finishFolderImportOverlay(prev => {
                if (!prev || prev.sessionId !== payload.sessionId) return prev;
                const total = payload.total ?? prev.total ?? 0;
                const imported = payload.imported ?? prev.imported ?? 0;
                let phase = payload.phase || prev.phase;

                if (prev.scanFinished && phase === 'importing' && imported >= total && total > 0) {
                    phase = 'metadata';
                }

                return {
                    ...prev,
                    phase,
                    discovered: payload.discovered ?? prev.discovered ?? 0,
                    total,
                    imported,
                    currentName: payload.currentName || prev.currentName || '',
                };
            });
        };

        const handleBatch = (payload) => {
            if (!payload?.sessionId || !Array.isArray(payload.batch)) return;
            if (activeFolderImportIdRef.current !== payload.sessionId) return;

            folderImportQueueRef.current.push(payload);
            pumpFolderImportQueue().catch((err) => {
                finishFolderImportOverlay(prev => prev && prev.sessionId === payload.sessionId ? {
                    ...prev,
                    phase: 'error',
                    error: err.message,
                } : prev);
            });
        };

        const handleDone = (payload) => {
            if (!payload?.sessionId) return;
            if (activeFolderImportIdRef.current !== payload.sessionId) return;

            finishFolderImportOverlay(prev => {
                if (!prev || prev.sessionId !== payload.sessionId) return prev;

                const total = payload.total ?? prev.total ?? 0;
                const imported = payload.imported ?? prev.imported ?? 0;
                const metadataProcessed = Math.min(prev.metadataProcessed || 0, total);

                if (payload.error) {
                    return {
                        ...prev,
                        phase: 'error',
                        total,
                        imported,
                        scanFinished: true,
                        error: payload.error,
                        failedFiles: [
                            ...(prev.failedFiles || []),
                            { name: prev.folderName || 'Importacion', path: null, reason: payload.error },
                        ],
                    };
                }

                if (payload.cancelled) {
                    return { ...prev, phase: 'cancelled', total, imported, scanFinished: true };
                }

                if (total === 0) {
                    return { ...prev, phase: 'empty', total: 0, imported: 0, scanFinished: true };
                }

                const done = metadataProcessed >= total && folderImportQueueRef.current.length === 0 && !folderImportProcessingRef.current;
                return { ...prev, phase: done ? 'done' : 'metadata', total, imported, scanFinished: true };
            });
        };

        window.electronAPI.onFolderImportProgress(handleProgress);
        window.electronAPI.onFolderImportBatch(handleBatch);
        window.electronAPI.onFolderImportDone(handleDone);

        return () => {
            window.electronAPI.offFolderImportProgress();
            window.electronAPI.offFolderImportBatch();
            window.electronAPI.offFolderImportDone();
        };
    }, [finishFolderImportOverlay, pumpFolderImportQueue]);

    // Open file from Electron file association (Windows "open with")
    useEffect(() => {
        if (!window.electronAPI) return;
        const handler = async (filePath) => {
            if (!filePath) return;
            try {
                if (window.electronAPI?.readBookFile) {
                    const payload = await window.electronAPI.readBookFile(filePath);
                    const files = bookPayloadsToFiles(payload ? [payload] : []);
                    if (files.length) {
                        await processFiles(files);
                        return;
                    }
                }
                const url = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
                const blob = await resp.blob();
                const file = new File([blob], filePath.split(/[\\/]/).pop(), { type: blob.type || 'application/epub+zip' });
                await processFiles([file]);
            } catch (e) {
                console.error('[SharkReader] Error abriendo archivo desde IPC:', e);
            }
        };
        window.electronAPI.onOpenFile(handler);
        return () => window.electronAPI.offOpenFile();
    }, [processFiles, bookPayloadsToFiles]);

    const handleDragOver = (e) => { e.preventDefault(); if (view === 'library') setIsDragging(true); };
    const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (view !== 'library') return; processFiles(Array.from(e.dataTransfer.files)); };

    const openFilePicker = async () => {
        if (window.electronAPI?.pickBookFiles) {
            const payloads = await window.electronAPI.pickBookFiles();
            const files = bookPayloadsToFiles(payloads);
            if (files.length) await processFiles(files);
            return;
        }
        if (!fileInputRef.current) return;
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    };

    const openFolderPicker = async () => {
        if (window.electronAPI?.startFolderImport) {
            const session = await window.electronAPI.startFolderImport();
            beginFolderImportSession(session);
            return;
        }
        if (window.electronAPI?.pickBookFolder) {
            const payloads = await window.electronAPI.pickBookFolder();
            const files = bookPayloadsToFiles(payloads);
            if (files.length) await processFiles(files);
            return;
        }
        if (!folderInputRef.current) return;
        folderInputRef.current.value = '';
        folderInputRef.current.click();
    };

    const handleFilesUpload = async (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        try {
            await processFiles(selectedFiles);
        } catch (err) {
            console.error('[SharkReader] Error importando archivos:', err);
            showNoticeToast(t.importFailed || 'No se pudieron importar los archivos seleccionados.', 'error');
        } finally {
            e.target.value = '';
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (folderInputRef.current) folderInputRef.current.value = '';
        }
    };

    const importExternalCatalogEntry = useCallback(async (entry) => {
        if (!entry?.downloadUrl || !window.electronAPI?.downloadExternalBook) return;
        const confirmed = window.confirm(`Importar "${entry.title}" desde esta fuente externa?\n\nSharkReader no valida derechos de autor. Importa solo contenido propio, publico o autorizado.`);
        if (!confirmed) return;
        setExternalCatalogState(prev => ({ ...prev, importingId: entry.id, error: '' }));
        const result = await window.electronAPI.downloadExternalBook(entry.downloadUrl, entry.title, {
            allowPrivateNetwork: !!externalCatalogState.catalog?.allowPrivateNetwork,
        });
        if (!result?.ok || !result.payload) {
            setExternalCatalogState(prev => ({ ...prev, importingId: null, error: result?.msg || 'No se pudo descargar el libro.' }));
            return;
        }
        const files = bookPayloadsToFiles([result.payload]);
        if (files.length) await processFiles(files);
        setExternalCatalogState(prev => ({ ...prev, importingId: null }));
    }, [bookPayloadsToFiles, externalCatalogState.catalog, processFiles, setExternalCatalogState]);

    return {
        isDragging,
        setIsDragging,
        folderImport,
        setFolderImport,
        failedImportRetryQueue,
        setFailedImportRetryQueue,
        beginFolderImportSession,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        openFilePicker,
        openFolderPicker,
        handleFilesUpload,
        processFiles,
        importExternalCatalogEntry,
        cancelActiveFolderImport,
        retryFailedFolderImports,
    };
}
