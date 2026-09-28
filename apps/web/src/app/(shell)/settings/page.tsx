import { Suspense } from 'react';
import { SettingsPage } from '@/features/configuration/settings/settings-page';

export default function Settings() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
