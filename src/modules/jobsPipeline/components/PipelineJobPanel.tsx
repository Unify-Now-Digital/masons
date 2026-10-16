import { useState } from 'react';
import { ClipboardList, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { PANEL_PRIMARY } from '@/shared/components/mason';
import { InfoList, PanelSection, SidePanel } from '@/shared/components/panel';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { formatStageLabel, getJobDisplayName } from '../utils/display';
import { jobNextStep, jobValue, jobValueLabel, quietText } from '../utils/pipelineView';

/**
 * Right-hand panel for a selected pipeline job. Same chrome as the inbox person panel.
 * Money stays behind canSeeMoney. Names go through getJobDisplayName (no-surname helper).
 */
export function PipelineJobPanel({
  job,
  invoice,
  onClose,
}: {
  job: PipelineJob;
  invoice?: JobInvoiceSummary;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const canSeeMoney = useCanSeeMoney();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => open[id] !== false;
  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: prev[id] === false }));

  const name = getJobDisplayName(job);
  const value = canSeeMoney ? jobValue(job, invoice) : null;
  const honest = jobValueLabel(job, invoice);
  const next = jobNextStep(job, invoice);
  const timer = quietText(job);
  const stageLabel = formatStageLabel(job.stage);
  return (
    <SidePanel
      mode="overlay"
      label={`${name} pipeline`}
      testId="pipeline-panel"
      kicker={job.stage === 'enquired' ? 'Enquiry' : stageLabel}
      name={name}
      onClose={onClose}
      action={job.conversation_id ? (
        <button
          type="button"
          data-testid="panel-primary"
          className={PANEL_PRIMARY}
          onClick={() => navigate(`/dashboard/inbox?conversation=${job.conversation_id}`)}
        >
          Open conversation
        </button>
      ) : undefined}
    >
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <PanelSection id="job" title="Job" icon={ClipboardList} open={isOpen('job')} onToggle={toggle} aside={stageLabel}>
          <InfoList
            rows={[
              { label: 'Stage', value: stageLabel },
              { label: 'Source', value: job.source },
              { label: 'Quiet', value: timer.text },
              ...(canSeeMoney ? [{ label: 'Value', value: value != null ? formatGbpDecimal(value) : (honest ?? '—') }] : []),
            ]}
          />
        </PanelSection>
        <PanelSection id="contact" title="Contact" icon={User} open={isOpen('contact')} onToggle={toggle}>
          <InfoList
            rows={[
              { label: 'Name', value: name },
              { label: 'Email', value: job.person?.email || '—' },
              { label: 'Phone', value: job.person?.phone || '—' },
            ]}
          />
        </PanelSection>
        <PanelSection id="next" title="Next" icon={Zap} open={isOpen('next')} onToggle={toggle}>
          {next.kind === 'none' ? (
            <p className="m-0 text-[13px] text-gardens-txs">Nothing to do on this job.</p>
          ) : (
            <InfoList rows={[{ label: 'Step', value: next.label }, { label: 'Why', value: next.reason || '—' }]} />
          )}
        </PanelSection>
      </div>
    </SidePanel>
  );
}
