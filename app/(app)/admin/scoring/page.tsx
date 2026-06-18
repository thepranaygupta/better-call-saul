import {
  getScoringConfig,
  getScoringConfigHistory,
} from '@/app/(app)/admin/actions';
import { ScoringConfigEditor } from '@/components/admin/scoring-config-editor';

export const metadata = {
  title: 'Scoring Configuration — Saul',
};

export default async function ScoringConfigPage() {
  const [config, history] = await Promise.all([
    getScoringConfig(),
    getScoringConfigHistory(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
          Scoring Configuration
        </h1>
        <p className="text-[13px] text-stone-500">
          Adjust fit and intent weights, thresholds, and disqualifiers. Each save
          creates a new version. Re-score all leads after changing weights.
        </p>
      </div>
      <ScoringConfigEditor
        initialConfig={config}
        configHistory={history}
      />
    </div>
  );
}
