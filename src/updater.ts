// Verificador de atualização: olha a página "Releases" do repositório no GitHub,
// e se houver versão mais nova baixa o APK e abre o instalador do Android.
// Analogia: o app espia a vitrine da loja; se chegou modelo novo, ele mesmo traz para você instalar.

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';
import { compareVersions } from './lib/version';

export const REPO = 'GardenW55711/Financeiro';

export type UpdateInfo = {
  version: string;
  notes: string;
  apkUrl: string;
  pageUrl: string;
};

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Descobre qual é a versão mais nova publicada.
 * Caminho 1: a página normal do GitHub (github.com/.../releases/latest), que redireciona
 * para a página da versão mais nova. Não tem limite de consultas.
 * Caminho 2 (reserva): a API do GitHub, que tem limite de 60 consultas por hora por
 * endereço de internet. Em internet móvel, muita gente divide o mesmo endereço,
 * então esse limite estoura fácil (foi o que travou o aviso de atualização).
 */
async function latestRelease(): Promise<{ version: string; apkUrl: string; notes: string } | null> {
  const bust = `t=${Date.now()}`;
  try {
    const res = await fetch(`https://github.com/${REPO}/releases/latest?${bust}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const m = String(res.url || '').match(/\/releases\/tag\/v?([0-9][0-9.]*)/i);
    if (res.ok && m) {
      const version = m[1];
      return {
        version,
        apkUrl: `https://github.com/${REPO}/releases/download/v${version}/financeiro-v${version}.apk`,
        notes: '',
      };
    }
  } catch {
    // tenta o caminho 2
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest?${bust}`, {
    headers: { Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache' },
  });
  // 404: ou não há versão publicada, ou o repositório está privado (aí o app não enxerga nada).
  if (res.status === 404) throw new Error('Não encontrei as versões no GitHub. Confira se o repositório Financeiro está público.');
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const rel = await res.json();
  const version = String(rel.tag_name ?? '').replace(/^v/i, '');
  const asset = (rel.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
  if (!version || !asset) return null;
  return { version, apkUrl: String(asset.browser_download_url), notes: String(rel.body ?? '') };
}

/** Retorna os dados da versão nova, ou null se o app já está atualizado. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const rel = await latestRelease();
  if (!rel) return null;
  if (compareVersions(rel.version, currentVersion()) <= 0) return null;
  return {
    version: rel.version,
    notes: rel.notes,
    apkUrl: rel.apkUrl,
    pageUrl: `https://github.com/${REPO}/releases/latest`,
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
