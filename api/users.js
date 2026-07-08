const { supabase, requireAuth, requireAdmin, setCors } = require('./_lib');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;
  const SID = profile.store_id;

  const { action } = req.body || {};

  try {
    if (action === 'getUsers') {
      if (!requireAdmin(profile, res)) return;
      const { data, error } = await supabase.from('profiles').select('*')
        .eq('store_id', SID).order('created_at');
      if (error) throw error;
      return res.json({ success: true, users: data });
    }

    if (action === 'addUser') {
      if (!requireAdmin(profile, res)) return;
      const { email, password, username, full_name, role } = req.body;
      if (!email || !password || !username || !full_name)
        return res.status(400).json({ success: false, error: 'Missing fields' });
      // Staff and admin only — never allow creating another owner
      const safeRole = role === 'admin' ? 'admin' : 'staff';

      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (authErr) return res.status(400).json({ success: false, error: authErr.message });

      const { error: profErr } = await supabase.from('profiles').insert({
        id: authData.user.id, store_id: SID, username, full_name, role: safeRole
      });
      if (profErr) throw profErr;
      return res.json({ success: true, id: authData.user.id });
    }

    if (action === 'updateUser') {
      if (!requireAdmin(profile, res)) return;
      const { id, full_name, role, password } = req.body;
      // Verify target belongs to the same store
      const { data: target } = await supabase.from('profiles').select('store_id, role')
        .eq('id', id).single();
      if (!target || target.store_id !== SID)
        return res.status(404).json({ success: false, error: 'User not found' });
      if (target.role === 'owner' && profile.role !== 'owner')
        return res.status(403).json({ success: false, error: 'Cannot modify store owner' });

      const safeRole = role === 'admin' ? 'admin' : role === 'owner' ? target.role : 'staff';
      const { error } = await supabase.from('profiles').update({ full_name, role: safeRole }).eq('id', id);
      if (error) throw error;
      if (password) await supabase.auth.admin.updateUserById(id, { password });
      return res.json({ success: true });
    }

    if (action === 'deleteUser') {
      if (!requireAdmin(profile, res)) return;
      const { id } = req.body;
      const { data: target } = await supabase.from('profiles').select('store_id, role').eq('id', id).single();
      if (!target || target.store_id !== SID)
        return res.status(404).json({ success: false, error: 'User not found' });
      if (target.role === 'owner')
        return res.status(403).json({ success: false, error: 'Cannot deactivate store owner' });
      const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
