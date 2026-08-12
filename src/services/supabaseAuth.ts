import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User as AppUser } from '../types';
import { supabaseService } from './supabaseService';

export class SupabaseAuthService {
  private activeUser: AppUser | null = null;
  private listeners: ((user: AppUser | null) => void)[] = [];

  constructor() {
    // Load cached active user if present
    const saved = localStorage.getItem('active_flutter_user');
    if (saved) {
      try {
        this.activeUser = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved user', e);
      }
    }

    if (isSupabaseConfigured) {
      // Check initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          this.syncAndSetUser(session.user);
        } else if (!saved) {
          this.setActiveUser(null);
        }
      });

      // Listen to Auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          this.syncAndSetUser(session.user);
        } else {
          this.setActiveUser(null);
        }
      });
    }
  }

  private async syncAndSetUser(sbUser: any) {
    const metadata = sbUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || sbUser.email?.split('@')[0] || 'مستخدم';
    const avatarUrl =
      metadata.avatar_url ||
      metadata.picture ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

    const appUser: AppUser = {
      id: sbUser.id, // Real Supabase Auth UUID
      name: fullName,
      avatar: avatarUrl,
      email: sbUser.email || undefined,
      phone: sbUser.phone || undefined,
      language: 'ar',
      isOnline: true,
      statusText: 'متصل عبر حساب Google (Supabase Auth)'
    };

    this.setActiveUser(appUser);

    // Create / update profile record in public.profiles
    await supabaseService.syncUserProfileFromAuth(sbUser);
  }

  getActiveUser(): AppUser | null {
    return this.activeUser;
  }

  setActiveUser(user: AppUser | null) {
    this.activeUser = user;
    if (user) {
      localStorage.setItem('active_flutter_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('active_flutter_user');
    }
    this.notifyListeners();
  }

  async signInWithGoogle(): Promise<{ error?: string }> {
    if (!isSupabaseConfigured) {
      return { error: 'إعدادات Supabase غير مكتملة' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Supabase Google Sign-in error:', error);
        return { error: error.message };
      }

      return {};
    } catch (err: any) {
      console.error('Supabase Google Sign-in exception:', err);
      return { error: err.message || 'فشل تسجيل الدخول عبر Google' };
    }
  }

  async logout(): Promise<void> {
    if (this.activeUser) {
      await supabaseService.setUserPresence(this.activeUser.id, false);
    }
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Supabase signout warning:', e);
    }
    this.setActiveUser(null);
  }

  onUserChange(callback: (user: AppUser | null) => void) {
    this.listeners.push(callback);
    callback(this.activeUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.activeUser));
  }
}

export const supabaseAuth = new SupabaseAuthService();
