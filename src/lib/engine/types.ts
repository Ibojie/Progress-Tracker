/** Calendar date as 'YYYY-MM-DD', always in the user's timezone. */
export type IsoDate = string;
/** Instant as an ISO-8601 timestamp, e.g. from Postgres timestamptz. */
export type IsoTimestamp = string;

export type ElementStatus =
  | 'not_started'
  | 'started'
  | 'resource_delay'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'restarted'
  | 'decommissioned'
  | 'recommissioned';

/** What the user can choose at 0%. Not Started and Started are now driven by the start date (§4.6). */
export type ZeroProgressStatus = 'not_started' | 'started' | 'resource_delay';

export type GoalState = 'done' | 'not_started' | 'open' | 'overdue' | 'abandoned';

export interface EngineGoal {
  id: string;
  isDone: boolean;
  startDate: IsoDate;
  dueDate: IsoDate;
  /** When the tick box last changed (null if never). */
  tickChangedAt: IsoTimestamp | null;
}

export interface EngineElement {
  isDecommissioned: boolean;
  zeroProgressStatus: ZeroProgressStatus;
  recommissionedAt: IsoTimestamp | null;
  restartedAt: IsoTimestamp | null;
}
