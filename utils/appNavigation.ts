export type SettingsTab = 'focus' | 'profile' | 'notifications' | 'billing' | 'data';

export interface OpenSettingsDetail {
  tab?: SettingsTab;
}

export function openSettings(tab?: SettingsTab): void {
  const detail: OpenSettingsDetail = tab ? { tab } : {};
  window.dispatchEvent(new CustomEvent<OpenSettingsDetail>('open-settings', { detail }));
}
