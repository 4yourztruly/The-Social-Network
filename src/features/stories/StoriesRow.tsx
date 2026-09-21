import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { PlusIcon } from '../../components/icons'
import { shortNameFor } from '../../components/shortName'
import { useActiveStoryAuthors } from './useActiveStoryAuthors'

interface StoriesRowProps {
  viewedAuthorIds: ReadonlySet<string>
  onOpenStories: (authorId: string) => void
  onAddStory: () => void
}

export function StoriesRow({ viewedAuthorIds, onOpenStories, onAddStory }: StoriesRowProps) {
  const profiles = useGameStore((s) => s.profiles)
  const authorIds = useActiveStoryAuthors(viewedAuthorIds)

  const playerProfile = profiles[PLAYER_ID]
  const playerHasStory = authorIds.includes(PLAYER_ID)

  if (authorIds.length === 0 && !playerProfile) return null

  return (
    <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      {!playerHasStory && playerProfile && (
        <button onClick={onAddStory} className="flex shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <Avatar avatar={playerProfile.avatar} seed={playerProfile.id} size={56} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-2 ring-white dark:ring-neutral-950">
              <PlusIcon className="h-2.5 w-2.5 text-white" />
            </span>
          </div>
          <span className="w-16 truncate text-center text-[11px] text-neutral-500">Your story</span>
        </button>
      )}
      {authorIds.map((authorId) => {
        const author = profiles[authorId]
        if (!author) return null
        const viewed = viewedAuthorIds.has(authorId)
        return (
          <button
            key={authorId}
            onClick={() => onOpenStories(authorId)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <div
              className={`rounded-full p-[2px] ${
                viewed
                  ? 'bg-neutral-300 dark:bg-neutral-700'
                  : 'bg-gradient-to-tr from-amber-400 via-blue-500 to-sky-500'
              }`}
            >
              <div className="rounded-full bg-white p-[2px] dark:bg-neutral-950">
                <Avatar avatar={author.avatar} seed={author.id} size={56} />
              </div>
            </div>
            <span className="w-16 truncate text-center text-[11px] text-neutral-500">
              {authorId === PLAYER_ID ? 'You' : (isNPC(author) ? shortNameFor(author.displayName) : author.displayName)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
