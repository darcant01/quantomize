const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, token, storeName, fullName } = req.body;

  try {
    // ── SIGNUP: create store + owner account ──────────────────
    if (action === 'signup') {
      if (!email || !password || !storeName || !fullName)
        return res.status(400).json({ success: false, error: 'All fields are required' });
      if (password.length < 8)
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });

      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (authErr) return res.status(400).json({ success: false, error: authErr.message });

      // 2. Create store
      const { data: store, error: storeErr } = await supabase.from('stores')
        .insert({ name: storeName }).select().single();
      if (storeErr) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw storeErr;
      }

      // 3. Create owner profile
      const { error: profErr } = await supabase.from('profiles').insert({
        id: authData.user.id, store_id: store.id,
        username: email.split('@')[0], full_name: fullName, role: 'owner'
      });
      if (profErr) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        await supabase.from('stores').delete().eq('id', store.id);
        throw profErr;
      }

      // 4. Seed default settings + categories for the store
      await supabase.from('settings').insert([
        { store_id: store.id, key: 'store_name',      value: storeName },
        { store_id: store.id, key: 'currency_symbol', value: '₱' },
        { store_id: store.id, key: 'receipt_prefix',  value: 'RCP' },
        { store_id: store.id, key: 'receipt_counter', value: '1' },
        { store_id: store.id, key: 'tax_rate',        value: '0' },
      ]);
      await supabase.from('categories').insert([
        { store_id: store.id, name: 'General' },
      ]);

      // 5. Sign them in
      const { data: session } = await supabase.auth.signInWithPassword({ email, password });
      return res.json({
        success: true,
        token: session.session.access_token,
        role: 'owner',
        name: fullName,
        username: email.split('@')[0],
        userId: authData.user.id,
        storeId: store.id,
        storeName,
      });
    }

    // ── LOGIN ──────────────────────────────────────────────────
    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ success: false, error: 'Invalid email or password' });

      const { data: profile } = await supabase
        .from('profiles').select('*, stores(name, plan, active, trial_ends)').eq('id', data.user.id).single();

      if (!profile) return res.status(403).json({ success: false, error: 'No profile found. Please sign up first.' });
      if (!profile.active) return res.status(403).json({ success: false, error: 'Account disabled' });
      if (!profile.stores?.active) return res.status(403).json({ success: false, error: 'Store suspended' });

      return res.json({
        success: true,
        token: data.session.access_token,
        role: profile.role,
        name: profile.full_name,
        username: profile.username,
        userId: data.user.id,
        storeId: profile.store_id,
        storeName: profile.stores?.name,
        plan: profile.stores?.plan,
      });
    }

    // ── ME ─────────────────────────────────────────────────────
    if (action === 'me') {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const { data: profile } = await supabase
        .from('profiles').select('*, stores(name, plan)').eq('id', user.id).single();
      return res.json({ success: true, user: { ...profile, email: user.email } });
    }

    if (action === 'logout') return res.json({ success: true });

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
