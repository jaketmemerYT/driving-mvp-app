// hooks/useFocusInterval.js
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/**
 * Runs a setInterval only while the screen is focused AND the app is active.
 * Cleans up on blur/unmount automatically.
 */
export default function useFocusInterval(callback, delayMs, enabled = true) {
  const isFocused = useIsFocused();
  const intervalRef = useRef(null);
  const savedCbRef = useRef(callback);
  savedCbRef.current = callback;

  // Start/stop by focus + enabled
  useEffect(() => {
    const shouldRun = Boolean(enabled && isFocused && delayMs > 0);
    clearInterval(intervalRef.current);

    if (shouldRun) {
      intervalRef.current = setInterval(() => {
        savedCbRef.current?.();
      }, delayMs);
    }

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [enabled, isFocused, delayMs]);

  // Also pause when app goes background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      if (!active) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        // On resume, effect above will recreate the interval if shouldRun is true on next render
      }
    });
    return () => sub.remove();
  }, []);
}
