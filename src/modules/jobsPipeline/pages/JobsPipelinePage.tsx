import { PipelineBoard } from '../components/PipelineBoard';

export function JobsPipelinePage() {
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">
            Pipeline
          </h1>
          <p className="text-sm text-gardens-txs mt-1">
            Jobs before payment — enquired, quoted and invoiced.
          </p>
        </div>
        {/* View switch (Active | Exited) lands with the exit flow. */}
      </div>

      <PipelineBoard />
    </div>
  );
}
