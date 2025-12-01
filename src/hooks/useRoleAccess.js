import { } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Stable role access hook with unconditional hooks usage
export const useRoleAccess = () => {
  // Always consume contexts via hooks (providers are present in app tree)
  const { profile } = useProfile() || { profile: null };
  const { user } = useAuth() || { user: null };

  // Stub licenses until licensing hook is integrated
  const licenses = { printerKiosk: { plan: 'Pro' } };

  const authRole =
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    null;

  const roleAccess = computeRoleAccess(profile, licenses, authRole);

  return roleAccess;
};

// Normalize role strings into canonical app roles
const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return null;
  const r = role.trim().toLowerCase();
  if (r === 'superadmin' || r === 'super admin') return 'Superadmin';
  if (r === 'admin') return 'Admin';
  if (r === 'color admin' || r === 'color-admin') return 'Color Admin';
  if (r === 'color user' || r === 'color-user' || r === 'user') return 'Color User';
  return role; // fall back to original (already canonical?)
};

// Pure computation (no hooks)
const computeRoleAccess = (profile, licenses, authRole) => {
  const normalizedProfileRole = normalizeRole(profile?.role);
  const effectiveRole = normalizedProfileRole || normalizeRole(authRole) || 'Color User';

  const isSuperadmin = effectiveRole === 'Superadmin';
  const isAdmin = effectiveRole === 'Admin';
  const isColorAdmin = effectiveRole === 'Color Admin';
  const isColorUser = effectiveRole === 'Color User';

  const printerKioskPlan = licenses?.printerKiosk?.plan || 'No';
  const hasPrinterKioskLicense = printerKioskPlan === 'Basic' || printerKioskPlan === 'Pro';

  return {
    role: effectiveRole,
    canSeeAdmin: isSuperadmin || isAdmin,
    canSeePrintingAssets: hasPrinterKioskLicense && (isSuperadmin || isAdmin || isColorAdmin || isColorUser),
    canEdit: isSuperadmin || isAdmin || isColorAdmin,
    isSuperadmin,
    isAdmin,
    isColorAdmin,
    isColorUser,
  };
};

export default useRoleAccess;
