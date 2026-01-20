import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { loadGoogleMapsScript, isGoogleMapsLoaded } from '@/shared/lib/googleMapsLoader';

interface GooglePlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: { address: string; placeId?: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Type definitions for Google Maps Places API
interface AutocompletePrediction {
  description: string;
  place_id?: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteService {
  getPlacePredictions: (
    request: { input: string },
    callback: (predictions: AutocompletePrediction[] | null, status: string) => void
  ) => void;
}

export const GooglePlacesAutocompleteInput: React.FC<GooglePlacesAutocompleteInputProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
}) => {
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [autocompleteService, setAutocompleteService] = useState<AutocompleteService | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Derived runtime flag - check Google Maps availability at render time
  const placesReady = Boolean(window.google?.maps?.places);

  // Load Google Maps script on mount (non-blocking - component renders regardless)
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setScriptLoaded(true); // Trigger re-render to re-evaluate placesReady
      })
      .catch(() => {
        setScriptLoaded(true); // Still trigger re-render even on error
      });
  }, []);

  // Debounced prediction fetching
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // If places not ready or value is empty, clear predictions
    if (!placesReady || !value.trim()) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoadingPredictions(false);
      return;
    }

    // Debounce prediction fetch (250ms)
    debounceTimerRef.current = window.setTimeout(() => {
      // Lazy initialize AutocompleteService if needed
      const service = autocompleteService ?? (() => {
        if (window.google?.maps?.places) {
          const newService = new window.google.maps.places.AutocompleteService() as AutocompleteService;
          setAutocompleteService(newService);
          return newService;
        }
        return null;
      })();

      if (!service) {
        setPredictions([]);
        setIsOpen(false);
        setIsLoadingPredictions(false);
        return;
      }

      setIsLoadingPredictions(true);
      setIsOpen(true); // Open dropdown immediately when fetching (show Loading...)
      service.getPlacePredictions(
        { input: value.trim() },
        (results: AutocompletePrediction[] | null, status: string) => {
          setIsLoadingPredictions(false);
          if (status === 'OK' && results) {
            setPredictions(results);
            setIsOpen(results.length > 0);
          } else {
            setPredictions([]);
            setIsOpen(false);
          }
        }
      );
    }, 250);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, scriptLoaded]); // scriptLoaded triggers re-run when Google Maps becomes available

  // Popover handles outside click automatically, but we keep this for manual control

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle prediction selection
  const handleSelectPrediction = useCallback(
    (prediction: AutocompletePrediction, event: React.MouseEvent) => {
      event.preventDefault(); // Prevent input blur from interfering
      onChange(prediction.description);
      if (onSelect) {
        onSelect({
          address: prediction.description,
          placeId: prediction.place_id,
        });
      }
      setIsOpen(false);
      setPredictions([]);
      // Refocus input after selection
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    [onChange, onSelect]
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div ref={containerRef} className="relative w-full">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={() => {
              // Open dropdown if we have predictions or are loading
              if (predictions.length > 0 || isLoadingPredictions) {
                setIsOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={className}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[var(--radix-popover-trigger-width)] max-h-60 overflow-auto p-0',
          'rounded-md border bg-popover text-popover-foreground shadow-md'
        )}
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing from input
      >
        {isLoadingPredictions && (
          <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
        )}
        {!isLoadingPredictions && predictions.length === 0 && value.trim() && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No suggestions found</div>
        )}
        {!isLoadingPredictions &&
          predictions.map((prediction, index) => (
            <button
              key={prediction.place_id || index}
              type="button"
              onMouseDown={(e) => handleSelectPrediction(prediction, e)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                'cursor-pointer'
              )}
            >
              {prediction.description}
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
};
