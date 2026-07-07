const { supabase, requireAuth, requireAdmin, setCors } = require('./_middleware');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const profile = await requireAuth(req, res);
  if (!profile) return;

  const { action } = req.body || {};

  try {
    if (action === 'createSale') {
      const { items, discount, paymentMethod, customerName, notes } = req.body;
      if (!items?.length) return res.status(400).json({ success: false, error: 'No items' });

      for (const item of items) {
        const { data: product } = await supabase.from('products').select('stock, name').eq('id', item.productId).single();
        if (!product) return res.status(400).json({ success: false, error: 'Product not found' });
        if (product.stock < item.qty) return res.status(400).json({ success: false, error: `Insufficient stock for: ${product.name}` });
      }

      const { data: receiptData } = await supabase.rpc('next_receipt_no');
      const receiptNo = receiptData;
      const subtotal    = items.reduce((s, i) => s + (i.price * i.qty), 0);
      const discountAmt = Number(discount) || 0;
      const total       = subtotal - discountAmt;

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        receipt_no: receiptNo, user_id: profile.id, username: profile.username,
        subtotal, discount: discountAmt, tax: 0, total,
        payment_method: paymentMethod || 'cash',
        customer_name: customerName || null, notes: notes || null, status: 'completed'
      }).select().single();
      if (saleErr) throw saleErr;

      for (const item of items) {
        const { data: product } = await supabase.from('products').select('name, cost_price, stock').eq('id', item.productId).single();
        await supabase.from('sale_items').insert({
          sale_id: sale.id, product_id: item.productId, product_name: product.name,
          qty: item.qty, price: item.price, cost: product.cost_price, line_total: item.price * item.qty
        });
        await supabase.from('products').update({ stock: product.stock - item.qty }).eq('id', item.productId);
        await supabase.from('inventory_log').insert({
          product_id: item.productId, product_name: product.name,
          type: 'SALE', qty: -item.qty, prev_stock: product.stock,
          reason: `Sale ${receiptNo}`, created_by: profile.username
        });
      }
      return res.json({ success: true, saleId: sale.id, receiptNo, total });
    }

    if (action === 'getSales') {
      const { from, to } = req.body;
      let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
      if (profile.role !== 'admin') query = query.eq('user_id', profile.id);
      if (from) query = query.gte('created_at', from);
      if (to)   query = query.lte('created_at', to);
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ success: true, sales: data });
    }

    if (action === 'getSaleDetail') {
      const { saleId } = req.body;
      const { data: sale, error } = await supabase
        .from('sales').select('*, sale_items(*)').eq('id', saleId).single();
      if (error) throw error;
      return res.json({ success: true, sale });
    }

    if (action === 'voidSale') {
      if (!requireAdmin(profile, res)) return;
      const { saleId } = req.body;
      const { data: sale } = await supabase.from('sales').select('*, sale_items(*)').eq('id', saleId).single();
      if (sale.status === 'voided') return res.status(400).json({ success: false, error: 'Already voided' });
      await supabase.from('sales').update({ status: 'voided' }).eq('id', saleId);
      for (const item of sale.sale_items) {
        const { data: product } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        await supabase.from('products').update({ stock: (product?.stock || 0) + item.qty }).eq('id', item.product_id);
        await supabase.from('inventory_log').insert({
          product_id: item.product_id, product_name: item.product_name,
          type: 'VOID', qty: item.qty, prev_stock: product?.stock || 0,
          reason: `Void of sale ${sale.receipt_no}`, created_by: profile.username
        });
      }
      return res.json({ success: true });
    }

    if (action === 'getReports') {
      if (!requireAdmin(profile, res)) return;
      const { type, from, to } = req.body;
      const fromD = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const toD   = to   || new Date().toISOString();

      if (type === 'summary') {
        const { data: sales } = await supabase.from('sales')
          .select('*, sale_items(qty, price, cost, line_total)')
          .neq('status', 'voided').gte('created_at', fromD).lte('created_at', toD);
        let totalRevenue = 0, totalDiscount = 0, cogs = 0;
        const dailyMap = {};
        for (const sale of sales || []) {
          totalRevenue  += Number(sale.total);
          totalDiscount += Number(sale.discount);
          for (const item of sale.sale_items || []) cogs += Number(item.cost) * Number(item.qty);
          const day = sale.created_at.split('T')[0];
          dailyMap[day] = (dailyMap[day] || 0) + Number(sale.total);
        }
        const daily = Object.keys(dailyMap).sort().map(d => ({ date: d, revenue: dailyMap[d] }));
        const totalOrders = sales?.length || 0;
        const { data: lowStock } = await supabase.from('products')
          .select('id, name, stock, low_stock_alert').eq('active', true);
        return res.json({ success: true, summary: {
          totalRevenue, grossProfit: totalRevenue - cogs, totalDiscount, totalOrders, cogs,
          avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
          daily, lowStock: (lowStock || []).filter(p => p.stock <= p.low_stock_alert)
        }});
      }

      if (type === 'products') {
        const { data: sales } = await supabase.from('sales').select('id').neq('status','voided').gte('created_at',fromD).lte('created_at',toD);
        const saleIds = (sales||[]).map(s=>s.id);
        if (!saleIds.length) return res.json({ success: true, products: [] });
        const { data: items } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
        const prodMap = {};
        for (const item of items||[]) {
          if (!prodMap[item.product_id]) prodMap[item.product_id] = { name: item.product_name, qty: 0, revenue: 0, profit: 0 };
          prodMap[item.product_id].qty     += Number(item.qty);
          prodMap[item.product_id].revenue += Number(item.line_total);
          prodMap[item.product_id].profit  += (Number(item.price) - Number(item.cost)) * Number(item.qty);
        }
        return res.json({ success: true, products: Object.entries(prodMap).map(([id,v])=>({productId:id,...v})).sort((a,b)=>b.revenue-a.revenue) });
      }

      if (type === 'staff') {
        const { data: sales } = await supabase.from('sales').select('user_id, username, total').neq('status','voided').gte('created_at',fromD).lte('created_at',toD);
        const staffMap = {};
        for (const sale of sales||[]) {
          if (!staffMap[sale.user_id]) staffMap[sale.user_id] = { userId: sale.user_id, username: sale.username, sales: 0, revenue: 0 };
          staffMap[sale.user_id].sales++;
          staffMap[sale.user_id].revenue += Number(sale.total);
        }
        return res.json({ success: true, staff: Object.values(staffMap).sort((a,b)=>b.revenue-a.revenue) });
      }
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
