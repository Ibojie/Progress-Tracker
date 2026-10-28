// The main journeys, end to end, against the fake Supabase (see fakeSupabase.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FakeDb, installFakeSupabase, isoDay, signIn } from './fakeSupabase';

let db: FakeDb;

test.beforeEach(async ({ page }) => {
  db = new FakeDb();
  await installFakeSupabase(page, db);
});

/** WCAG A/AA problems axe can detect automatically (§10: AA in both themes). */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

test('signed out: the sign-in page offers email and Google, and is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Progress Tracker' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expectAccessible(page);
});

test('dashboard loads, the AI card stays hidden without a key, and it is accessible', async ({ page }) => {
  db.addElement('PMI 2027', 'paid_job', [
    { title: 'Book exam', start: isoDay(-20), due: isoDay(10) },
    { title: 'Mock test', start: isoDay(-20), due: isoDay(40) },
  ]);
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Progress and advice' })).toBeVisible();
  // Acceptance test 14: with no AI key the app works and the insight card is hidden.
  await expect(page.getByRole('heading', { name: 'Your weekly insight' })).toHaveCount(0);
  await expectAccessible(page);
});

test('acceptance test 1: ticking goals moves PMI 2027 through In Progress to Completed and back', async ({ page }) => {
  const id = db.addElement(
    'PMI 2027',
    'paid_job',
    [1, 2, 3, 4].map((n) => ({ title: `Goal ${n}`, start: isoDay(-10), due: isoDay(30 + n) })),
  );
  await signIn(page);
  await page.goto(`/elements/${id}`);
  // The box updates a moment after the tap (once the change is queued), so click, then check.
  const tick = async (n: number) => {
    await page.getByLabel(`Mark “Goal ${n}” as done`).click();
    await expect(page.getByLabel(`Mark “Goal ${n}” as not done`)).toBeChecked();
  };

  await tick(1);
  await expect(page.getByText(/In Progress\s*·\s*25%/).first()).toBeVisible();

  for (const n of [2, 3, 4]) await tick(n);
  await expect(page.getByText(/Completed\s*·\s*100%/).first()).toBeVisible();

  await page.getByLabel('Mark “Goal 4” as not done').click();
  await expect(page.getByLabel('Mark “Goal 4” as done')).not.toBeChecked();
  await expect(page.getByText(/In Progress\s*·\s*75%/).first()).toBeVisible();
  await expectAccessible(page);
});

test('the wizard creates an element, and an 11th goal can’t be added (acceptance test 12)', async ({ page }) => {
  await signIn(page);
  await page.goto('/elements/new');
  await page.getByText('Business', { exact: true }).click();
  await page.getByLabel('Element name').fill('Naija Commerce');
  await page.getByRole('button', { name: /Next/ }).click();

  await page.getByLabel('Goal', { exact: true }).first().fill('Register the company');
  await page.locator('#goal-0-start').fill(isoDay(0));
  await page.locator('#goal-0-due').fill(isoDay(20));
  for (let i = 1; i < 10; i++) await page.getByRole('button', { name: 'Add another goal' }).click();
  await expect(page.getByRole('button', { name: 'Maximum of 10 goals reached' })).toBeDisabled();
  // Back to one goal for a quick save.
  for (let i = 10; i > 1; i--) await page.getByRole('button', { name: `Remove goal ${i}` }).click();

  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Save element/ }).click();
  await expect(page.getByRole('heading', { name: 'Naija Commerce' })).toBeVisible();
  expect(db.elements.map((e) => e.name)).toEqual(['Naija Commerce']);
});

test('acceptance test 15: the mode switch flips the theme and keeps it after a reload', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('switch', { name: /Switch to (dark|light) mode/ }).first().click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after); // set before React loads: no flash
  await expectAccessible(page); // and AA holds in the other theme too
});

test('the app is usable by keyboard: skip link, then the main navigation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard check runs on desktop');
  await signIn(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeVisible();
});

test('no sideways scrolling on a 320px-wide phone', async ({ page }) => {
  db.addElement('A long element name that needs to wrap on a small phone screen', 'investment', [
    { title: 'Goal', start: isoDay(-5), due: isoDay(3) },
  ]);
  await page.setViewportSize({ width: 320, height: 720 });
  await signIn(page);
  for (const path of ['/', '/categories', '/timeline', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `sideways scroll on ${path}`).toBeLessThanOrEqual(0);
  }
});

test('delete my account: needs the word DELETE, then signs out with a confirmation', async ({ page }) => {
  db.addElement('Plan', 'business', [{ title: 'Goal', start: isoDay(-5), due: isoDay(30) }]);
  await signIn(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('button', { name: 'Delete everything' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await confirm.click();
  await expect(page.getByText('Your account and all its data have been deleted.')).toBeVisible();
  expect(db.deleted).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`every main screen passes the automatic WCAG AA check in ${theme} mode`, async ({ page }) => {
    const id = db.addElement('PMI 2027', 'paid_job', [
      { title: 'Overdue goal', start: isoDay(-20), due: isoDay(-3) },
      { title: 'Soon goal', start: isoDay(-20), due: isoDay(5) },
      { title: 'Done goal', start: isoDay(-20), due: isoDay(40), done: true },
    ]);
    db.addElement('Land', 'investment', [{ title: 'Later', start: isoDay(10), due: isoDay(90) }]);
    db.profile.theme_preference = theme;
    await page.addInitScript((t) => localStorage.setItem('pt-theme', t), theme);
    await signIn(page);
    for (const path of ['/', '/categories', '/categories/paid_job', `/elements/${id}`, '/timeline', '/settings', '/elements/new']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    }
  });
}
