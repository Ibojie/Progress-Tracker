// Types for the live schema. database.generated.ts is produced by `npm run db:types`; don't edit it by hand.
import type { Database } from './database.generated';

export type { Database, Json } from './database.generated';

type PublicSchema = Database['public'];
export type Row<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];

export type CategoryKey = PublicSchema['Enums']['category_key'];
export type CategoryRow = Row<'categories'>;
export type ElementRow = Row<'elements'>;
export type GoalRow = Row<'goals'>;
export type StatusEventRow = Row<'status_events'>;
export type GoalDateResetRow = Row<'goal_date_resets'>;
export type ProfileRow = Row<'profiles'>;
