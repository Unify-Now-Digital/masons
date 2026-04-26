import React, { useMemo, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Search, Users, Unlink } from 'lucide-react';
import { useCustomersList, type Customer } from '@/modules/customers/hooks/useCustomers';

function getPersonDisplayName(c: Customer): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || c.phone || '—';
}

interface PeopleSidebarProps {
  selectedPersonId: string | null;
  onSelectPerson: (personId: string | null) => void;
  collapsed?: boolean;
}

function getPersonInitials(c: Customer): string {
  const name = getPersonDisplayName(c);
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '…';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const PeopleSidebar: React.FC<PeopleSidebarProps> = ({ selectedPersonId, onSelectPerson, collapsed }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: customers = [], isLoading } = useCustomersList();

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

  if (collapsed) {
    return (
      <div className="flex flex-col h-full border-r bg-gardens-page/50 w-full min-w-0 shrink-0 items-center py-2">
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectPerson(null)}
            className={`flex items-center justify-center h-9 w-9 rounded-full text-xs hover:bg-gardens-page ${
              selectedPersonId === null ? 'bg-gardens-blu-lt text-gardens-blu-dk font-semibold ring-1 ring-gardens-blu' : ''
            }`}
          >
            <Unlink className="h-4 w-4" />
          </button>
          {isLoading ? (
            <div className="px-2 py-2 text-[11px] text-gardens-txs">Loading…</div>
          ) : (
            filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectPerson(c.id)}
                className={`flex items-center justify-center h-9 w-9 rounded-full text-[11px] font-medium hover:bg-gardens-page ${
                  selectedPersonId === c.id ? 'bg-gardens-blu-lt text-gardens-blu-dk ring-1 ring-gardens-blu' : ''
                }`}
              >
                {getPersonInitials(c)}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r bg-gardens-page/50 w-full min-w-0 shrink-0">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gardens-txs" />
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelectPerson(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page ${
            selectedPersonId === null ? 'bg-gardens-blu-lt text-gardens-blu-dk font-medium' : ''
          }`}
        >
          <Unlink className="h-4 w-4 shrink-0" />
          Unlinked
        </button>
        {isLoading ? (
          <div className="px-3 py-4 text-sm text-gardens-txs">Loading...</div>
        ) : (
          <div className="py-1">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectPerson(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page truncate ${
                  selectedPersonId === c.id ? 'bg-gardens-blu-lt text-gardens-blu-dk font-medium' : ''
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">{getPersonDisplayName(c)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
