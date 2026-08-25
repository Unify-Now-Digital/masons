import React from 'react';
import { Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface ColumnFilterDropdownProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export const ColumnFilterDropdown: React.FC<ColumnFilterDropdownProps> = ({
  options,
  selected,
  onChange,
}) => {
  const active = selected.length > 0;

  const toggle = (value: string, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Filter column"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`ml-1 p-0.5 rounded hover:bg-gardens-page ${active ? 'text-gardens-acc' : 'text-gardens-txm'}`}
        >
          <Filter className={`h-3.5 w-3.5 ${active ? 'fill-current' : ''}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
