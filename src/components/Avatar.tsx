import { memo } from 'react'
import type { Avatar as AvatarType } from '../types'
import { paletteFor } from './avatarColors'

interface AvatarProps {
  avatar: AvatarType
  seed: string
  size?: number
  ring?: boolean
}

function AvatarImpl({ avatar, seed, size = 44, ring = false }: AvatarProps) {
  const { h1, h2, h3, angle } = paletteFor(seed)
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.38,
    background: `linear-gradient(${angle}deg, hsl(${h1} 75% 42%), hsl(${h2} 70% 48%) 55%, hsl(${h3} 72% 40%))`,
    textShadow: '0 1px 3px rgba(0,0,0,0.35)',
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none ${
        ring ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950 ring-fuchsia-500' : ''
      }`}
      style={style}
      aria-hidden
    >
      {avatar.kind === 'initials' ? avatar.value : null}
    </div>
  )
}

export const Avatar = memo(AvatarImpl)
