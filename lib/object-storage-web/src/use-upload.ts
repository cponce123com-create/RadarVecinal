import { useState, useCallback } from "react";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  /** URL pública final de la imagen (Cloudinary secure_url). */
  objectPath: string;
  /** Alias explícito de la URL pública. */
  secureUrl: string;
  publicId?: string;
  metadata: UploadMetadata;
}

/** Parámetros firmados que devuelve el backend para el upload a Cloudinary. */
interface SignedUpload {
  uploadURL: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  cloudName: string;
  folder: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  /** Base path donde están montadas las rutas de storage (default "/api/storage"). */
  basePath?: string;
  /**
   * Devuelve el token JWT actual para autenticar la petición de subida.
   * El endpoint `/uploads/request-url` requiere autenticación.
   */
  getAuthToken?: () => string | null | undefined;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook de subida de imágenes con Cloudinary (upload firmado):
 *   1. Pide al backend los parámetros firmados (JSON, con Authorization).
 *   2. Sube el archivo directamente a Cloudinary vía multipart POST firmado.
 *   3. Devuelve la `secure_url` real de la imagen.
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const requestSignedUpload = useCallback(
    async (file: File): Promise<SignedUpload> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = options.getAuthToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Debes iniciar sesión para subir fotos.");
        }
        throw new Error(
          data.error || "No se pudo iniciar la subida de la imagen.",
        );
      }

      return response.json();
    },
    [basePath, options],
  );

  const uploadToCloudinary = useCallback(
    async (
      file: File,
      signed: SignedUpload,
    ): Promise<{ secureUrl: string; publicId?: string }> => {
      // Cloudinary exige un multipart POST con los parámetros firmados
      // (file + api_key + timestamp + signature + folder), que deben coincidir
      // exactamente con lo firmado en el servidor.
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("signature", signed.signature);
      form.append("folder", signed.folder);

      const response = await fetch(signed.uploadURL, {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error?.message || "Error al subir la imagen al almacenamiento.",
        );
      }

      return {
        secureUrl: data.secure_url as string,
        publicId: data.public_id as string | undefined,
      };
    },
    [],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const signed = await requestSignedUpload(file);

        setProgress(35);
        const { secureUrl, publicId } = await uploadToCloudinary(file, signed);

        setProgress(100);
        const response: UploadResponse = {
          objectPath: secureUrl,
          secureUrl,
          publicId,
          metadata: signed.metadata,
        };
        options.onSuccess?.(response);
        return response;
      } catch (err) {
        const uploadErr =
          err instanceof Error ? err : new Error("Upload failed");
        setError(uploadErr);
        options.onError?.(uploadErr);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestSignedUpload, uploadToCloudinary, options],
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}

export type { UploadResponse };
