// api/users.js — User management (admin only)
import { supabase, requireAuth, requireAdmin, setCors } from './_middleware.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;

  const { action } = req.body || req.query;

  try {
    // ── Get Users (admin) ──────────────────────────────────────
    if (action === 'getUsers') {
      if (!requireAdmin(profile, res)) return;
      const { data, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) throw error;
      return res.json({ success: true, users: data });
    }

    // ── Add User (admin) ──────────────────────────────────────
    if (action === 'addUser') {
      if (!requireAdmin(profile, res)) return;
      const { email, password, username, full_name, role } = req.body;
      if (!email || !password || !username || !full_name)
        return res.status(400).json({ success: false, error: 'Missing fields' });

      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (authErr) return res.status(400).json({ success: false, error: authErr.message });

      const { error: profErr } = await supabase.from('profiles').insert({
        id: authData.user.id, username, full_name, role: role || 'staff'
      });
      if (profErr) throw profErr;

      return res.json({ success: true, id: authData.user.id });
    }

    // ── Update User (admin) ───────────────────────────────────
    if (action === 'updateUser') {
      if (!requireAdmin(profile, res)) return;
      const { id, full_name, role, password } = req.body;

      const { error } = await supabase.from('profiles')
        .update({ full_name, role }).eq('id', id);
      if (error) throw error;

      if (password) {
        await supabase.auth.admin.updateUserById(id, { password });
      }
      return res.json({ success: true });
    }

    // ── Delete User / Deactivate (admin) ──────────────────────
    if (action === 'deleteUser') {
      if (!requireAdmin(profile, res)) return;
      const { id } = req.body;
      const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
