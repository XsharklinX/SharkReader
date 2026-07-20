import { useCallback, useEffect, useRef } from 'react';

export function useReaderSearchTask() {
    const mountedRef = useRef(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            requestIdRef.current += 1;
        };
    }, []);

    const beginSearchTask = useCallback(() => {
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        return () => mountedRef.current && requestIdRef.current === requestId;
    }, []);

    const cancelSearchTask = useCallback(() => {
        requestIdRef.current += 1;
    }, []);

    return {
        beginSearchTask,
        cancelSearchTask,
    };
}
