import JSZip from "jszip";
import { buildPersonalDataExport } from "./data-export-bundle";

export async function buildPersonalDataZip(
  userId: string,
  orgId: number,
): Promise<Buffer> {
  const bundle = await buildPersonalDataExport(userId, orgId);
  const zip = new JSZip();
  zip.file("export.json", JSON.stringify(bundle, null, 2));
  zip.file(
    "readme.txt",
    "Jiganto personal data export\nGenerated: " + bundle.exportedAt + "\n",
  );
  const content = await zip.generateAsync({ type: "nodebuffer" });
  return content;
}
