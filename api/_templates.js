// api/_templates.js — Product starter packs
// Prices in ₱ (typical sari-sari retail as of 2026, adjust anytime after import)

const sariSari = {
  id: 'sari-sari',
  name: 'Sari-Sari Store Starter Pack',
  description: 'Classic Filipino sari-sari store products — drinks, snacks, canned goods, noodles, condiments, personal care, and household items.',
  categories: [
    {
      name: 'Beverages',
      products: [
        { name: 'Coke Mismo 300ml',            cost: 10,   price: 15,  unit: 'pcs' },
        { name: 'Coke 1L',                     cost: 32,   price: 40,  unit: 'pcs' },
        { name: 'Sprite Mismo 300ml',          cost: 10,   price: 15,  unit: 'pcs' },
        { name: 'Royal Mismo 300ml',           cost: 10,   price: 15,  unit: 'pcs' },
        { name: 'C2 Solo Apple 230ml',         cost: 15,   price: 20,  unit: 'pcs' },
        { name: 'Zesto Orange 200ml',          cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'Sting Energy Drink 240ml',    cost: 16,   price: 22,  unit: 'pcs' },
        { name: 'Cobra Energy Drink 350ml',    cost: 18,   price: 25,  unit: 'pcs' },
        { name: 'Mineral Water 500ml',         cost: 8,    price: 15,  unit: 'pcs' },
        { name: 'Kopiko Blanca Twin Pack',     cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'Nescafe 3-in-1 Original',     cost: 6.5,  price: 9,   unit: 'sachet' },
        { name: 'Milo 22g Sachet',             cost: 10,   price: 13,  unit: 'sachet' },
        { name: 'Bear Brand Powder 33g',       cost: 11,   price: 14,  unit: 'sachet' },
        { name: 'Energen Chocolate 40g',       cost: 7,    price: 10,  unit: 'sachet' },
      ]
    },
    {
      name: 'Snacks & Candies',
      products: [
        { name: 'Piattos Cheese 40g',          cost: 14,   price: 18,  unit: 'pcs' },
        { name: 'Nova Multigrain 40g',         cost: 14,   price: 18,  unit: 'pcs' },
        { name: 'Chippy BBQ 27g',              cost: 7,    price: 10,  unit: 'pcs' },
        { name: 'Clover Chips 26g',            cost: 7,    price: 10,  unit: 'pcs' },
        { name: 'V-Cut Spicy BBQ 25g',         cost: 7,    price: 10,  unit: 'pcs' },
        { name: 'Boy Bawang Cornick 40g',      cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'SkyFlakes Crackers 25g',      cost: 6,    price: 8,   unit: 'pcs' },
        { name: 'Fita Crackers 30g',           cost: 6,    price: 8,   unit: 'pcs' },
        { name: 'Rebisco Sandwich Cracker',    cost: 6,    price: 8,   unit: 'pcs' },
        { name: 'Hansel Mocha Sandwich',       cost: 6.5,  price: 9,   unit: 'pcs' },
        { name: 'Cream-O Vanilla',             cost: 6.5,  price: 9,   unit: 'pcs' },
        { name: 'Choc Nut',                    cost: 1.5,  price: 2,   unit: 'pcs' },
        { name: 'Flat Tops',                   cost: 1.5,  price: 2,   unit: 'pcs' },
        { name: 'Mentos Mint',                 cost: 0.8,  price: 1,   unit: 'pcs' },
        { name: 'White Rabbit Candy',          cost: 0.8,  price: 1,   unit: 'pcs' },
        { name: 'Maxx Menthol Candy',          cost: 0.8,  price: 1,   unit: 'pcs' },
      ]
    },
    {
      name: 'Instant Noodles',
      products: [
        { name: 'Lucky Me Pancit Canton Original', cost: 12, price: 15, unit: 'pcs' },
        { name: 'Lucky Me Pancit Canton Chilimansi', cost: 12, price: 15, unit: 'pcs' },
        { name: 'Lucky Me Beef Mami 55g',      cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'Lucky Me Chicken Mami 55g',   cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'Payless Pancit Canton',       cost: 6,    price: 8,   unit: 'pcs' },
        { name: 'Nissin Cup Noodles Seafood',  cost: 20,   price: 27,  unit: 'pcs' },
      ]
    },
    {
      name: 'Canned Goods',
      products: [
        { name: '555 Sardines Red 155g',       cost: 18,   price: 23,  unit: 'can' },
        { name: 'Ligo Sardines Red 155g',      cost: 21,   price: 26,  unit: 'can' },
        { name: 'Century Tuna Flakes 155g',    cost: 24,   price: 30,  unit: 'can' },
        { name: 'Purefoods Corned Beef 150g',  cost: 28,   price: 35,  unit: 'can' },
        { name: 'Argentina Corned Beef 150g',  cost: 22,   price: 28,  unit: 'can' },
        { name: 'Argentina Meat Loaf 150g',    cost: 16,   price: 20,  unit: 'can' },
        { name: 'CDO Vienna Sausage 114g',     cost: 26,   price: 33,  unit: 'can' },
      ]
    },
    {
      name: 'Condiments & Cooking',
      products: [
        { name: 'Silver Swan Soy Sauce 200ml', cost: 9,    price: 13,  unit: 'pcs' },
        { name: 'Datu Puti Vinegar 200ml',     cost: 9,    price: 13,  unit: 'pcs' },
        { name: 'Patis Fish Sauce 200ml',      cost: 12,   price: 16,  unit: 'pcs' },
        { name: 'Magic Sarap 8g',              cost: 4.5,  price: 6,   unit: 'sachet' },
        { name: 'Knorr Beef Cube',             cost: 4.5,  price: 6,   unit: 'pcs' },
        { name: 'UFC Banana Ketchup 100g',     cost: 11,   price: 15,  unit: 'pcs' },
        { name: 'Mang Tomas Sarsa 100g',       cost: 14,   price: 18,  unit: 'pcs' },
        { name: 'Cooking Oil Sachet 40ml',     cost: 10,   price: 14,  unit: 'sachet' },
        { name: 'Rice (per kilo)',             cost: 45,   price: 52,  unit: 'kg' },
        { name: 'Sugar (per 1/4 kilo)',        cost: 15,   price: 19,  unit: 'pack' },
        { name: 'Salt (per pack)',             cost: 7,    price: 10,  unit: 'pack' },
        { name: 'Egg (per piece)',             cost: 7.5,  price: 9,   unit: 'pcs' },
      ]
    },
    {
      name: 'Personal Care',
      products: [
        { name: 'Safeguard Soap 55g',          cost: 22,   price: 28,  unit: 'pcs' },
        { name: 'Palmolive Shampoo Sachet',    cost: 6,    price: 8,   unit: 'sachet' },
        { name: 'Head & Shoulders Sachet',     cost: 7,    price: 9,   unit: 'sachet' },
        { name: 'Cream Silk Sachet',           cost: 7,    price: 9,   unit: 'sachet' },
        { name: 'Colgate Toothpaste Sachet',   cost: 9,    price: 12,  unit: 'sachet' },
        { name: 'Modess Napkin (per piece)',   cost: 8,    price: 10,  unit: 'pcs' },
      ]
    },
    {
      name: 'Household',
      products: [
        { name: 'Tide Powder Sachet 57g',      cost: 9,    price: 12,  unit: 'sachet' },
        { name: 'Surf Powder Sachet 65g',      cost: 11,   price: 14,  unit: 'sachet' },
        { name: 'Downy Sachet 25ml',           cost: 7.5,  price: 10,  unit: 'sachet' },
        { name: 'Joy Dishwashing Sachet 20ml', cost: 9,    price: 12,  unit: 'sachet' },
        { name: 'Zonrox Bleach 100ml',         cost: 9,    price: 12,  unit: 'pcs' },
        { name: 'Candle (per piece)',          cost: 7,    price: 10,  unit: 'pcs' },
        { name: 'Matches (per box)',           cost: 3,    price: 5,   unit: 'box' },
      ]
    },
  ]
};

module.exports = { templates: [sariSari] };
