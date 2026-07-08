const { supabase, requireAuth, requireAdmin, can, requirePerm, setCors } = require('./_lib');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;
  const SID = profile.store_id;

  const { action } = req.body || {};

  try {
    if (action === 'getCategories') {
      const { data, error } = await supabase.from('categories').select('*').eq('store_id', SID).order('name');
      if (error) throw error;
      return res.json({ success: true, categories: data });
    }
    if (action === 'addCategory') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Name required' });
      const { data, error } = await supabase.from('categories').insert({ store_id: SID, name }).select().single();
      if (error) throw error;
      return res.json({ success: true, id: data.id });
    }
    if (action === 'deleteCategory') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { error } = await supabase.from('categories').delete().eq('id', req.body.id).eq('store_id', SID);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === 'getProducts') {
      const { data, error } = await supabase
        .from('products').select('*, categories(name)').eq('store_id', SID).eq('active', true).order('name');
      if (error) throw error;
      return res.json({ success: true, products: data });
    }
    if (action === 'addProduct') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { sku, name, category_id, cost_price, selling_price, stock, unit, low_stock_alert, barcode } = req.body;
      if (!name || !selling_price) return res.status(400).json({ success: false, error: 'Name and price required' });
      const { data, error } = await supabase.from('products').insert({
        store_id: SID,
        sku: sku || null, name, category_id: category_id || null,
        cost_price: Number(cost_price) || 0, selling_price: Number(selling_price),
        stock: Number(stock) || 0, unit: unit || 'pcs',
        low_stock_alert: Number(low_stock_alert) || 5, barcode: barcode || null
      }).select().single();
      if (error) throw error;
      if (Number(stock) > 0) {
        await supabase.from('inventory_log').insert({
          store_id: SID, product_id: data.id, product_name: name, type: 'INITIAL',
          qty: Number(stock), prev_stock: 0, reason: 'Initial stock', created_by: profile.username
        });
      }
      return res.json({ success: true, id: data.id });
    }
    if (action === 'updateProduct') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { id, sku, name, category_id, cost_price, selling_price, unit, low_stock_alert, barcode } = req.body;
      const { error } = await supabase.from('products').update({
        sku: sku || null, name, category_id: category_id || null,
        cost_price: Number(cost_price) || 0, selling_price: Number(selling_price),
        unit: unit || 'pcs', low_stock_alert: Number(low_stock_alert) || 5, barcode: barcode || null
      }).eq('id', id).eq('store_id', SID);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === 'deleteProduct') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { error } = await supabase.from('products').update({ active: false }).eq('id', req.body.id).eq('store_id', SID);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === 'adjustStock') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { productId, adjustment, reason } = req.body;
      if (!productId || adjustment === undefined)
        return res.status(400).json({ success: false, error: 'Missing fields' });
      const { data: product, error: fetchErr } = await supabase
        .from('products').select('stock, name').eq('id', productId).eq('store_id', SID).single();
      if (fetchErr) throw fetchErr;
      const newStock = product.stock + Number(adjustment);
      if (newStock < 0) return res.status(400).json({ success: false, error: 'Stock cannot go below 0' });
      await supabase.from('products').update({ stock: newStock }).eq('id', productId).eq('store_id', SID);
      await supabase.from('inventory_log').insert({
        store_id: SID, product_id: productId, product_name: product.name,
        type: Number(adjustment) > 0 ? 'ADD' : 'REMOVE',
        qty: Number(adjustment), prev_stock: product.stock,
        reason: reason || 'Manual adjustment', created_by: profile.username
      });
      return res.json({ success: true, newStock });
    }
    if (action === 'getInventoryLog') {
      if (!requirePerm(profile, 'inventory_view', res)) return;
      const { productId, from, to } = req.body;
      let query = supabase.from('inventory_log').select('*').eq('store_id', SID)
        .order('created_at', { ascending: false }).limit(500);
      if (productId) query = query.eq('product_id', productId);
      if (from) query = query.gte('created_at', from);
      if (to)   query = query.lte('created_at', to);
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ success: true, logs: data });
    }
    if (action === 'getTemplates') {
      const { templates } = require('./_templates');
      return res.json({ success: true, templates: templates.map(t => ({
        id: t.id, name: t.name, description: t.description,
        categoryCount: t.categories.length,
        productCount: t.categories.reduce((s, c) => s + c.products.length, 0)
      }))});
    }
    if (action === 'importTemplate') {
      if (!requirePerm(profile, 'products_manage', res)) return;
      const { templateId, defaultStock } = req.body;
      const { templates } = require('./_templates');
      const template = templates.find(t => t.id === templateId);
      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

      let imported = 0, skipped = 0;
      for (const cat of template.categories) {
        // Find or create category
        let { data: existing } = await supabase.from('categories')
          .select('id').eq('store_id', SID).eq('name', cat.name).maybeSingle();
        let catId = existing?.id;
        if (!catId) {
          const { data: newCat, error: catErr } = await supabase.from('categories')
            .insert({ store_id: SID, name: cat.name }).select().single();
          if (catErr) continue;
          catId = newCat.id;
        }
        for (const p of cat.products) {
          // Skip if a product with the same name already exists
          const { data: dupe } = await supabase.from('products')
            .select('id').eq('store_id', SID).eq('name', p.name).maybeSingle();
          if (dupe) { skipped++; continue; }
          const stock = Number(defaultStock) || 20;
          const { data: prod, error: prodErr } = await supabase.from('products').insert({
            store_id: SID, name: p.name, category_id: catId,
            cost_price: p.cost, selling_price: p.price,
            stock, unit: p.unit || 'pcs', low_stock_alert: 5
          }).select().single();
          if (prodErr) { skipped++; continue; }
          imported++;
          if (stock > 0) {
            await supabase.from('inventory_log').insert({
              store_id: SID, product_id: prod.id, product_name: p.name,
              type: 'INITIAL', qty: stock, prev_stock: 0,
              reason: 'Starter pack import', created_by: profile.username
            });
          }
        }
      }
      return res.json({ success: true, imported, skipped });
    }
    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
