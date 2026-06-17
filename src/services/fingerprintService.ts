import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise = FingerprintJS.load();

export async function getDeviceId(): Promise<string> {
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}
