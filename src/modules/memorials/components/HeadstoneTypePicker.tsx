import React from 'react';
import { HEADSTONE_TYPES, type HeadstoneType } from '../constants/headstoneTypes';
import { cn } from '@/shared/lib/utils';

interface HeadstoneTypePickerProps {
  value: string | null;
  onChange: (type: HeadstoneType) => void;
}

export const HeadstoneTypePicker: React.FC<HeadstoneTypePickerProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Select a headstone style to use as the product image
      </p>
      <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {HEADSTONE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:border-primary/50 hover:bg-accent/50',
              value === type.imageUrl
                ? 'border-primary bg-accent'
                : 'border-transparent bg-muted/30'
            )}
          >
            <img
              src={type.imageUrl}
              alt={type.label}
              className="w-full h-20 object-contain rounded"
            />
            <span className="text-[10px] font-medium text-center leading-tight">
              {type.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
