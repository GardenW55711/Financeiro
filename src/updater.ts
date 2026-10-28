// Verificador de atualização: olha a página "Releases" do repositório no GitHub,
// e se houver versão mais nova baixa o APK e abre o instalador do Android.
// Analogia: o app espia a vitrine da loja; se chegou modelo novo, ele mesmo traz para você instalar.

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';
import { compareVersions } from './lib/version';

export const REPO = 'GardenW55711/financeiro';

export type UpdateInfo = {
  version: string;
  notes: string;
  apkUrl: string;
  pageUrl: string;
};

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Retorna os dados da versão nova, ou null se o app já está atualizado. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null; // ainda não há nenhuma versão publicada
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const rel = await res.json();
  const version = String(rel.tag_name ?? '').replace(/^v/i, '');
  const asset = (rel.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
  if (!version || !asset) return null;
  if (compareVersions(version, currentVersion()) <= 0) return null;
  return {
    version,
    notes: String(rel.body ?? ''),
    apkUrl: String(asset.browser_download_url),
    pageUrl: String(rel.html_url ?? `https://github.com/${REPO}/releases`),
  };
}

/** Baixa o APK e abre a tela de instalação. onProgress recebe de 0 a 1. */
export async function downloadAndInstall(info: UpdateInfo, onProgress?: (p: number) => void): Promise<void> {
  const dest = `${FileSystem.cacheDirectory}financeiro-v${info.version}.apk`;
  try {
    const dl = FileSystem.createDownloadResumable(info.apkUrl, dest, {}, (p) => {
      if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    });
    const result = await dl.downloadAsync();
    if (!result || result.status !== 200) throw new Error('download falhou');
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION: deixa o instalador ler o arquivo
      type: 'application/vnd.android.package-archive',
    });
  } catch {
    // Plano B: abre o link no navegador, que baixa o APK normalmente
    await Linking.openURL(info.apkUrl);
  }
}
