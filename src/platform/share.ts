/** Share a PNG blob through the native sheet, or download on web. */
export async function sharePng(blob: Blob, title: string, filename: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/png" })] })) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      await navigator.share({ title, files: [file] });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
