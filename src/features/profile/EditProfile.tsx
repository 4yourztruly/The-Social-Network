import { useRef, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { Avatar } from '../../components/Avatar'
import { fileToAvatarDataUrl, fileToBannerDataUrl } from '../../components/imageUpload'
import { ArrowLeftIcon } from '../../components/icons'
import type { Avatar as AvatarType } from '../../types'

interface EditProfileProps {
  onBack: () => void
}

// Name, bio, avatar and banner — the fields shown editable in the
// reference's "Edit Profile" flow. Images are downscaled client-side
// (imageUpload.ts) before they ever touch app state, same as a custom
// person's uploaded avatar in Settings.
export function EditProfile({ onBack }: EditProfileProps) {
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const updatePlayerProfile = useGameStore((s) => s.updatePlayerProfile)

  const [displayName, setDisplayName] = useState(player?.displayName ?? '')
  const [bio, setBio] = useState(player?.bio ?? '')
  const [avatar, setAvatar] = useState<AvatarType | undefined>(player?.avatar)
  const [bannerImage, setBannerImage] = useState<string | undefined>(player?.bannerImage)
  const [error, setError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  if (!player) return null

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatar({ kind: 'webp', value: dataUrl })
    } catch {
      setError("Couldn't use that picture — try a different one.")
    }
  }

  const handleBannerFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await fileToBannerDataUrl(file)
      setBannerImage(dataUrl)
    } catch {
      setError("Couldn't use that picture — try a different one.")
    }
  }

  const handleSave = () => {
    if (!displayName.trim()) {
      setError('Give yourself a name first.')
      return
    }
    updatePlayerProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatar,
      bannerImage,
    })
    onBack()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold">Edit Profile</h1>
        <button
          onClick={handleSave}
          className="cursor-pointer rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Save
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <button
          onClick={() => bannerInputRef.current?.click()}
          aria-label="Change banner"
          className="group relative block h-32 w-full cursor-pointer bg-gradient-to-r from-blue-600/70 to-sky-600/70 bg-cover bg-center"
          style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
        >
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change banner
          </span>
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleBannerFile(e.target.files?.[0])}
        />

        <div className="px-4">
          <button
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Change photo"
            className="group relative -mt-10 block cursor-pointer rounded-full ring-4 ring-white dark:ring-neutral-900"
          >
            {avatar && <Avatar avatar={avatar} seed={player.id} size={80} />}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarFile(e.target.files?.[0])}
          />

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[15px] outline-none dark:border-neutral-700"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              rows={3}
              className="resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[15px] outline-none dark:border-neutral-700"
            />
          </label>

          {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
