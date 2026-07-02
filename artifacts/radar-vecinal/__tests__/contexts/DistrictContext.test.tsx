import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DistrictProvider, useDistrict } from '@/contexts/DistrictContext';

function TestComponent() {
  const { currentDistrict, province, department } = useDistrict();
  return (
    <div>
      <span data-testid="district">{currentDistrict}</span>
      <span data-testid="province">{province}</span>
      <span data-testid="department">{department}</span>
    </div>
  );
}

describe('DistrictProvider', () => {
  it('provides default district "San Ramón"', async () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('San Ramón');
    });
  });

  it('provides default province "Chanchamayo"', async () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('province')).toHaveTextContent('Chanchamayo');
    });
  });

  it('provides default department "Junín"', async () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('department')).toHaveTextContent('Junín');
    });
  });
});
