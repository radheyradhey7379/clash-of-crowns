import { Preferences } from '@capacitor/preferences';

export type ProfileType = 'guest' | 'user' | null;

export interface SessionInfo {
  activeProfileType: ProfileType;
  guestDeviceId: string;
  lastUserId: string | null;
  guestSession: boolean;
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'node_environment';
  }
  const { value: storedId } = await Preferences.get({ key: 'guestDeviceId' });
  if (storedId) {
    localStorage.setItem("clash_of_crowns_device_id", storedId);
    return storedId;
  }
  
  let localId = localStorage.getItem("clash_of_crowns_device_id");
  if (!localId) {
    localId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  await Preferences.set({ key: 'guestDeviceId', value: localId });
  localStorage.setItem("clash_of_crowns_device_id", localId);
  return localId;
}

export async function getSession(): Promise<SessionInfo> {
  const { value: activeProfileType } = await Preferences.get({ key: 'activeProfileType' });
  const { value: guestSession } = await Preferences.get({ key: 'guestSession' });
  const { value: lastUserId } = await Preferences.get({ key: 'lastUserId' });
  const deviceId = await getOrCreateDeviceId();

  return {
    activeProfileType: activeProfileType as ProfileType,
    guestDeviceId: deviceId,
    lastUserId,
    guestSession: guestSession === 'true',
  };
}

export async function setSession(type: 'guest' | 'user', userId?: string): Promise<void> {
  await Preferences.set({ key: 'activeProfileType', value: type });
  if (type === 'guest') {
    await Preferences.set({ key: 'guestSession', value: 'true' });
  } else {
    await Preferences.set({ key: 'guestSession', value: 'false' });
    if (userId) {
      await Preferences.set({ key: 'lastUserId', value: userId });
    }
  }
}

export async function clearSession(): Promise<void> {
  await Preferences.set({ key: 'activeProfileType', value: '' });
  await Preferences.set({ key: 'guestSession', value: 'false' });
  await Preferences.set({ key: 'lastUserId', value: '' });
}
export async function clearGuestSessionProgress(): Promise<void> {
  localStorage.removeItem("clash_player_data");
  localStorage.removeItem("clash_player_data_backup");
  localStorage.removeItem("clash_of_crowns_saved_game");
}
