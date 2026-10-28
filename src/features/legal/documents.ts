// The public legal documents (Google Play: privacy policy, account deletion page, terms).
// Plain language, written to match what the app actually does. Links use [text](url).
// Drafts prepared for the owner; not legal advice (see DECISIONS.md).

export const OPERATOR = 'The Business Apostle';
export const APP_NAME = 'Progress Tracker';
export const CONTACT_EMAIL = 'ibojie@gmail.com';
export const LOCATION = 'Lagos, Nigeria';
export const EFFECTIVE_DATE = '28 October 2026';

export type Block = string | { list: string[] } | { table: [string, string, string][] };

export interface LegalSection {
  id: string;
  heading: string;
  body: Block[];
}

export interface LegalDocument {
  slug: 'privacy' | 'terms' | 'fair-use' | 'refunds' | 'account-deletion';
  title: string;
  summary: string;
  sections: LegalSection[];
}

const mail = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: `How ${APP_NAME} collects, uses, shares and protects your information, and the choices you have.`,
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      body: [
        `${APP_NAME} is a personal goal and deadline tracker operated by ${OPERATOR}, based in ${LOCATION} ("we", "us"). We are responsible for your personal data in the app.`,
        `Contact us about anything in this policy at ${mail}.`,
      ],
    },
    {
      id: 'summary',
      heading: 'The short version',
      body: [
        {
          list: [
            'We collect only what the app needs to work: your sign-in details, the goals you enter and your settings.',
            'We do not sell your data, show ads, or use advertising or analytics trackers.',
            'You can export everything you have entered, and delete your account and all its data at any time.',
            'The optional AI insight sends only area and element names and numbers to our AI provider, never goal titles, notes or your email address.',
          ],
        },
      ],
    },
    {
      id: 'what-we-collect',
      heading: 'What we collect',
      body: [
        {
          list: [
            'Account details: your email address. If you sign in with Google, also your name, profile picture link and Google account ID, as Google provides them.',
            'What you enter: area names, elements, goals (titles, notes, start and due dates, ticks), date changes and their reasons, and the status history the app records.',
            'Progress history: a daily snapshot of each element’s progress, used for the dashboard trends.',
            'Settings: your timezone, theme, notification choices, quiet hours and whether the AI insight is on.',
            'Notifications: the reminders sent to you (title, text and when they were sent and read), and, if you turn on push notifications, each device’s push address and keys and a label such as “Android · Chrome”.',
            'AI insights: the insights written for you, and a count of how many you request each day.',
            'Technical data: our hosting providers keep standard server logs (such as IP address, browser type and time of request) to run and protect the service.',
          ],
        },
        'We do not collect your location, contacts, photos, files, payment details or health information.',
      ],
    },
    {
      id: 'how-we-use',
      heading: 'How we use it, and why',
      body: [
        {
          list: [
            'To provide the app: showing your goals, statuses, dashboard and timeline, and syncing between your devices. We need this to perform our agreement with you (the Terms of Service).',
            'To send the reminders you choose: push notifications, emails (such as “due today” and the Monday digest) and in-app alerts. Push and email are optional and can be switched off in Settings.',
            'To write the optional AI weekly insight, with your consent (the switch in Settings).',
            'To keep the service secure and working: preventing abuse, fixing faults and enforcing limits. This is in our legitimate interest in running a safe service.',
            'To meet legal obligations, if any apply.',
          ],
        },
        'We do not use your data for advertising, profiling for marketing, or automated decisions that have legal or similarly significant effects on you.',
      ],
    },
    {
      id: 'who-receives',
      heading: 'Who receives your data',
      body: [
        'We use trusted service providers who process data on our behalf, only to run the app:',
        {
          table: [
            ['Supabase', 'Database, sign-in and server functions. Stores your account and everything you enter.', 'Ireland (EU)'],
            ['Vercel', 'Hosts the app’s web pages.', 'Global network (USA-based company)'],
            ['Google', 'Google sign-in (if you choose it), and delivery of push notifications to Chrome and Android.', 'Global (USA-based company)'],
            ['Apple, Microsoft, Mozilla', 'Delivery of push notifications to Safari, Edge and Firefox. Push messages are encrypted so these services cannot read them.', 'Global'],
            ['Resend', 'Sends reminder and digest emails (your email address and the email’s content).', 'Ireland (EU) / USA'],
            ['Anthropic', 'Writes the optional AI insight from area and element names and numbers only. Anthropic does not use API data to train its models.', 'USA'],
          ],
        },
        'We may also disclose information if the law requires it, to protect the rights and safety of users or the public, or as part of a merger or sale of the service (we would tell you first). We never sell your personal data.',
      ],
    },
    {
      id: 'international',
      heading: 'International transfers',
      body: [
        'Your data is stored in the European Union (Ireland) and some providers process it in the United States and other countries. Where data leaves your country, we rely on the providers’ contractual safeguards (such as standard contractual clauses) and the protections described in this policy.',
      ],
    },
    {
      id: 'security',
      heading: 'How we protect it',
      body: [
        {
          list: [
            'All connections use encryption (HTTPS / TLS), and stored data is encrypted by our database provider.',
            'Database rules ensure each user can only ever read and change their own data.',
            'Secret keys stay on our servers and are never sent to your device.',
            'Push notifications are end-to-end encrypted between our server and your device.',
          ],
        },
        'No system is perfectly secure, but we work to protect your data and will tell you, and the authorities where required, about any breach that puts you at risk.',
      ],
    },
    {
      id: 'on-your-device',
      heading: 'Storage on your device',
      body: [
        'The app saves your sign-in session, theme and a copy of your data on your device so it works offline. This is not used for tracking. It is cleared when you sign out or delete your account. We do not use advertising or analytics cookies.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      body: [
        {
          list: [
            'Your account and everything in it: for as long as you keep your account.',
            'When you delete your account: it is removed from our live database immediately.',
            'Backups: copies may remain in our database provider’s encrypted backups for up to 30 days before they are overwritten.',
            'Emails: our email provider keeps sending logs for up to 30 days.',
            'AI requests: our AI provider may keep the request (names and numbers only) for up to 30 days for safety and abuse monitoring, then deletes it.',
            'Server logs: kept by our hosting providers for a short period (typically up to 30 days) for security.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights and choices',
      body: [
        'Depending on where you live (for example under the Nigeria Data Protection Act 2023, South Africa’s POPIA, Australia’s Privacy Act, India’s DPDP Act or the GDPR), you have rights over your data. You can:',
        {
          list: [
            'See and download it: Settings → Export your data (JSON or CSV).',
            'Correct it: edit any element, goal or setting in the app.',
            'Delete it: Settings → Delete my account, or see [Delete your account](/account-deletion).',
            'Withdraw consent or object: switch off push, email or the AI insight in Settings at any time.',
            'Ask us any question or make a request: email ' + mail + '. We reply within 30 days.',
          ],
        },
        'You can also complain to a data protection authority, such as the Nigeria Data Protection Commission, or the authority where you live.',
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      body: [
        `${APP_NAME} is intended for adults (18 or over). It is not directed at children and we do not knowingly collect children’s data. If you believe a child has created an account, contact us and we will delete it.`,
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: [
        'If we change this policy, we will update the date below and, for important changes, tell you in the app or by email before they take effect.',
      ],
    },
  ],
};

export const ACCOUNT_DELETION: LegalDocument = {
  slug: 'account-deletion',
  title: 'Delete your Progress Tracker account',
  summary: `How to delete your ${APP_NAME} account (by ${OPERATOR}) and all of its data, with or without the app.`,
  sections: [
    {
      id: 'in-the-app',
      heading: 'Option 1: in the app (immediate)',
      body: [
        {
          list: [
            'Open Progress Tracker and sign in.',
            'Go to Settings and scroll to Delete my account.',
            'Optionally, use Export your data first to keep a copy.',
            'Select Delete my account, type DELETE to confirm, and select Delete everything.',
          ],
        },
        'Your account and all its data are deleted straight away and you are signed out.',
      ],
    },
    {
      id: 'by-email',
      heading: 'Option 2: by email (no app needed)',
      body: [
        `Email ${mail} from the email address you use for ${APP_NAME}, with the subject “Delete my Progress Tracker account”. We may ask you to confirm the request from that address. We complete deletion within 7 days, and always within 30 days, and confirm by email.`,
      ],
    },
    {
      id: 'what-is-deleted',
      heading: 'What is deleted',
      body: [
        {
          list: [
            'Your account and sign-in details (including any Google sign-in link).',
            'All areas, elements, goals, notes, dates and ticks.',
            'Status history, date changes and progress snapshots.',
            'Your settings, push notification devices, notifications and AI insights.',
          ],
        },
      ],
    },
    {
      id: 'what-is-kept',
      heading: 'What may be kept, and for how long',
      body: [
        {
          list: [
            'Encrypted database backups: up to 30 days, then overwritten.',
            'Email sending logs at our email provider: up to 30 days.',
            'AI request records at our AI provider (names and numbers only): up to 30 days.',
            'Short-term server security logs: typically up to 30 days.',
          ],
        },
        'We do not keep anything else after deletion. Data saved on your own device is removed when you sign out, or you can clear it in your browser’s site settings.',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: `The agreement between you and ${OPERATOR} for using ${APP_NAME}.`,
  sections: [
    {
      id: 'agreement',
      heading: 'Agreement',
      body: [
        `These terms are an agreement between you and ${OPERATOR} (“we”, “us”), based in ${LOCATION}, for your use of ${APP_NAME} (the “app”). By creating an account or using the app, you agree to them. If you do not agree, please do not use the app.`,
      ],
    },
    {
      id: 'the-service',
      heading: 'What the app does',
      body: [
        'Progress Tracker helps you plan goals and deadlines, see your progress, and receive reminders. Features may change, improve or be removed over time. The app is currently free.',
      ],
    },
    {
      id: 'eligibility',
      heading: 'Who can use it',
      body: ['You must be at least 18 (or the age of majority where you live) and able to enter into this agreement.'],
    },
    {
      id: 'your-account',
      heading: 'Your account',
      body: [
        {
          list: [
            'Keep access to your email and Google account secure; you are responsible for activity on your account.',
            'Tell us promptly at ' + mail + ' if you think someone else has accessed it.',
            'You can delete your account at any time in Settings (see [Delete your account](/account-deletion)).',
          ],
        },
      ],
    },
    {
      id: 'your-content',
      heading: 'Your content',
      body: [
        'You own everything you enter. You give us permission to store, process and display it only to provide the app to you (including sending your reminders and, if you turn it on, preparing the AI insight). We do not claim ownership of it and do not use it for advertising.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable use',
      body: ['Use the app lawfully and as described in our [Fair Use Policy](/fair-use), which forms part of these terms.'],
    },
    {
      id: 'ai',
      heading: 'AI insights',
      body: [
        'The optional weekly insight is written automatically by an AI model from your progress figures. It may be incomplete or wrong. It is general encouragement, not professional, financial, legal, medical or career advice. Use your own judgement before acting on it.',
      ],
    },
    {
      id: 'reminders',
      heading: 'Reminders and availability',
      body: [
        'We work to keep the app available and reminders on time, but delivery depends on your device, its settings, your connection and third-party services. Reminders can be delayed or missed. Do not rely on the app as your only record of critical deadlines.',
      ],
    },
    {
      id: 'ip',
      heading: 'Our app',
      body: [
        `The app, its design and its code belong to ${OPERATOR}. You may use the app for your own personal or work planning, but may not copy, resell, or try to extract its source code, except where the law allows.`,
      ],
    },
    {
      id: 'ending',
      heading: 'Ending this agreement',
      body: [
        'You can stop using the app and delete your account at any time. We may suspend or close an account that seriously or repeatedly breaks these terms or the Fair Use Policy, or if required by law. Where reasonable, we will tell you first and give you a chance to export your data. We may also end the service with at least 30 days’ notice.',
      ],
    },
    {
      id: 'disclaimers',
      heading: 'Disclaimers',
      body: [
        'The app is provided “as is” and “as available”. To the extent the law allows, we make no promises that it will be error-free, uninterrupted, or suitable for a particular purpose. Nothing in these terms limits rights you have under consumer protection law that cannot be excluded.',
      ],
    },
    {
      id: 'liability',
      heading: 'Limitation of liability',
      body: [
        'To the extent the law allows, we are not liable for indirect or consequential losses, such as lost opportunities, missed deadlines, lost profits or lost data. As the app is free, our total liability to you for any claim is limited to ₦50,000 (or its equivalent). We do not exclude liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited by law.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      body: [
        'We may update these terms. For important changes we will tell you in the app or by email at least 14 days before they take effect. If you keep using the app after that, the new terms apply.',
      ],
    },
    {
      id: 'law',
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of the Federal Republic of Nigeria. The courts of Lagos State, Nigeria have jurisdiction over any dispute, without affecting any right you have to bring a claim where you live under local consumer law. Please contact us first; most problems can be solved quickly by email.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: [`${OPERATOR}, ${LOCATION}. Email ${mail}.`],
    },
  ],
};

export const FAIR_USE: LegalDocument = {
  slug: 'fair-use',
  title: 'Fair Use Policy',
  summary: `What counts as fair use of ${APP_NAME}, so it stays fast, safe and free for everyone.`,
  sections: [
    {
      id: 'purpose',
      heading: 'Purpose',
      body: [
        `${APP_NAME} is a personal tracker. This policy explains the limits and rules that keep it reliable for everyone. It forms part of our [Terms of Service](/terms).`,
      ],
    },
    {
      id: 'limits',
      heading: 'Built-in limits',
      body: [
        {
          list: [
            'Up to 10 goals per element.',
            'Up to 5 AI insight refreshes per day (plus the automatic Monday insight).',
            'Reminders are sent once per goal per type each day, at your chosen time.',
          ],
        },
        'We may adjust these limits to protect the service, and will show any change in the app.',
      ],
    },
    {
      id: 'do-not',
      heading: 'Please do not',
      body: [
        {
          list: [
            'Break the law or use the app to store or share unlawful, harmful or abusive content.',
            'Try to access other people’s accounts or data, or test, probe or bypass our security or limits.',
            'Overload the service, for example with automated scripts, bots or scraping.',
            'Copy, resell or offer the app as your own service.',
            'Use the AI insight to try to produce harmful content or to extract how it works.',
            'Create accounts for other people without their permission.',
          ],
        },
      ],
    },
    {
      id: 'enforcement',
      heading: 'If this policy is broken',
      body: [
        'We may limit features, pause reminders or AI requests, or suspend an account. We will act in proportion to the problem and, where reasonable, contact you first. To report misuse, email ' + mail + '.',
      ],
    },
  ],
};

export const REFUNDS: LegalDocument = {
  slug: 'refunds',
  title: 'Refund Policy',
  summary: `${APP_NAME} is currently free; this explains what would apply if paid features are added.`,
  sections: [
    {
      id: 'free',
      heading: 'Progress Tracker is free',
      body: [
        'There are no charges, subscriptions or in-app purchases at present, so there is nothing to refund. We will never charge you without telling you clearly first and getting your agreement.',
      ],
    },
    {
      id: 'future',
      heading: 'If paid features are added',
      body: [
        {
          list: [
            'Prices, what is included and how to cancel will be shown clearly before you pay.',
            'Purchases made through Google Play follow Google Play’s refund policies: you can request a refund from Google Play, and within 48 hours of purchase Google usually handles it directly.',
            'After that, or for purchases made on our website, contact us at ' + mail + ' within 14 days and we will refund you if the paid feature did not work as described.',
            'Cancelling a subscription stops future payments; you keep access until the end of the period you paid for.',
            'Your rights under consumer protection law are not affected.',
          ],
        },
        'We will update this policy before any paid feature is offered.',
      ],
    },
  ],
};

export const DOCUMENTS: LegalDocument[] = [PRIVACY, TERMS, FAIR_USE, REFUNDS, ACCOUNT_DELETION];
