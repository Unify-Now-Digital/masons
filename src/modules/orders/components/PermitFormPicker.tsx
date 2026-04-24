import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Search, FileText, X, ExternalLink } from 'lucide-react';
import type { PermitForm } from '@/modules/permitForms/api/permitForms.api';

function getLinkSecondaryText(link: string | null): string {
  if (!link) return 'No link';
  try {
    const url = new URL(link);
    return url.hostname || 'Link';
  } catch {
    return 'Link';
  }
}

interface PermitFormPickerProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  permitForms: PermitForm[];
  disabled?: boolean;
}

export const PermitFormPicker: React.FC<PermitFormPickerProps> = ({
  value,
  onChange,
  permitForms,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selected = useMemo(
    () => (value ? permitForms.find((pf) => pf.id === value) ?? null : null),
    [value, permitForms]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return permitForms;
    return permitForms.filter((pf) => pf.name.toLowerCase().includes(q));
  }, [permitForms, searchQuery]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected ? selected.name : 'Select permit form (optional)'}
            </span>
            <FileText className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gardens-txs" />
              <Input
                placeholder="Search permit forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page rounded"
              >
                <X className="h-4 w-4 shrink-0" />
                Clear selection
              </button>
            )}

            {filtered.map((pf) => (
              <button
                key={pf.id}
                type="button"
                onClick={() => {
                  onChange(pf.id);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page rounded"
              >
                <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="truncate">{pf.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {getLinkSecondaryText(pf.link)}
                  </div>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="text-sm text-gardens-txs py-4 text-center">No matches</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected?.link && (
        <Button variant="outline" size="sm" asChild>
          <a href={selected.link} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </a>
        </Button>
      )}
    </div>
  );
};

