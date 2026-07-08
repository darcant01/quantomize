const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Verify the caller is a superadmin
async function requireSuperadmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, error: 'Unauthorized' }); return null; }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return null; }

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  if (!profile?.superadmin) {
    res.status(403).json({ success: false, error: 'Developer access only' });
    return null;
  }
  return profile;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dev = await requireSuperadmin(req, res);
  if (!dev) return;

  const { action } = req.body || {};

  try {
    // ── Platform stats ─────────────────────────────────────────
    if (action === 'getStats') {
      const [{ count: storeCount }, { count: userCount }, { count: saleCount }, { data: salesData }] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total').neq('status', 'voided'),
      ]);
      const totalRevenue = (salesData || []).reduce((s, r) => s + Number(r.total), 0);
      const { data: planData } = await supabase.from('stores').select('plan');
      const plans = { free: 0, pro: 0, enterprise: 0 };
      for (const s of planData || []) plans[s.plan] = (plans[s.plan] || 0) + 1;
      return res.json({ success: true, stats: { storeCount, userCount, saleCount, totalRevenue, plans } });
    }

    // ── Stores ─────────────────────────────────────────────────
    if (action === 'getStores') {
      const { data: stores, error } = await supabase.from('stores')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;

      // Attach owner + counts
      const result = [];
      for (const store of stores) {
        const [{ data: owner }, { count: userCount }, { count: productCount }, { count: saleCount }] = await Promise.all([
          supabase.from('profiles').select('full_name, username, id').eq('store_id', store.id).eq('role', 'owner').maybeSingle(),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
          supabase.from('sales').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
        ]);
        result.push({ ...store, owner, userCount, productCount, saleCount });
      }
      return res.json({ success: true, stores: result });
    }

    if (action === 'updateStore') {
      const { id, plan, active, trial_ends, name } = req.body;
      const update = {};
      if (plan !== undefined)       update.plan = plan;
      if (active !== undefined)     update.active = active;
      if (trial_ends !== undefined) update.trial_ends = trial_ends;
      if (name !== undefined)       update.name = name;
      const { error } = await supabase.from('stores').update(update).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (action === 'deleteStore') {
      const { id } = req.body;
      // Get all user ids of the store to remove auth users too
      const { data: users } = await supabase.from('profiles').select('id').eq('store_id', id);
      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (error) throw error;
      // Clean up auth users
      for (const u of users || []) {
        try { await supabase.auth.admin.deleteUser(u.id); } catch (e) {}
      }
      return res.json({ success: true });
    }

    // ── Users ──────────────────────────────────────────────────
    if (action === 'getUsers') {
      const { storeId } = req.body;
      let query = supabase.from('profiles').select('*, stores(name)').order('created_at', { ascending: false });
      if (storeId) query = query.eq('store_id', storeId);
      const { data, error } = await query;
      if (error) throw error;
      // Attach emails
      const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const emailMap = {};
      for (const u of authList?.users || []) emailMap[u.id] = u.email;
      return res.json({ success: true, users: data.map(u => ({ ...u, email: emailMap[u.id] || '' })) });
    }

    if (action === 'toggleUser') {
      const { id, active } = req.body;
      const { error } = await supabase.from('profiles').update({ active }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (action === 'resetPassword') {
      const { id, password } = req.body;
      if (!password || password.length < 8)
        return res.status(400).json({ success: false, error: 'Password min 8 characters' });
      const { error } = await supabase.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      return res.json({ success: true });
    }

    if (action === 'setSuperadmin') {
      const { id, superadmin } = req.body;
      const { error } = await supabase.from('profiles').update({ superadmin }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    // ── Recent sales across the platform ───────────────────────
    if (action === 'getRecentSales') {
      const { data, error } = await supabase.from('sales')
        .select('*, stores(name)')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return res.json({ success: true, sales: data });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
