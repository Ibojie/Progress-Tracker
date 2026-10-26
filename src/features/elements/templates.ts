import type { CategoryKey } from '@/lib/database.types';

export interface ElementTemplate {
  category: CategoryKey;
  name: string;
  description?: string;
  /** Suggested goals; each gets today's date as start and is due `dueInDays` later. */
  goals: { title: string; dueInDays: number }[];
}

/** Starter templates from the example elements in §3. */
export const TEMPLATES: ElementTemplate[] = [
  {
    category: 'paid_job',
    name: 'Performance Management (PMI)',
    description: 'Follow up every PMI milestone so nothing slips.',
    goals: [
      { title: 'Agree objectives with line manager', dueInDays: 14 },
      { title: 'Gather mid-year evidence', dueInDays: 90 },
      { title: 'Mid-year review meeting', dueInDays: 120 },
      { title: 'Submit self-assessment', dueInDays: 300 },
      { title: 'Final review meeting', dueInDays: 330 },
    ],
  },
  {
    category: 'paid_job',
    name: 'Outstanding Trainings',
    goals: [
      { title: 'List mandatory trainings due', dueInDays: 7 },
      { title: 'Complete the first training', dueInDays: 30 },
    ],
  },
  {
    category: 'paid_job',
    name: 'Job Applications',
    goals: [
      { title: 'Update CV', dueInDays: 7 },
      { title: 'Send first application', dueInDays: 14 },
    ],
  },
  {
    category: 'business',
    name: 'Naija Commerce',
    goals: [
      { title: 'Define this quarter’s targets', dueInDays: 7 },
      { title: 'Review sales and costs', dueInDays: 30 },
    ],
  },
  {
    category: 'business',
    name: 'Match Mate Matters',
    goals: [{ title: 'Set the next milestone', dueInDays: 14 }],
  },
  {
    category: 'business',
    name: 'Naija Street Matters',
    goals: [{ title: 'Set the next milestone', dueInDays: 14 }],
  },
  {
    category: 'investment',
    name: 'Shares/Stocks',
    goals: [
      { title: 'Review portfolio performance', dueInDays: 30 },
      { title: 'Rebalance if needed', dueInDays: 45 },
    ],
  },
  {
    category: 'investment',
    name: 'Mutual Funds',
    goals: [{ title: 'Review fund statements', dueInDays: 30 }],
  },
  {
    category: 'investment',
    name: 'Land/Properties',
    goals: [
      { title: 'Confirm title documents', dueInDays: 30 },
      { title: 'Plan the next payment', dueInDays: 60 },
    ],
  },
  {
    category: 'personal_development',
    name: 'NEBOSH',
    description: 'NEBOSH International General Certificate',
    goals: [
      { title: 'Register for the exam', dueInDays: 14 },
      { title: 'Unit IG1 assignment', dueInDays: 45 },
      { title: 'Unit IG2 practical assessment', dueInDays: 75 },
    ],
  },
  {
    category: 'personal_development',
    name: 'Book Reading',
    description: 'Book title:',
    goals: [
      { title: 'Read the first half', dueInDays: 14 },
      { title: 'Finish the book', dueInDays: 30 },
      { title: 'Write key takeaways', dueInDays: 35 },
    ],
  },
  {
    category: 'personal_development',
    name: 'Learning Claude',
    goals: [
      { title: 'Finish the getting-started course', dueInDays: 14 },
      { title: 'Build one small project', dueInDays: 45 },
    ],
  },
  {
    category: 'personal_development',
    name: 'Self-Training',
    goals: [{ title: 'Pick the topic and plan', dueInDays: 7 }],
  },
];
