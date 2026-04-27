import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useOrganization } from './OrganizationContext';

const STORAGE_PREFIX = 'mason.testData.show.';
const SEARS_MELVIN = 'sears melvin';

export function isTestDataOrg(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === SEARS_MELVIN;
}

interface TestDataContextValue {
  /** True if the current org is the one allowed to seed/clear test data. */
  enabled: boolean;
  /** When false, list hooks should filter `is_test = false`. */
  showTestData: boolean;
  setShowTestData: (next: boolean) => void;
  toggleShowTestData: () => void;
}

const TestDataContext = createContext<TestDataContextValue | null>(null);

export function TestDataProvider({ children }: { children: React.ReactNode }) {
  const { organizationId, organizationName } = useOrganization();
  const enabled = isTestDataOrg(organizationName);

  const storageKey = organizationId ? `${STORAGE_PREFIX}${organizationId}` : null;

  const [showTestData, setShowTestDataState] = useState<boolean>(true);

  // Hydrate from localStorage when org changes.
  useEffect(() => {
    if (!storageKey) {
      setShowTestDataState(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      setShowTestDataState(raw === null ? true : raw === 'true');
    } catch {
      setShowTestDataState(true);
    }
  }, [storageKey]);

  const setShowTestData = useCallback(
    (next: boolean) => {
      setShowTestDataState(next);
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // ignore — visibility will reset next session
        }
      }
    },
    [storageKey]
  );

  const toggleShowTestData = useCallback(() => {
    setShowTestData(!showTestData);
  }, [setShowTestData, showTestData]);

  const value = useMemo<TestDataContextValue>(
    () => ({
      enabled,
      // If this org isn't the test-data org, there shouldn't be is_test rows
      // anyway — but force showTestData true so hooks don't accidentally filter.
      showTestData: enabled ? showTestData : true,
      setShowTestData,
      toggleShowTestData,
    }),
    [enabled, showTestData, setShowTestData, toggleShowTestData]
  );

  return <TestDataContext.Provider value={value}>{children}</TestDataContext.Provider>;
}

export function useTestDataMode(): TestDataContextValue {
  const ctx = useContext(TestDataContext);
  if (!ctx) {
    // When the provider isn't mounted (e.g. unauthenticated routes), default
    // to "show everything", non-enabled.
    return {
      enabled: false,
      showTestData: true,
      setShowTestData: () => {},
      toggleShowTestData: () => {},
    };
  }
  return ctx;
}
