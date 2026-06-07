// Web shim: localStorage-backed key-value store, no SQL

const PREFIX = 'r2r2r:setting:';

export async function getDb(): Promise<null> {
  return null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PREFIX + key, value);
  }
}

export async function getSetting(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(PREFIX + key);
}
