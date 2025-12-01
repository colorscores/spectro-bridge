// Helper to fetch auth emails via edge function with graceful fallback
// Usage:
//   import { fetchAuthEmails, fetchSingleAuthEmail } from '@/lib/authEmailHelper';
//   const map = await fetchAuthEmails(ids);
//   const email = await fetchSingleAuthEmail(id);

import { supabase } from '@/lib/customSupabaseClient';

export async function fetchAuthEmails(userIds = []) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  const result = new Map();
  if (ids.length === 0) return result;

  // Try RPC first (faster, no cross-network)
  try {
    const { data: rows, error } = await supabase.rpc('admin_get_auth_emails', { user_ids: ids });
    if (!error && Array.isArray(rows)) {
      for (const row of rows) if (row?.id) result.set(row.id, row.email || '');
      return result;
    }
  } catch (_) {}

  // Fallback to edge function (batch)
  try {
    const { data: resp, error } = await supabase.functions.invoke('admin-get-auth-emails', {
      body: { userIds: ids },
    });
    if (!error && resp && Array.isArray(resp.emails)) {
      for (const { id, email } of resp.emails) result.set(id, email || '');
      return result;
    }
  } catch (_) {}

  // Fallback to legacy function if available
  try {
    const { data, error } = await supabase.functions.invoke('get-users-with-details');
    if (!error && Array.isArray(data)) {
      for (const row of data) if (row?.id) result.set(row.id, row.email || '');
    }
  } catch (_) {}

  // Last-resort: try per-id calls to maximize partial success
  if (result.size === 0) {
    try {
      const entries = await Promise.all(ids.map(async (id) => {
        try {
          const { data: resp, error } = await supabase.functions.invoke('admin-get-auth-emails', { body: { userIds: [id] } });
          if (!error && resp && Array.isArray(resp.emails) && resp.emails[0]?.id === id) {
            return [id, resp.emails[0].email || ''];
          }
        } catch (_) {}
        return [id, ''];
      }));
      for (const [id, email] of entries) if (id) result.set(id, email);
    } catch (_) {}
  }

  return result;
}

export async function fetchSingleAuthEmail(userId) {
  const id = userId || '';
  if (!id) return '';
  try {
    const map = await fetchAuthEmails([id]);
    return map.get(id) || '';
  } catch (_) {
    return '';
  }
}
