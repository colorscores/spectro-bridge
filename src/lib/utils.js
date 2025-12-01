import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Append a cache-busting version query param for org logos using localStorage
export function withLogoVersion(url, orgId) {
  if (!url) return url;
  try {
    const key = orgId ? `org-logo-version:${orgId}` : 'org-logo-version';
    const v = localStorage.getItem(key);
    if (!v) return url;
    const u = new URL(url, window.location.origin);
    u.searchParams.set('v', v);
    return u.toString();
  } catch (err) {
    try {
      const key = orgId ? `org-logo-version:${orgId}` : 'org-logo-version';
      const v = localStorage.getItem(key);
      if (!v) return url;
      return url + (url.includes('?') ? `&v=${v}` : `?v=${v}`);
    } catch {
      return url;
    }
  }
}
