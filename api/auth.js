// api/auth.js — Login, logout, me
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, token } = req.body;

  try {
    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ success: false, error: 'Invalid email or password' });

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single();

      if (!profile?.active) return res.status(403).json({ success: false, error: 'Account disabled' });

      return res.json({
        success: true,
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        role: profile.role,
        name: profile.full_name,
        username: profile.username,
        userId: data.user.id,
      });
    }

    if (action === 'me') {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return res.json({ success: true, user: { ...profile, email: user.email } });
    }

    if (action === 'logout') {
      await supabase.auth.signOut();
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
