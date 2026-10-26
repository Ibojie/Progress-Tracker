import { Briefcase, GraduationCap, LineChart, Store, type LucideIcon } from 'lucide-react';
import type { CategoryKey } from '@/lib/database.types';

export const CATEGORY_ICON: Record<CategoryKey, LucideIcon> = {
  paid_job: Briefcase,
  business: Store,
  investment: LineChart,
  personal_development: GraduationCap,
};
