import { useMemo, useSyncExternalStore } from 'react';
import { roundMoney, storage, uuid } from '@/lib/util';
import type { Product } from '@/data/types';

export interface CartLine {
  key: string;
  productId: string | null;
  name: string;
  unit: string;
  price: number;
  basePrice: number;
  qty: number;
  unitCost?: number;
  color?: string | null;
  image?: string | null;
  trackStock?: boolean;
  stock?: number;
}

/** id null = pelanggan baru yang dibuat bersamaan dengan transaksi */
export interface CartCustomer {
  id: string | null;
  name: string;
  phone?: string | null;
  balance?: number;
}

export interface CartState {
  lines: CartLine[];
  discount: number;
  customer: CartCustomer | null;
  note: string;
  /** Kunci idempotensi. Sama selama isi keranjang sama, jadi kirim ulang saat sinyal putus tidak dobel. */
  clientRef: string;
}

const emptyCart = (): CartState => ({ lines: [], discount: 0, customer: null, note: '', clientRef: uuid() });

type Store = { state: CartState; listeners: Set<() => void> };
const stores = new Map<string, Store>();
const keyFor = (businessId: string) => `possir.cart.${businessId}`;

function load(businessId: string): CartState {
  const saved = storage.get<CartState | null>(keyFor(businessId), null);
  if (!saved || !Array.isArray(saved.lines)) return emptyCart();
  return { ...emptyCart(), ...saved };
}

function store(businessId: string): Store {
  let s = stores.get(businessId);
  if (!s) {
    s = { state: load(businessId), listeners: new Set() };
    stores.set(businessId, s);
  }
  return s;
}

function update(businessId: string, recipe: (state: CartState) => CartState, keepRef = false) {
  const s = store(businessId);
  const next = recipe(s.state);
  s.state = keepRef ? next : { ...next, clientRef: uuid() };
  storage.set(keyFor(businessId), s.state);
  s.listeners.forEach((l) => l());
}

export function cartTotals(state: CartState) {
  const subtotal = roundMoney(state.lines.reduce((t, l) => t + roundMoney(l.qty * l.price), 0));
  const discount = Math.min(state.discount, subtotal);
  const count = state.lines.reduce((t, l) => t + l.qty, 0);
  return { subtotal, discount, total: roundMoney(subtotal - discount), count };
}

export function useCart(businessId: string) {
  const state = useSyncExternalStore(
    (cb) => {
      const s = store(businessId);
      s.listeners.add(cb);
      return () => s.listeners.delete(cb);
    },
    () => store(businessId).state,
  );

  const actions = useMemo(
    () => ({
      addProduct(p: Product) {
        update(businessId, (s) => {
          const existing = s.lines.find((l) => l.productId === p.id);
          if (existing) {
            return {
              ...s,
              lines: s.lines.map((l) =>
                l.productId === p.id ? { ...l, qty: roundQty(l.qty + 1), trackStock: p.track_stock, stock: p.stock } : l,
              ),
            };
          }
          return {
            ...s,
            lines: [
              ...s.lines,
              {
                key: p.id,
                productId: p.id,
                name: p.name,
                unit: p.unit,
                price: p.price,
                basePrice: p.price,
                qty: 1,
                color: p.color,
                image: p.image_url,
                trackStock: p.track_stock,
                stock: p.stock,
              },
            ],
          };
        });
      },
      addQuick(line: { name: string; price: number; qty: number; unitCost?: number }) {
        update(businessId, (s) => ({
          ...s,
          lines: [
            ...s.lines,
            {
              key: `quick-${uuid()}`,
              productId: null,
              name: line.name,
              unit: 'pcs',
              price: line.price,
              basePrice: line.price,
              qty: line.qty,
              unitCost: line.unitCost,
            },
          ],
        }));
      },
      setQty(key: string, qty: number) {
        setQty(businessId, key, qty);
      },
      step(key: string, delta: number) {
        const line = store(businessId).state.lines.find((l) => l.key === key);
        if (line) setQty(businessId, key, roundQty(line.qty + delta));
      },
      setPrice(key: string, price: number) {
        update(businessId, (s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, price } : l)) }));
      },
      remove(key: string) {
        update(businessId, (s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));
      },
      setDiscount(discount: number) {
        update(businessId, (s) => ({ ...s, discount: Math.max(0, discount) }));
      },
      setCustomer(customer: CartCustomer | null) {
        update(businessId, (s) => ({ ...s, customer }));
      },
      setNote(note: string) {
        update(businessId, (s) => ({ ...s, note }), true);
      },
      clear() {
        update(businessId, () => emptyCart());
      },
      restore(previous: CartState) {
        update(businessId, () => previous, true);
      },
    }),
    [businessId],
  );

  return { state, totals: cartTotals(state), ...actions };
}

function roundQty(n: number) {
  return Math.round(n * 1000) / 1000;
}

function setQty(businessId: string, key: string, qty: number) {
  update(businessId, (s) => ({
    ...s,
    lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, qty: roundQty(qty) } : l)),
  }));
}
