import { fetchWithAuth } from "./queryClient";

/** Upload an image for the document editor; returns the public URL path. */
export async function uploadDocumentImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetchWithAuth("/api/documents/upload-image", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return null;
    const { url } = (await res.json()) as { url: string };
    return url;
  } catch {
    return null;
  }
}
