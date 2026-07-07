// api/settings.js — Store settings
import { supabase, requireAuth, requireAdmin, setCors } from './_middleware.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;

  const { action } = req.body || req.query;

  try {
    if (action === 'getSettings') {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settings = {};
      for (const row of data) settings[row.key] = row.value;
      return res.json({ success: true, settings });
    }

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
}
