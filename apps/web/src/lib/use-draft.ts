'use client';

import { useState } from 'react';

/**
 * A text field saved on blur (Plan 3 §9): the draft follows the server value while the field is not being edited,
 * the save is awaited, and a failed save rolls the draft back to the server value.
 */
export function useDraft(server: string, save: (value: string) => Promise<unknown>) {
  const [draft, setDraft] = useState(server);
  const [editing, setEditing] = useState(false);
  const [seen, setSeen] = useState(server);
  if (server !== seen && !editing) {
    setSeen(server);
    setDraft(server);
  }
  const commit = async () => {
    setEditing(false);
    if (draft === server) return;
    try {
      await save(draft);
    } catch (err) {
      setDraft(server);
      throw err;
    }
  };
  return {
    value: draft,
    onChange: (value: string) => {
      setEditing(true);
      setDraft(value);
    },
    commit,
  };
}
