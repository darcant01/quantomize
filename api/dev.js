// api/dev.js — Platform Developer Hub (protected by DEV_KEY env var)
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

  // ── Developer authentication ────────────────────────────────
  const devKey = req.headers.authorization?.replace('Bearer ', '');
  if (!process.env.DEV_KEY) {
    return res.status(500).json({ success: false, error: 'DEV_KEY not configured in environment variables' });
  }
  if (devKey !== process.env.DEV_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid developer key' });
  }

  const { action } = req.body || {};

  try {
    if (action === 'overview') {
      const [{ count: storeCount }, { count: userCount }, { count: saleCount }, { data: sales }] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total').neq('status', 'voided'),
      ]);
      const totalGMV = (sales || []).reduce((s, x) => s + Number(x.total), 0);
      const { data: recentStores } = await supabase.from('stores')
        .select('*').order('created_at', { ascending: false }).limit(5);
      return res.json({ success: true, overview: {
        storeCount: storeCount || 0, userCount: userCount || 0,
        saleCount: saleCount || 0, totalGMV, recentStores: recentStores || []
      }});
    }

    if (action === 'getStores') {
      const { data: stores, error } = await supabase.from('stores')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = [];
      for (const store of stores || []) {
        const [{ count: users }, { count: products }, { data: sales }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
          supabase.from('sales').select('total').eq('store_id', store.id).neq('status', 'voided'),
        ]);
        enriched.push({
          ...store,
          userCount: users || 0, productCount: products || 0,
          saleCount: (sales || []).length,
          revenue: (sales || []).reduce((s, x) => s + Number(x.total), 0),
        });
      }
      return res.json({ success: true, stores: enriched });
    }

    if (action === 'getStoreDetail') {
      const { storeId } = req.body;
      const [{ data: store }, { data: users }, { data: settings }] = await Promise.all([
        supabase.from('stores').select('*').eq('id', storeId).single(),
        supabase.from('profiles').select('*').eq('store_id', storeId).order('created_at'),
        supabase.from('settings').select('*').eq('store_id', storeId),
      ]);
      const usersWithEmail = [];
      for (const u of users || []) {
        const { data: authUser } = await supabase.auth.admin.getUserById(u.id);
        usersWithEmail.push({ ...u, email: authUser?.user?.email || '—' });
      }
      const settingsMap = {};
      for (const s of settings || []) settingsMap[s.key] = s.value;
      return res.json({ success: true, store, users: usersWithEmail, settings: settingsMap });
    }

    if (action === 'updateStore') {
      const { storeId, name, plan, active, trial_ends } = req.body;
      const updates = {};
      if (name !== undefined)       updates.name = name;
      if (plan !== undefined)       updates.plan = plan;
      if (active !== undefined)     updates.active = active;
      if (trial_ends !== undefined) updates.trial_ends = trial_ends;
      const { error } = await supabase.from('stores').update(updates).eq('id', storeId);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (action === 'extendTrial') {
      const { storeId, days } = req.body;
      const { data: store } = await supabase.from('stores').select('trial_ends').eq('id', storeId).single();
      const base = store?.trial_ends && new Date(store.trial_ends) > new Date()
        ? new Date(store.trial_ends) : new Date();
      base.setDate(base.getDate() + Number(days || 14));
      const { error } = await supabase.from('stores').update({ trial_ends: base.toISOString() }).eq('id', storeId);
      if (error) throw error;
      return res.json({ success: true, newTrialEnd: base.toISOString() });
    }

    if (action === 'deleteStore') {
      const { storeId } = req.body;
      const { data: users } = await supabase.from('profiles').select('id').eq('store_id', storeId);
      for (const u of users || []) {
        await supabase.auth.admin.deleteUser(u.id).catch(() => {});
      }
      const { error } = await supabase.from('stores').delete().eq('id', storeId);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (action === 'updateUser') {
      const { userId, full_name, role, active, password } = req.body;
      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined)      updates.role = role;
      if (active !== undefined)    updates.active = active;
      if (Object.keys(updates).length) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) throw error;
      }
      if (password) {
        const { error } = await supabase.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
      }
      return res.json({ success: true });
    }

    if (action === 'deleteUser') {
      const { userId } = req.body;
      await supabase.auth.admin.deleteUser(userId);
      return res.json({ success: true });
    }

    if (action === 'updateStoreSettings') {
      const { storeId, settings } = req.body;
      for (const [key, value] of Object.entries(settings || {})) {
        await supabase.from('settings').upsert(
          { store_id: storeId, key, value },
          { onConflict: 'store_id,key' }
        );
      }
      return res.json({ success: true });
    }

    if (action === 'diagnostics') {
      const checks = {};
      const tables = ['stores', 'profiles', 'categories', 'products', 'sales', 'sale_items', 'inventory_log', 'settings'];
      for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        checks[t] = error ? `ERROR: ${error.message}` : `OK (${count} rows)`;
      }
      const { data: orphans } = await supabase.from('profiles').select('id, username').is('store_id', null);
      checks.orphan_profiles = orphans?.length ? `${orphans.length} profiles without a store` : 'None';
      return res.json({ success: true, checks });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
