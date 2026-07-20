import { useState, useEffect, useRef, useCallback } from 'react';
import { RANDOM_EMOJIS } from '../translations';

export function useUI() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [tempLoginName, setTempLoginName] = useState('');
    const [tempLoginAvatar, setTempLoginAvatar] = useState('🦈');
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [tempEditName, setTempEditName] = useState('');
    const [tempEditAvatar, setTempEditAvatar] = useState('');
    const [showStreakModal, setShowStreakModal] = useState(false);
    const [showWorkshop, setShowWorkshop] = useState(false);
    const [showJournalModal, setShowJournalModal] = useState(false);
    const [showVocabPanel, setShowVocabPanel] = useState(false);
    const [vocabSearch, setVocabSearch] = useState('');
    const [showAuthorSection, setShowAuthorSection] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [draggedBookId, setDraggedBookId] = useState(null);
    const [dropTargetCat, setDropTargetCat] = useState(null);
    const [noticeToast, setNoticeToast] = useState(null);
    const noticeToastTimerRef = useRef(null);

    const showNoticeToast = useCallback((message, tone = 'info') => {
        clearTimeout(noticeToastTimerRef.current);
        setNoticeToast({ message, tone });
        noticeToastTimerRef.current = setTimeout(() => setNoticeToast(null), 3200);
    }, []);

    const handleRandomEmoji = useCallback(() => {
        setTempLoginAvatar(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)]);
    }, []);

    const resetUI = useCallback(() => {
        setSidebarOpen(false);
        setSettingsOpen(false);
        setShowLoginModal(false);
        setShowUserMenu(false);
        setShowEditProfileModal(false);
        setShowStreakModal(false);
        setShowWorkshop(false);
        setShowJournalModal(false);
        setShowVocabPanel(false);
        setShowAuthorSection(false);
        setContextMenu(null);
        setDraggedBookId(null);
        setDropTargetCat(null);
        setNoticeToast(null);
        clearTimeout(noticeToastTimerRef.current);
    }, []);

    useEffect(() => {
        const closeCtx = () => setContextMenu(null);
        const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
        window.addEventListener('click', closeCtx);
        document.addEventListener('fullscreenchange', handleFs);
        return () => {
            window.removeEventListener('click', closeCtx);
            document.removeEventListener('fullscreenchange', handleFs);
        };
    }, []);

    useEffect(() => {
        return () => clearTimeout(noticeToastTimerRef.current);
    }, []);

    return {
        sidebarOpen, setSidebarOpen,
        settingsOpen, setSettingsOpen,
        isFullscreen,
        showLoginModal, setShowLoginModal,
        showUserMenu, setShowUserMenu,
        tempLoginName, setTempLoginName,
        tempLoginAvatar, setTempLoginAvatar,
        showEditProfileModal, setShowEditProfileModal,
        tempEditName, setTempEditName,
        tempEditAvatar, setTempEditAvatar,
        showStreakModal, setShowStreakModal,
        showWorkshop, setShowWorkshop,
        showJournalModal, setShowJournalModal,
        showVocabPanel, setShowVocabPanel,
        vocabSearch, setVocabSearch,
        showAuthorSection, setShowAuthorSection,
        contextMenu, setContextMenu,
        draggedBookId, setDraggedBookId,
        dropTargetCat, setDropTargetCat,
        noticeToast,
        showNoticeToast,
        noticeToastTimerRef,
        handleRandomEmoji,
        resetUI,
    };
}
