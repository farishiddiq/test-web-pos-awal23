import {
  ChartBar,
  GearSix,
  HandCoins,
  House,
  Package,
  Receipt,
  Truck,
  Wallet,
  CashRegister,
  type Icon,
} from '@phosphor-icons/react';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  ownerOnly?: boolean;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/kasir', label: 'Kasir', icon: CashRegister },
  { to: '/transaksi', label: 'Transaksi', icon: Receipt },
  { to: '/produk', label: 'Produk & stok', icon: Package },
  { to: '/piutang', label: 'Piutang', icon: HandCoins },
  { to: '/pengeluaran', label: 'Pengeluaran', icon: Wallet, ownerOnly: true },
  { to: '/laporan', label: 'Laporan', icon: ChartBar, ownerOnly: true },
  { to: '/supplier', label: 'Supplier', icon: Truck, ownerOnly: true },
  { to: '/pengaturan', label: 'Pengaturan', icon: GearSix },
];
