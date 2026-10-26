import { CalendarRange, FolderKanban, LayoutDashboard, Plus, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/categories', label: 'Categories', icon: FolderKanban },
  { to: '/timeline', label: 'Timeline', icon: CalendarRange },
  { to: '/elements/new', label: 'Add', icon: Plus },
  { to: '/settings', label: 'Settings', icon: Settings },
];
