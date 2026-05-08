import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DistrictProvider, useDistrict } from '@/contexts/DistrictContext';

function TestComponent() {
  const { district, province, department } = useDistrict();
  return (
    <div>
      <span data-testid="district">{district}</span>
      <span data-testid="province">{province}</span>
      <span data-testid="department">{department}</span>
    </div>
  );
}

describe('DistrictProvider', () => {
  it('provides default district "San Ramón"', () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    expect(screen.getByTestId('district')).toHaveTextContent('San Ramón');
  });

  it('provides default province "Chanchamayo"', () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    expect(screen.getByTestId('province')).toHaveTextContent('Chanchamayo');
  });

  it('provides default department "Junín"', () => {
    render(
      <DistrictProvider>
        <TestComponent />
      </DistrictProvider>,
    );
    expect(screen.getByTestId('department')).toHaveTextContent('Junín');
  });

  it('provides default values when used outside DistrictProvider (context defaults)', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('district')).toHaveTextContent('San Ramón');
  });
});
