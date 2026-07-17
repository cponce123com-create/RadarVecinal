/**
 * voiceClips.ts — Clips de voz de los avisos (grabados por el superadmin).
 *
 * Cada distrito puede tener un audio por tipo de servicio ("Vecino, la tamalera
 * está cerca") para que el aviso suene con la voz/acento locales en vez del TTS.
 */
import { customFetch } from "@workspace/api-client-react";
import type { LiveProviderType } from "./liveProviders";

export interface VoiceClip {
  id: string;
  type: LiveProviderType;
  audioUrl: string | null;
  phrase: string;
  enabled: boolean;
  updatedAt: string;
}

export async function listVoiceClips(districtId: number): Promise<VoiceClip[]> {
  const data = await customFetch<{ clips: VoiceClip[] }>(`/api/live/voice-clips?districtId=${districtId}`);
  return data.clips ?? [];
}

export async function upsertVoiceClip(body: {
  type: LiveProviderType;
  audioUrl?: string | null;
  phrase?: string;
  enabled?: boolean;
  districtId?: number;
}): Promise<VoiceClip> {
  return customFetch<VoiceClip>(`/api/live/voice-clips`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteVoiceClip(id: string): Promise<void> {
  await customFetch(`/api/live/voice-clips/${id}`, { method: "DELETE" });
}
