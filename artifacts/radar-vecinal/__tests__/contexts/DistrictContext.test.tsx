import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DistrictProvider, useDistrict } from '@/contexts/DistrictContext';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * DistrictContext v2 resuelve el distrito de forma dinámica (catálogo + GPS +
 * selección manual); ya NO existen defaults hardcodeados como "San Ramón".
 * Estos tests mockean el catálogo (`/api/districts`), la geolocalización y
 * `/api/districts/locate` para verificar el comportamiento real.
 */

const CATALOG = [
  { id: 1, slug: 'san-ramon', name: 'San Ramón', province: 'Chanchamayo', department: 'Junín', isActive: true },
  { id: 2, slug: 'la-merced', name: 'La Merced', province: 'Chanchamayo', department: 'Junín', isActive: true },
];

const COORDS = { latitude: -11.12, longitude: -75.35 };

/** Instala un fetch mock que enruta por URL. `locateDistrict` = distrito que
 *  devuelve /districts/locate (null = fuera de cobertura). */
function mockFetch(locateDistrict: (typeof CATALOG)[number] | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/districts/locate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ district: locateDistrict, method: 'exact' }),
      } as Response);
    }
    if (url.startsWith('/api/districts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ districts: CATALOG }),
      } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Mockea navigator.geolocation. `granted=false` simula GPS denegado/no disponible. */
function mockGeolocation(granted: boolean) {
  const getCurrentPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback) => {
      if (granted) success({ coords: COORDS } as GeolocationPosition);
      else error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    },
  );
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
}

function Probe() {
  const { currentDistrict, province, department, districts, needsSelection, setManualDistrict } = useDistrict();
  return (
    <div>
      <span data-testid="district">{currentDistrict}</span>
      <span data-testid="province">{province}</span>
      <span data-testid="department">{department}</span>
      <span data-testid="count">{districts.length}</span>
      <span data-testid="needs">{String(needsSelection)}</span>
      <button onClick={() => setManualDistrict('la-merced')}>manual</button>
    </div>
  );
}

function renderWithProviders() {
  return render(
    <AuthProvider>
      <DistrictProvider>
        <Probe />
      </DistrictProvider>
    </AuthProvider>,
  );
}

describe('DistrictProvider v2', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('carga el catálogo de distritos desde /api/districts', async () => {
    mockFetch(null);
    mockGeolocation(false);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  it('resuelve el distrito por geolocalización (nombre, provincia, departamento)', async () => {
    mockFetch(CATALOG[0]); // /locate devuelve San Ramón
    mockGeolocation(true);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('San Ramón');
    });
    expect(screen.getByTestId('province')).toHaveTextContent('Chanchamayo');
    expect(screen.getByTestId('department')).toHaveTextContent('Junín');
  });

  it('sin ubicación ni selección: distrito vacío y needsSelection=true', async () => {
    mockFetch(null);
    mockGeolocation(false); // GPS denegado → sin distrito detectado
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByTestId('needs')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('district')).toHaveTextContent('');
  });

  it('permite elegir un distrito manualmente y lo activa', async () => {
    mockFetch(null);
    mockGeolocation(false);
    renderWithProviders();
    // Esperar a que el catálogo esté cargado antes de la selección manual
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
    fireEvent.click(screen.getByText('manual'));
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('La Merced');
    });
    expect(localStorage.getItem('radarvecinal_manual_district_slug')).toBe('la-merced');
  });
});
