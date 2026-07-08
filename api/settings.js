const { supabase, requireAuth, requireAdmin, setCors } = require('./_lib');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;
  const SID = profile.store_id;

  const { action } = req.body || {};

  try {
    if (action === 'getSettings') {
      const { data, error } = await supabase.from('settings').select('*').eq('store_id', SID);
      if (error) throw error;
      const settings = {};
      for (const row of data) settings[row.key] = row.value;
      // include plan info
      settings._plan = profile.stores?.plan || 'free';
      settings._storeName = profile.stores?.name || '';
      return res.json({ success: true, settings });
    }

    if (action === 'saveSettings') {
      if (!requireAdmin(profile, res)) return;
      const { settings } = req.body;
      for (const [key, value] of Object.entries(settings)) {
        if (key.startsWith('_')) continue;
        await supabase.from('settings').upsert(
          { store_id: SID, key, value },
          { onConflict: 'store_id,key' }
        );
      }
      // If store_name changed, also update stores table
      if (settings.store_name) {
        await supabase.from('stores').update({ name: settings.store_name }).eq('id', SID);
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
