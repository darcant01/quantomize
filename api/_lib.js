const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Permission system ─────────────────────────────────────────
// Keys: dashboard, pos, products_view, products_manage, stock_log,
//       sales_view_all, sales_void, reports, users_manage, settings_manage
const ALL_TRUE = {
  dashboard: true, pos: true, products_view: true, products_manage: true,
  stock_log: true, sales_view_all: true, sales_void: true, reports: true,
  users_manage: true, settings_manage: true
};
const ROLE_DEFAULTS = {
  owner: { ...ALL_TRUE },
  admin: { ...ALL_TRUE },
  staff: {
    dashboard: false, pos: true, products_view: true, products_manage: false,
    stock_log: false, sales_view_all: false, sales_void: false, reports: false,
    users_manage: false, settings_manage: false
  }
};

function effectivePerms(profile) {
  if (profile.role === 'owner') return { ...ALL_TRUE }; // owner always has everything
  const base = { ...(ROLE_DEFAULTS[profile.role] || ROLE_DEFAULTS.staff) };
  if (profile.permissions && typeof profile.permissions === 'object') {
    for (const [k, v] of Object.entries(profile.permissions)) {
      if (k in base) base[k] = !!v;
    }
  }
  return base;
}

function can(profile, perm) {
  return !!effectivePerms(profile)[perm];
}

function requirePerm(profile, perm, res) {
  if (!can(profile, perm)) {
    res.status(403).json({ success: false, error: 'You do not have access to this feature' });
    return false;
  }
  return true;
}

async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, error: 'Unauthorized' }); return null; }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return null; }

  const { data: profile } = await supabase
    .from('profiles').select('*, stores(name, plan, active)').eq('id', user.id).single();

  if (!profile?.active) { res.status(403).json({ success: false, error: 'Account disabled' }); return null; }
  if (!profile.stores?.active) { res.status(403).json({ success: false, error: 'Store suspended' }); return null; }
  if (!profile.store_id) { res.status(403).json({ success: false, error: 'No store assigned' }); return null; }

  return profile;
}

function requireAdmin(profile, res) {
  if (profile.role !== 'admin' && profile.role !== 'owner') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return false;
  }
  return true;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { supabase, requireAuth, requireAdmin, requirePerm, can, effectivePerms, setCors };
