export type SimulatedDevicePlatform = 'desktop' | 'android' | 'apple';
export type SimulatedDisplayMode = 'pwa' | 'browser';
export type SimulatedBrowserType = 'safari' | 'chrome';

let runtimeSimulatedDevice: SimulatedDevicePlatform | null = null;

export function setRuntimeSimulatedDevice(device: SimulatedDevicePlatform | null) {
  runtimeSimulatedDevice = device;
}

function getSearchParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

export function getSimulatedDeviceFromUrl(): SimulatedDevicePlatform | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = (params.get('simulaDevice') || '').toLowerCase().trim();
  if (raw === 'android') return 'android';
  if (raw === 'apple' || raw === 'ios') return 'apple';
  return null;
}

export function getSimulatedAccountIdFromUrl(): string | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = (params.get('simulaAccount') || '').trim();
  return raw || null;
}

export function getSimulatedRoleFromUrl(): 'admin' | 'volontario' | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = (params.get('simulaRuolo') || '').toLowerCase().trim();
  if (raw === 'admin' || raw === 'centrale') return 'admin';
  if (raw === 'volontario' || raw === 'bordo') return 'volontario';
  return null;
}

export function getSimulatedDisplayModeFromUrl(): SimulatedDisplayMode | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = (params.get('simulaWeb') || '').trim();
  if (raw === '1' || raw === 'true') return 'browser';
  if (raw === '0' || raw === 'false') return 'pwa';
  return null;
}

export function getSimulatedBrowserFromUrl(): SimulatedBrowserType | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = (params.get('simulaBrowser') || '').toLowerCase().trim();
  if (raw === 'chrome') return 'chrome';
  if (raw === 'safari') return 'safari';
  return null;
}

export function isInsideDeviceSimulationFrame(): boolean {
  const params = getSearchParams();
  if (!params) return false;
  return params.get('simulaFrame') === '1' && getSimulatedDeviceFromUrl() !== null;
}

export function getEffectiveSimulatedDevice(): SimulatedDevicePlatform | null {
  const fromUrl = getSimulatedDeviceFromUrl();
  if (fromUrl) return fromUrl;
  return runtimeSimulatedDevice;
}

export function buildDeviceSimulationIframeUrl(options: {
  accountId: string;
  device: 'android' | 'apple';
  ruolo: 'admin' | 'volontario';
  displayMode: SimulatedDisplayMode;
  browser?: SimulatedBrowserType;
}): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('simulaFrame', '1');
  url.searchParams.set('simulaAccount', options.accountId);
  url.searchParams.set('simulaDevice', options.device);
  url.searchParams.set('simulaRuolo', options.ruolo);
  url.searchParams.set('simulaWeb', options.displayMode === 'browser' ? '1' : '0');
  if (options.displayMode === 'browser') {
    const effectiveBrowser: SimulatedBrowserType =
      options.browser || (options.device === 'apple' ? 'safari' : 'chrome');
    url.searchParams.set('simulaBrowser', effectiveBrowser);
  }
  return url.toString();
}
