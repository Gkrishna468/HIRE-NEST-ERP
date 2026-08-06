import { create } from 'zustand';
import { ServiceProvider } from '../lib/providers/ServiceProvider';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface SystemState {
  user: User | null;
  userData: any | null;
  loading: boolean;
  showDemo: boolean;
  pilotMode: boolean;
  initialize: () => () => void;
  closeDemo: () => Promise<void>;
  togglePilotMode: (enabled: boolean) => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  user: null,
  userData: null,
  loading: true,
  showDemo: false,
  pilotMode: false,
  
  initialize: () => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("AUTH UID", u?.uid);
      set({ user: u });
      if (u) {
        try {
          let data = await ServiceProvider.identityService.getUserProfile(u.uid) || {};
          
          const superAdmins = [
            "gopal@hirenestworkforce.com",
            "gopalkrishna0046@gmail.com",
          ];
          if (u.email && superAdmins.includes(u.email.toLowerCase())) {
            data.role = "super_admin";
            data.organizationId = "ORG-GLOBAL-HQ";
            data.status = "ACTIVE";
            data.onboardingCompleted = true;

            // One-time cleanup script
            try {
              await ServiceProvider.identityService.executeAdminCleanup("roger1@mapoutinc.com");
            } catch (cleanupErr) {
              console.warn("Admin cleanup skipped/failed:", cleanupErr);
            }
          }

          const hasSeenDemo = data.hasSeenDemo;
          const pilotMode = data.pilotMode || false;
          
          try {
            await ServiceProvider.identityService.updateUserProfile(u.uid, {
              lastLoginAt: new Date().toISOString(),
              isOnline: true
            });
          } catch (err) {
            console.error("Failed to update lastLoginAt", err);
          }

          set({ 
            userData: data,
            showDemo: !hasSeenDemo && Object.keys(data).length > 0,
            pilotMode
          });
        } catch (e) {
          console.error("User data sync failed", e);
        }
      } else {
        set({ userData: null });
      }
      set({ loading: false });
    });
    return unsub;
  },

  closeDemo: async () => {
    set({ showDemo: false });
    const { user, userData } = get();
    if (user) {
      set({ userData: { ...userData, hasSeenDemo: true } });
      try {
        await ServiceProvider.identityService.updateDemoFlag(user.uid, true);
      } catch (err) {
        console.error("Failed to update demo flag:", err);
      }
    }
  },

  togglePilotMode: async (enabled: boolean) => {
    const { user, userData } = get();
    if (user) {
      set({ pilotMode: enabled, userData: { ...userData, pilotMode: enabled } });
      try {
        await ServiceProvider.identityService.updatePilotMode(user.uid, enabled);
      } catch (err) {
        console.error("Failed to update pilot mode:", err);
      }
    }
  }
}));
