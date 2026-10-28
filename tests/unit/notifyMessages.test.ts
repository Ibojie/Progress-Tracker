import { describe, expect, it } from 'vitest';
import {
  alertEmail,
  deltaLabel,
  digestEmail,
  dueLabel,
  escapeHtml,
  formatDay,
  isPushEndpoint,
  pushPayload,
  safePath,
  type AlertRow,
  type DigestData,
} from '../../supabase/functions/notify/messages';
import { base64UrlToBytes, deviceLabel, VAPID_PUBLIC_KEY } from '@/features/notifications/push';
import { toTimeInput, unreadCount } from '@/features/notifications/api';
import type { NotificationRow } from '@/lib/database.types';

const APP = 'https://progress.example';

const row = (patch: Partial<AlertRow> = {}): AlertRow => ({
  id: 'n1',
  user_id: 'u',
  goal_id: 'g1',
  element_id: 'abc-123',
  kind: 'due_today',
  channel: 'push',
  attempts: 1,
  title: 'Due today: Mock exam',
  body: 'PMI 2027 · tick it off once it’s done.',
  link: '/elements/abc-123',
  sent_on: '2026-11-02',
  ...patch,
});

describe('push payloads', () => {
  it('carries the title, text and the element to open', () => {
    expect(pushPayload(row())).toEqual({
      title: 'Due today: Mock exam',
      body: 'PMI 2027 · tick it off once it’s done.',
      url: '/elements/abc-123',
      tag: 'due_today:g1',
    });
    expect(pushPayload(row({ title: null, body: null, link: null }))).toMatchObject({ title: 'Progress Tracker', body: '', url: '/' });
    // Two goals in one element each get their own notification on the phone.
    expect(pushPayload(row({ goal_id: 'g2' })).tag).not.toBe(pushPayload(row()).tag);
    expect(pushPayload(row({ goal_id: null, kind: 'stalled' })).tag).toBe('stalled:abc-123');
  });

  it('only ever opens a page inside the app', () => {
    expect(safePath('/elements/1')).toBe('/elements/1');
    for (const bad of ['https://evil.example', '//evil.example', '//evil', '///x', 'javascript:alert(1)', '/a?b', null, undefined, '']) {
      expect(safePath(bad)).toBe('/');
    }
  });
});

describe('push services', () => {
  it('only posts to the browsers’ push services', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isPushEndpoint(ok)).toBe(true);
    }
    for (const bad of ['https://evil.example/x', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x', 'https://push.apple.com.evil/x']) {
      expect(isPushEndpoint(bad)).toBe(false);
    }
  });
});

describe('emails', () => {
  it('alert emails escape user text and link to the element', () => {
    const msg = alertEmail(row({ title: 'Due today: <b>Fees</b> & "tax"' }), APP);
    expect(msg.subject).toBe('Due today: <b>Fees</b> & "tax"');
    expect(msg.html).toContain('Due today: &lt;b&gt;Fees&lt;/b&gt; &amp; &quot;tax&quot;');
    expect(msg.html).not.toContain('<b>Fees</b>');
    expect(msg.html).toContain(`${APP}/elements/abc-123`);
    expect(msg.text).toContain(`Open: ${APP}/elements/abc-123`);
    expect(msg.html).toContain(`${APP}/settings`);
  });

  const digest: DigestData = {
    week_start: '2026-10-26',
    week_end: '2026-11-01',
    goals_total: 8,
    goals_done: 3,
    done_last_week: 2,
    done_week_before: 4,
    overdue: 1,
    abandoned: 0,
    due_soon: 2,
    focus: [{ title: 'Unit 2', element_name: 'NEBOSH', element_id: 'e1', due_date: '2026-11-03', days_left: 1 }],
  };

  it('the Monday digest shows the week, the change, completion and the focus list', () => {
    const msg = digestEmail(digest, APP);
    expect(msg.subject).toBe('Your week: 2 goals completed');
    expect(msg.html).toContain('26 Oct 2026 – 1 Nov 2026');
    expect(msg.html).toContain('2 (▼ 2 fewer than the week before)');
    expect(msg.html).toContain('38% (3 of 8 goals)');
    expect(msg.html).toContain(`${APP}/elements/e1`);
    expect(msg.text).toContain('- Unit 2 · NEBOSH · due tomorrow');
  });

  it('says so when nothing needs attention', () => {
    const msg = digestEmail({ ...digest, goals_total: 0, goals_done: 0, done_last_week: 1, focus: [] }, APP);
    expect(msg.subject).toBe('Your week: 1 goal completed');
    expect(msg.html).toContain('Nothing is overdue or due in the next 14 days');
    expect(msg.html).toContain('0% (0 of 0 goals)');
  });

  it('labels and formats plainly', () => {
    expect([0, 1, 5, -1, -3].map(dueLabel)).toEqual(['due today', 'due tomorrow', 'due in 5 days', '1 day overdue', '3 days overdue']);
    expect(deltaLabel(3, 3)).toBe('same as the week before');
    expect(deltaLabel(5, 2)).toBe('▲ 3 more than the week before');
    expect(formatDay('2026-01-09')).toBe('9 Jan 2026');
    expect(escapeHtml(`<a href='x'>`)).toBe('&lt;a href=&#39;x&#39;&gt;');
  });
});

describe('push on the device', () => {
  it('decodes the public key to the 65-byte P-256 point browsers expect', () => {
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it('names the device for Settings', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe(
      'iPhone/iPad · Safari',
    );
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Windows · Edge');
  });

  it('shows stored times in the time picker and counts unread alerts', () => {
    expect(toTimeInput('22:00:00')).toBe('22:00');
    expect(toTimeInput(null)).toBe('');
    const n = (read_at: string | null) => ({ read_at }) as NotificationRow;
    expect(unreadCount([n(null), n('2026-11-02T08:00:00Z'), n(null)])).toBe(2);
    expect(unreadCount(undefined)).toBe(0);
  });
});
