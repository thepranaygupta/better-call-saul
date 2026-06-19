'use client';

import { useEffect } from 'react';

const RECENT_LEADS_KEY = 'saul:recent-leads';

interface RecentLeadEntry {
  id: string;
  name: string;
  band: string;
}

/**
 * Invisible client component that records the current lead into
 * localStorage so the sidebar "Recent" section stays up to date.
 * Fires once on mount.
 */
export function RecentLeadTracker({
  leadId,
  leadName,
  leadBand,
}: {
  leadId: string;
  leadName: string;
  leadBand: string;
}) {
  useEffect(() => {
    try {
      const existing: RecentLeadEntry[] = JSON.parse(
        localStorage.getItem(RECENT_LEADS_KEY) || '[]',
      );
      const filtered = existing.filter((l) => l.id !== leadId);
      const updated = [{ id: leadId, name: leadName, band: leadBand }, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_LEADS_KEY, JSON.stringify(updated));
      // Notify sidebar to re-read
      window.dispatchEvent(new Event('saul:recent-leads-updated'));
    } catch {
      // localStorage unavailable — silently skip
    }
  }, [leadId, leadName, leadBand]);

  return null;
}
