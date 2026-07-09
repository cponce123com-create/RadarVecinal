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

/** Mockea navigator.geolocation. `granted=false` simula GPS denegado/no disponible.
 *  DistrictContext usa watchPosition (refina el distrito según mejora la precisión). */
function mockGeolocation(granted: boolean) {
  const watchPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback) => {
      if (granted) success({ coords: { ...COORDS, accuracy: 20 } } as GeolocationPosition);
      else error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      return 1;
    },
  );
  const clearWatch = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch },
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

  it('OBVIA el fix impreciso: resuelve el distrito con el fix preciso, en una sola consulta', async () => {
    // /locate resuelve por longitud: oeste (~-75.5) = San Ramón, este (~-77.0) = La Merced (simulado)
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/districts/locate')) {
        const lng = Number(new URLSearchParams(url.split('?')[1]).get('lng'));
        const district = lng < -76 ? CATALOG[1] : CATALOG[0];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ district, method: 'exact' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ districts: CATALOG }),
      } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    // watchPosition emite primero un fix impreciso (de red, distrito equivocado)
    // y luego el fino. El impreciso NO debe generar consulta ni pintarse.
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: -11.1, longitude: -75.5, accuracy: 3000 } } as GeolocationPosition);
      success({ coords: { latitude: -11.1, longitude: -77.0, accuracy: 20 } } as GeolocationPosition);
      return 1;
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch: vi.fn() },
    });

    renderWithProviders();
    // Termina en el distrito del fix preciso…
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('La Merced');
    });
    // …y el fix impreciso nunca llegó a consultarse (una sola llamada a /locate)
    const locateCalls = fetchMock.mock.calls
      .map(c => (typeof c[0] === 'string' ? c[0] : String(c[0])))
      .filter(u => u.startsWith('/api/districts/locate'));
    expect(locateCalls).toHaveLength(1);
    expect(locateCalls[0]).toContain('lng=-77');
  });

  it('el GPS de hoy gana a la selección persistida de una sesión anterior', async () => {
    // Sesión anterior dejó activo/manual = La Merced, pero hoy el GPS
    // resuelve San Ramón → el encabezado debe mostrar San Ramón.
    localStorage.setItem('radarvecinal_manual_district_slug', 'la-merced');
    localStorage.setItem('radarvecinal_active_district_slug', 'la-merced');
    mockFetch(CATALOG[0]); // /locate → San Ramón
    mockGeolocation(true);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('San Ramón');
    });
  });

  it('sin GPS, mantiene el último distrito mostrado (persistido) en vez de quedar vacío', async () => {
    localStorage.setItem('radarvecinal_active_district_slug', 'la-merced');
    mockFetch(null);
    mockGeolocation(false); // GPS denegado
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByTestId('district')).toHaveTextContent('La Merced');
    });
    expect(screen.getByTestId('needs')).toHaveTextContent('false');
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
