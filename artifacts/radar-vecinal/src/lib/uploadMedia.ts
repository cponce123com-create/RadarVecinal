/**
 * uploadMedia — sube una imagen o nota de voz a Cloudinary con firma del
 * servidor y devuelve la `secure_url`.
 *
 * Reemplaza el flujo anterior roto (PUT sin firma ni token). Requiere sesión
 * (el endpoint request-url es requireAuth).
 */
export async function uploadMedia(
  file: File | Blob,
  kind: "image" | "audio",
  filename?: string,
): Promise<string> {
  const token = localStorage.getItem("radarvecinal_token");
  const name = filename ?? (file instanceof File ? file.name : `nota-${Date.now()}`);

  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, size: file.size, contentType: file.type, kind }),
  });
  if (!res.ok) {
    let msg = "No se pudo iniciar la subida.";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* respuesta no-JSON */
    }
    throw new Error(msg);
  }

  const { uploadURL, apiKey, timestamp, signature, folder } = await res.json();
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const up = await fetch(uploadURL, { method: "POST", body: form });
  if (!up.ok) throw new Error("Error al subir el archivo.");
  const data = await up.json();
  if (!data.secure_url) throw new Error("Respuesta de subida inválida.");
  return data.secure_url as string;
}
