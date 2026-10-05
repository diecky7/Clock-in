/**
 * Opens the iOS share sheet for a file. If sharing is unavailable, or iOS refuses it (it can once the tap is
 * no longer "fresh" after slow work such as building a PDF), the file is saved as a download instead.
 * Resolves quietly when the user dismisses the share sheet.
 */
export async function shareOrDownload(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      // Any other refusal (e.g. NotAllowedError): fall through to the download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
