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
  if (avatar.kind !== 'initials') {
    return (
      <img
        src={avatar.value}
        alt=""
        className={`shrink-0 rounded-full object-cover select-none ${
          ring ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950 ring-blue-500' : ''
        }`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

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
        ring ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950 ring-blue-500' : ''
      }`}
      style={style}
      aria-hidden
    >
      {avatar.value}
    </div>
  )
}

export const Avatar = memo(AvatarImpl)
