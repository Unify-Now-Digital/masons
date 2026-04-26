import React from 'react';

interface TestPillProps {
  isTest: boolean | null | undefined;
  className?: string;
}

/**
 * Renders an inline "TEST" pill when the row is flagged is_test.
 * Lets staff quickly distinguish demo data from real data while
 * pre-launch test rows mingle with production rows in lists/maps.
 */
export const TestPill: React.FC<TestPillProps> = ({ isTest, className }) => {
  if (!isTest) return null;
  return (
    <span
      title="Test data — will be removed by 'Clear test data'"
      className={
        'inline-flex items-center px-1 py-px rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300 leading-none ' +
        (className ?? '')
      }
    >
      Test
    </span>
  );
};
