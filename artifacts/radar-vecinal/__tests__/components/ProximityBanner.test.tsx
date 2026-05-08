import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProximityBanner from '@/components/ProximityBanner';

const mockAlerts = [
  {
    id: 'alert-1',
    title: 'Robo en la esquina',
    category: 'robbery',
    distance: 150,
    latitude: -11.1223,
    longitude: -75.3560,
    address: 'Jr. Las Flores 123',
    sector: 'Centro',
  },
];

describe('ProximityBanner', () => {
  it('renders nothing when there are no nearby alerts', () => {
    const { container } = render(
      <ProximityBanner nearbyAlerts={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders alert title and category when alerts exist', () => {
    render(<ProximityBanner nearbyAlerts={mockAlerts} />);
    expect(screen.getByText(/Robo en la esquina/)).toBeInTheDocument();
    expect(screen.getByText(/Robo\/Asalto/)).toBeInTheDocument();
  });

  it('shows distance in meters for short distances', () => {
    render(<ProximityBanner nearbyAlerts={mockAlerts} />);
    expect(screen.getByText(/150 m/)).toBeInTheDocument();
  });

  it('shows a link to the map', () => {
    render(<ProximityBanner nearbyAlerts={mockAlerts} />);
    expect(screen.getByText(/Ver en mapa/)).toBeInTheDocument();
  });

  it('renders +N badge when there are multiple alerts', () => {
    const multipleAlerts = [
      ...mockAlerts,
      {
        id: 'alert-2',
        title: 'Pelea en el parque',
        category: 'fight',
        distance: 300,
        latitude: -11.1240,
        longitude: -75.3570,
        sector: 'Centro',
      },
    ];
    render(<ProximityBanner nearbyAlerts={multipleAlerts} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
