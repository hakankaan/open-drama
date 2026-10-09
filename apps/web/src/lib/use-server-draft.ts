'use client';

import { useState } from 'react';

/**
 * An editable copy of a server field saved by an explicit Save button: it follows server changes but never drops
 * text typed during a save. Returns the draft, its setter and whether it differs from the server value.
 */
export function useServerDraft(serverValue: string) {
  const [draft, setDraft] = useState(serverValue);
  const [base, setBase] = useState(serverValue);
  if (base !== serverValue) {
    setBase(serverValue);
    if (draft === base) setDraft(serverValue);
  }
  return [draft, setDraft, draft !== serverValue] as const;
}
