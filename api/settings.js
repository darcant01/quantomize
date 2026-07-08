const { supabase, requireAuth, requireAdmin, setCors } = require('./_lib');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.body || {};

  try {
    if (action === 'getSettings') {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settings = {};
      for (const row of data) settings[row.key] = row.value;
      return res.json({ success: true, settings });
    }

    const profile = await requireAuth(req, res);
    if (!profile) return;

    if (action === 'saveSettings') {
      if (!requireAdmin(profile, res)) return;
      const { settings } = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
