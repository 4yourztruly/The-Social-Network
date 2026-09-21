// Downscales an uploaded picture into a small, center-cropped JPEG data URL
// before it ever touches app state — keeps an avatar/banner a few KB
// instead of letting a multi-MB camera photo bloat the save file/IndexedDB
// (see saveSchema.ts's avatar.value / bannerImage: z.string()).
function fileToCroppedDataUrl(file: File, targetWidth: number, targetHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        const targetRatio = targetWidth / targetHeight
        const sourceRatio = img.width / img.height
        // Center-crop the source to the target aspect ratio first, then
        // scale that crop down to the target pixel size.
        let sw = img.width
        let sh = img.height
        if (sourceRatio > targetRatio) {
          sw = img.height * targetRatio
        } else {
          sh = img.width / targetRatio
        }
        const sx = (img.width - sw) / 2
        const sy = (img.height - sh) / 2

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function fileToAvatarDataUrl(file: File): Promise<string> {
  return fileToCroppedDataUrl(file, 200, 200)
}

// Wider aspect (3:1) to suit a profile banner rather than a square avatar.
export function fileToBannerDataUrl(file: File): Promise<string> {
  return fileToCroppedDataUrl(file, 600, 200)
}
