import React, { createContext, useState, useRef, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSystemLoading, setIsSystemLoading] = useState(false);
    const location = useLocation();

    // Refs to manage timers without re-renders
    const startTimerRef = useRef(null);
    const minDisplayTimerRef = useRef(null);
    const startTimeRef = useRef(null);

    const showLoader = (immediate = false, isSystem = false) => {
        // Clear any pending clear timers
        if (minDisplayTimerRef.current) clearTimeout(minDisplayTimerRef.current);

        if (isSystem) setIsSystemLoading(true);

        if (immediate) {
            setIsLoading(true);
            startTimeRef.current = Date.now();
        } else {
            // Smart Delay: Only show if request takes > 500ms
            if (!startTimerRef.current && !isLoading) {
                startTimerRef.current = setTimeout(() => {
                    setIsLoading(true);
                    startTimeRef.current = Date.now();
                }, 500);
            }
        }
    };

    const hideLoader = () => {
        // 1. Cancel the start timer if it hasn't fired yet (Action was < 500ms)
        if (startTimerRef.current) {
            clearTimeout(startTimerRef.current);
            startTimerRef.current = null;
        }

        // 2. If loader is currently visible, ensure minimum display time (800ms)
        const cleanup = () => {
            setIsLoading(false);
            setIsSystemLoading(false);
            startTimeRef.current = null;
        };

        if (isLoading && startTimeRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            const MIN_DISPLAY_TIME = 800;

            if (elapsed < MIN_DISPLAY_TIME) {
                const remaining = MIN_DISPLAY_TIME - elapsed;
                minDisplayTimerRef.current = setTimeout(cleanup, remaining);
            } else {
                cleanup();
            }
        } else {
            cleanup();
        }
    };

    // We remove the automatic hide on location change to allow pages to 
    // control when the loader disappears (e.g. after data fetch).
    // useEffect(() => {
    //     hideLoader();
    // }, [location]);

    // Event Listener Bridge with Smart Logic
    useEffect(() => {
        const handleStart = (e) => showLoader(e.detail?.immediate, e.detail?.isSystem);
        const handleEnd = () => hideLoader();

        window.addEventListener('sbh-loading-start', handleStart);
        window.addEventListener('sbh-loading-end', handleEnd);

        return () => {
            window.removeEventListener('sbh-loading-start', handleStart);
            window.removeEventListener('sbh-loading-end', handleEnd);
        };
    }, [isLoading]);

    return (
        <LoadingContext.Provider value={{ isLoading, isSystemLoading, showLoader, hideLoader }}>
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);
