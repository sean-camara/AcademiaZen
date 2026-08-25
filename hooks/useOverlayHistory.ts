import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsTab } from '../utils/appNavigation';

export type AppOverlay = 'settings' | 'zen-ai';

export interface OverlayHistoryEntry {
  name: AppOverlay;
  settingsTab?: SettingsTab;
}

const OVERLAY_HISTORY_KEY = '__academiazenOverlay';
const SETTINGS_TABS = new Set<SettingsTab>(['focus', 'profile', 'notifications', 'billing', 'data']);

const asHistoryRecord = (state: unknown): Record<string, unknown> =>
  state && typeof state === 'object' ? (state as Record<string, unknown>) : {};

export const readOverlayHistoryEntry = (state: unknown): OverlayHistoryEntry | null => {
  const value = asHistoryRecord(state)[OVERLAY_HISTORY_KEY];
  if (!value || typeof value !== 'object') return null;

  const entry = value as Record<string, unknown>;
  if (entry.name !== 'settings' && entry.name !== 'zen-ai') return null;

  if (entry.name === 'settings' && typeof entry.settingsTab === 'string' && SETTINGS_TABS.has(entry.settingsTab as SettingsTab)) {
    return { name: 'settings', settingsTab: entry.settingsTab as SettingsTab };
  }

  return { name: entry.name };
};

const writeOverlayHistoryEntry = (entry: OverlayHistoryEntry, replace = false): void => {
  const nextState = {
    ...asHistoryRecord(window.history.state),
    [OVERLAY_HISTORY_KEY]: entry,
  };

  if (replace) {
    window.history.replaceState(nextState, document.title, window.location.href);
  } else {
    window.history.pushState(nextState, document.title, window.location.href);
  }
};

export const useOverlayHistory = (locationKey: string) => {
  const initialEntry = readOverlayHistoryEntry(
    typeof window === 'undefined' ? null : window.history.state,
  );
  const [activeOverlay, setActiveOverlay] = useState<AppOverlay | null>(initialEntry?.name ?? null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(
    initialEntry?.name === 'settings' ? initialEntry.settingsTab ?? null : null,
  );
  const pendingCloseRef = useRef<AppOverlay | null>(null);

  const syncFromHistory = useCallback((entry: OverlayHistoryEntry | null): void => {
    pendingCloseRef.current = null;
    setActiveOverlay(entry?.name ?? null);
    setSettingsTab(entry?.name === 'settings' ? entry.settingsTab ?? null : null);
  }, []);

  const openOverlay = useCallback((entry: OverlayHistoryEntry): void => {
    pendingCloseRef.current = null;
    const currentEntry = readOverlayHistoryEntry(window.history.state);

    if (currentEntry?.name === entry.name) {
      if (currentEntry.settingsTab !== entry.settingsTab) {
        writeOverlayHistoryEntry(entry, true);
      }
    } else {
      writeOverlayHistoryEntry(entry);
    }

    syncFromHistory(entry);
  }, [syncFromHistory]);

  const openSettings = useCallback((tab?: SettingsTab): void => {
    openOverlay(tab ? { name: 'settings', settingsTab: tab } : { name: 'settings' });
  }, [openOverlay]);

  const openAI = useCallback((): void => {
    openOverlay({ name: 'zen-ai' });
  }, [openOverlay]);

  const closeOverlay = useCallback((overlay: AppOverlay): void => {
    if (pendingCloseRef.current) return;

    const currentEntry = readOverlayHistoryEntry(window.history.state);
    if (currentEntry?.name === overlay) {
      pendingCloseRef.current = overlay;
      window.history.back();
      return;
    }

    syncFromHistory(currentEntry);
  }, [syncFromHistory]);

  const closeSettings = useCallback((): void => closeOverlay('settings'), [closeOverlay]);
  const closeAI = useCallback((): void => closeOverlay('zen-ai'), [closeOverlay]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent): void => {
      syncFromHistory(readOverlayHistoryEntry(event.state));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncFromHistory]);

  // React Router can create a new route entry while the desktop AI panel is
  // open. Give that route its own overlay entry so mobile back still dismisses
  // the panel before navigating away from the underlying screen.
  useEffect(() => {
    if (!activeOverlay) return;

    const currentEntry = readOverlayHistoryEntry(window.history.state);
    if (currentEntry?.name === activeOverlay) return;

    const entry: OverlayHistoryEntry =
      activeOverlay === 'settings' && settingsTab
        ? { name: 'settings', settingsTab }
        : { name: activeOverlay };
    writeOverlayHistoryEntry(entry);
  }, [activeOverlay, locationKey, settingsTab]);

  return {
    showSettings: activeOverlay === 'settings',
    showAI: activeOverlay === 'zen-ai',
    settingsTab,
    openSettings,
    openAI,
    closeSettings,
    closeAI,
  };
};
