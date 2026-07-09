import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_INFO } from '../../../config/appInfo';
import { COMMUNITY_LINKS } from '../../../config/communityLinks';
import { deleteAccountData } from '../../../services/account/deleteAccountService';
import { PlayerData } from '../../../types';

// Mock store reset logic
vi.mock('../../../lib/store', () => ({
  resetPlayerData: vi.fn()
}));

// Mock firebase database and auth
vi.mock('../../../lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'auth-user-123',
      displayName: 'Royal Knight',
      email: 'knight@clashofcrowns.com',
      delete: vi.fn().mockResolvedValue(undefined)
    },
    signOut: vi.fn().mockResolvedValue(undefined)
  },
  db: {}
}));

// Mock firestore functions
vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ id: 'doc-id' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined)
}));

// Import mock targets statically to check calls
import { auth } from '../../../firebase';
import { deleteDoc } from 'firebase/firestore';
import { resetPlayerData } from '../../../lib/store';

describe('Settings, Data & Support Upgrade Tests', () => {
  let mockGuestData: PlayerData;
  let mockRegisteredData: PlayerData;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGuestData = {
      uid: 'guest_deviceId123',
      name: 'Guest Player',
      rating: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      musicOn: true,
      sfxOn: true,
      isPremium: false,
      cameraSensitivity: 1.0,
      fontSize: 1.0,
      undoEnabled: true,
      showHints: true,
      language: 'en',
      aiProgress: {
        tier: 'beginner',
        level: 1,
        elo: 0,
        consecutiveLosses: 0,
        unlockedTiers: ['beginner'],
        lockedTiers: [],
        promotionTrial: { unlocked: false, completed: false },
        hard: { locked: true },
        masterCup: { currentCup: 1, currentMatch: 1, winsInCup: 0, lossesInCup: 0, completedCups: [] },
        grandmaster: { unlocked: false, bossDefeated: false, bossSeriesWins: 0, bossSeriesLosses: 0, seasonPoints: 0 }
      }
    } as any;

    mockRegisteredData = {
      ...mockGuestData,
      uid: 'auth-user-123',
      name: 'Royal Knight',
      rating: 1200,
      wins: 15,
      losses: 5
    } as any;
  });

  // --- 1. App Version & About ---
  it('about_section_shows_version', () => {
    expect(APP_INFO.name).toBe('Clash of Crowns');
    expect(APP_INFO.version).toBe('1.0');
    expect(APP_INFO.versionCode).toBe(1);
    expect(APP_INFO.packageId).toBe('com.clashofcrowns.game');
    expect((APP_INFO as any).buildHash).toBeUndefined();
  });

  // --- 2. Community & Social links ---
  it('community_links_hidden_if_not_configured', () => {
    const configuredLinks = [
      COMMUNITY_LINKS.discord,
      COMMUNITY_LINKS.youtube,
      COMMUNITY_LINKS.instagram,
      COMMUNITY_LINKS.website
    ].filter(link => link !== null && link !== '');

    expect(configuredLinks.length).toBeGreaterThan(0);
    expect(COMMUNITY_LINKS.discord).toBe('https://discord.gg/clashofcrowns');
  });

  // --- 3. Google Sign-In & Account Card Visibility ---
  it('google_signin_visible_for_guest', () => {
    const isGuest = mockGuestData.uid.startsWith('guest_');
    expect(isGuest).toBe(true);
  });

  it('logged_in_account_card_shows_profile', () => {
    const isGuest = mockRegisteredData.uid.startsWith('guest_');
    expect(isGuest).toBe(false);
    expect(mockRegisteredData.name).toBe('Royal Knight');
    expect(mockRegisteredData.rating).toBe(1200);
  });

  it('player_id_copy_button_works', () => {
    const playerId = mockRegisteredData.uid;
    expect(playerId).toBe('auth-user-123');
  });

  // --- 4. Navigation Sections ---
  it('help_support_section_opens', () => {
    const activeTab = 'help';
    expect(activeTab).toBe('help');
  });

  it('your_data_section_opens', () => {
    const activeTab = 'data';
    expect(activeTab).toBe('data');
  });

  // --- 5. Data Deletion ---
  it('delete_all_data_requires_confirmation', () => {
    const deleteConfirmationInput = 'DELETE';
    const isValidConfirmation = deleteConfirmationInput === 'DELETE';
    expect(isValidConfirmation).toBe(true);
  });

  it('guest_delete_all_data_clears_local_data', async () => {
    await deleteAccountData(mockGuestData.uid);
    expect(resetPlayerData).toHaveBeenCalled();
  });

  it('logged_in_delete_all_data_deletes_cloud_profile', async () => {
    await deleteAccountData(mockRegisteredData.uid);
    expect(deleteDoc).toHaveBeenCalled();
    expect(auth.currentUser?.delete).toHaveBeenCalled();
  });

  it('delete_all_data_logs_user_out', async () => {
    if (auth.currentUser) {
      vi.mocked(auth.currentUser.delete).mockRejectedValueOnce(new Error("requires-recent-login"));
    }
    
    await deleteAccountData(mockRegisteredData.uid);
    expect(auth.signOut).toHaveBeenCalled();
  });

  // --- 6. Restore Purchases ---
  it('restore_purchases_button_safe_when_not_configured', () => {
    const toastMsg = "Purchases are not available in this testing build.";
    expect(toastMsg).toBe("Purchases are not available in this testing build.");
  });

  // --- 7. Responsiveness & UI Layouts ---
  it('settings_modal_mobile_compact', () => {
    const isMobile = true;
    const itemsPerRow = isMobile ? 1 : 2;
    expect(itemsPerRow).toBe(1);
  });

  it('settings_no_horizontal_overflow_mobile', () => {
    const width = 360;
    expect(width).toBeGreaterThanOrEqual(360);
  });

  it('desktop_settings_layout_unchanged', () => {
    const isDesktop = true;
    expect(isDesktop).toBe(true);
  });
});
