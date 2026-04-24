import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { Search, Users, X } from 'lucide-react';
import type { Customer } from '@/modules/customers/hooks/useCustomers';

function getPersonDisplayName(c: Customer): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || c.phone || '—';
}

export interface OrderPersonSelection {
  person_id: string;
  is_primary: boolean;
}

interface OrderPeoplePickerProps {
  value: OrderPersonSelection[];
  onChange: (value: OrderPersonSelection[]) => void;
  customers: Customer[];
  disabled?: boolean;
}

export const OrderPeoplePicker: React.FC<OrderPeoplePickerProps> = ({
  value,
  onChange,
  customers,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(() => new Set(value.map((p) => p.person_id)), [value]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.first_name?.toLowerCase().includes(q) ?? false) ||
        (c.last_name?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, searchQuery]);

  const addPerson = (personId: string) => {
    if (selectedIds.has(personId)) return;
    const isFirst = value.length === 0;
    onChange([...value, { person_id: personId, is_primary: isFirst }]);
    setOpen(false);
  };

  const removePerson = (personId: string) => {
    const next = value.filter((p) => p.person_id !== personId);
    const wasPrimary = value.find((p) => p.person_id === personId)?.is_primary;
    if (wasPrimary && next.length > 0 && !next.some((p) => p.is_primary)) {
      onChange(next.map((p, i) => (i === 0 ? { ...p, is_primary: true } : p)));
      return;
    }
    onChange(next);
  };

  const setPrimary = (personId: string) => {
    onChange(
      value.map((p) => ({
        ...p,
        is_primary: p.person_id === personId,
      }))
    );
  };

  return (
    <div className="space-y-3">
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
              {value.length === 0
                ? 'Select people...'
                : `${value.length} person${value.length === 1 ? '' : 's'} selected`}
            </span>
            <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gardens-txs" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {filteredCustomers
              .filter((c) => !selectedIds.has(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addPerson(c.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page rounded"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  {getPersonDisplayName(c)}
                </button>
              ))}
            {filteredCustomers.filter((c) => !selectedIds.has(c.id)).length === 0 && (
              <p className="text-sm text-gardens-txs py-4 text-center">
                {selectedIds.size === customers.length ? 'All people selected' : 'No matches'}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {value.map((p) => {
              const customer = customers.find((c) => c.id === p.person_id);
              const displayName = customer ? getPersonDisplayName(customer) : p.person_id.slice(0, 8);
              return (
                <Badge
                  key={p.person_id}
                  variant={p.is_primary ? 'default' : 'secondary'}
                  className="pl-2 pr-1 py-1 gap-1"
                >
                  {p.is_primary && <span className="text-xs">★ </span>}
                  {displayName}
                  <button
                    type="button"
                    onClick={() => removePerson(p.person_id)}
                    disabled={disabled}
                    className="ml-1 rounded-full hover:bg-gardens-bdr2 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          {value.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs text-gardens-txs">Primary person</Label>
              <RadioGroup
                value={value.find((p) => p.is_primary)?.person_id ?? ''}
                onValueChange={setPrimary}
              >
                {value.map((p) => {
                  const customer = customers.find((c) => c.id === p.person_id);
                  const displayName = customer ? getPersonDisplayName(customer) : p.person_id.slice(0, 8);
                  return (
                    <div key={p.person_id} className="flex items-center space-x-2">
                      <RadioGroupItem value={p.person_id} id={`primary-${p.person_id}`} />
                      <Label htmlFor={`primary-${p.person_id}`} className="text-sm font-normal cursor-pointer">
                        {displayName}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
