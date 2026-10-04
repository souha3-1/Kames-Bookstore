import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { WILAYAS } from './algeria.ts';
import { cartSubtotal, deliveryFeeFor, formatDzd, HOME_DELIVERY_FEE, isLowStock, ORDER_STATUSES, placeholderCoverTint, STOPDESK_DELIVERY_FEE } from './domain.ts';
import type { CartLine, Product } from './supabase.ts';

const product = (id: string, price: number): Product => ({
  id,
  title: id,
  author: 'Some Author',
  price,
  category: 'Fiction',
  description: '',
  featured: false,
  pages: 200,
  format: 'paperback',
});

const book = (active: boolean, stock: number) => ({ active, stock });

describe('formatDzd', () => {
  test('formats zero as "0 DA"', () => {
    assert.equal(formatDzd(0), '0 DA');
  });

  test('keeps all digits and ends with the DA suffix', () => {
    const formatted = formatDzd(1200);
    assert.equal(formatted.replace(/[^\d]/g, ''), '1200');
    assert.ok(formatted.endsWith(' DA'));
  });
});

describe('delivery fees', () => {
  test('home delivery is 600 DA', () => {
    assert.equal(HOME_DELIVERY_FEE, 600);
    assert.equal(deliveryFeeFor('home'), 600);
  });

  test('stop desk is 400 DA', () => {
    assert.equal(STOPDESK_DELIVERY_FEE, 400);
    assert.equal(deliveryFeeFor('stopdesk'), 400);
  });
});

describe('cartSubtotal', () => {
  test('empty cart is zero', () => {
    assert.equal(cartSubtotal([], []), 0);
  });

  test('multiplies price by quantity across lines', () => {
    const products = [product('a', 1500), product('b', 800)];
    const cart: CartLine[] = [
      { id: 'a', quantity: 2 },
      { id: 'b', quantity: 1 },
    ];
    assert.equal(cartSubtotal(cart, products), 3800);
  });

  test('ignores lines whose product is missing from the catalog', () => {
    const products = [product('a', 1500)];
    const cart: CartLine[] = [
      { id: 'a', quantity: 1 },
      { id: 'ghost', quantity: 5 },
    ];
    assert.equal(cartSubtotal(cart, products), 1500);
  });
});

describe('placeholderCoverTint', () => {
  test('maps known titles case-insensitively', () => {
    assert.equal(placeholderCoverTint({ id: 'x', title: 'A Little Life' }), 'purple');
    assert.equal(placeholderCoverTint({ id: 'x', title: 'normal people' }), 'gold');
    assert.equal(placeholderCoverTint({ id: 'x', title: 'The Alchemist' }), 'teal');
    assert.equal(placeholderCoverTint({ id: 'x', title: 'The Comfort Book' }), 'pink');
  });

  test('trims surrounding whitespace before matching', () => {
    assert.equal(placeholderCoverTint({ id: 'x', title: '  The Alchemist  ' }), 'teal');
  });

  test('is deterministic and always returns one of the four tints', () => {
    const tints = new Set(['purple', 'gold', 'teal', 'pink']);
    for (const id of ['abc', 'def-123', 'zzz']) {
      const first = placeholderCoverTint({ id, title: 'Unknown Title' });
      const second = placeholderCoverTint({ id, title: 'Unknown Title' });
      assert.equal(first, second);
      assert.ok(tints.has(first));
    }
  });
});

describe('isLowStock', () => {
  test('active books at or below the threshold are low', () => {
    assert.equal(isLowStock(book(true, 0)), true);
    assert.equal(isLowStock(book(true, 5)), true);
  });

  test('active books above the threshold are not low', () => {
    assert.equal(isLowStock(book(true, 6)), false);
  });

  test('inactive books are never low', () => {
    assert.equal(isLowStock(book(false, 0)), false);
    assert.equal(isLowStock(book(false, 3)), false);
  });
});

describe('order statuses', () => {
  test('match the database enum exactly', () => {
    assert.deepEqual(ORDER_STATUSES, ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']);
  });
});

describe('wilaya data invariants', () => {
  test('has 58 entries with unique sequential codes 1 to 58', () => {
    assert.equal(WILAYAS.length, 58);
    const codes = WILAYAS.map((wilaya) => wilaya.code);
    assert.equal(new Set(codes).size, 58);
    for (let index = 0; index < 58; index += 1) {
      assert.equal(codes[index], index + 1);
    }
  });

  test('every wilaya has a non-empty name and unique non-empty communes', () => {
    for (const wilaya of WILAYAS) {
      assert.ok(wilaya.name.trim().length > 0, `wilaya ${wilaya.code} has an empty name`);
      assert.ok(wilaya.communes.length > 0, `wilaya ${wilaya.code} has no communes`);
      for (const commune of wilaya.communes) {
        assert.ok(commune.trim().length > 0, `wilaya ${wilaya.code} has an empty commune`);
      }
      assert.equal(new Set(wilaya.communes).size, wilaya.communes.length, `wilaya ${wilaya.code} has duplicate communes`);
    }
  });
});
