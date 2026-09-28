import type { Metadata } from 'next';
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from './providers';
import './globals.css';

const shoulders = Big_Shoulders({ subsets: ['latin'], variable: '--font-shoulders', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Open Drama', template: '%s · Open Drama' },
  description: 'Self-hosted AI short-drama studio',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${shoulders.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
