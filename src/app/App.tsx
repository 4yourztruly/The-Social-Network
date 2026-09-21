import { useState } from 'react'
import { useTheme } from './useTheme'
import { usePersistence } from './usePersistence'
import { useSchedulerTick } from './useSchedulerTick'
import { BottomNav, type Screen } from './BottomNav'
import { SidebarNav } from './SidebarNav'
import { Feed } from '../features/feed/Feed'
import { ActivityScreen } from '../features/activity/Activity'
import { People } from '../features/people/People'
import { Profile } from '../features/profile/Profile'
import { Settings } from '../features/settings/Settings'
import { Compose } from '../features/compose/Compose'
import { DMs } from '../features/dm/DMs'
import { DMThread } from '../features/dm/DMThread'
import { Notifications } from '../features/notifications/Notifications'
import { PostThread } from '../features/thread/PostThread'
import { Onboarding } from '../features/onboarding/Onboarding'
import { StoriesRow } from '../features/stories/StoriesRow'
import { StoryViewer } from '../features/stories/StoryViewer'
import { AddStory } from '../features/stories/AddStory'
import { EventButton } from '../features/event/EventButton'
import { EventModal } from '../features/event/EventModal'
import { PLAYER_ID, useGameStore, type PostOutcome } from '../store/gameStore'
import { PeopleIcon } from '../components/icons'
import { OutcomeBanner } from '../components/OutcomeBanner'
import { isNPC } from '../types'
import { isViewableProfile } from '../engine/npcTier'

export default function App() {
  useTheme()
  usePersistence()
  useSchedulerTick()

  const onboarded = useGameStore((s) => s.onboarded)
  const clock = useGameStore((s) => s.clock)
  const profiles = useGameStore((s) => s.profiles)
  const dayNumber = Math.max(1, Math.floor((Date.now() - clock) / (24 * 60 * 60 * 1000)) + 1)

  const [screen, setScreen] = useState<Screen>('feed')
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [viewingPostId, setViewingPostId] = useState<string | null>(null)
  const [viewingDmNpcId, setViewingDmNpcId] = useState<string | null>(null)
  const [viewingStoryAuthorId, setViewingStoryAuthorId] = useState<string | null>(null)
  const [showAddStory, setShowAddStory] = useState(false)
  const [viewedStoryAuthorIds, setViewedStoryAuthorIds] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [postOutcome, setPostOutcome] = useState<PostOutcome | null>(null)

  if (!onboarded) {
    return (
      <div
        className="mx-auto flex w-full max-w-xl flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ height: '100dvh' }}
      >
        <Onboarding />
      </div>
    )
  }

  // Only one overlay renders at a time (see the priority chain below), so
  // navigating to a new one must clear whichever overlay is currently
  // active — otherwise the state updates but the old overlay keeps
  // rendering on top of it and the navigation silently does nothing.
  //
  // Commenter-tier NPCs (the general public — see engine/npcTier.ts) have
  // no viewable profile at all: they only ever comment/reply. Every profile
  // navigation in the app funnels through this one handler, so gating it
  // here is enough — no need to also disable the click affordance in every
  // individual component that renders an author name/avatar.
  const handleOpenProfile = (profileId: string) => {
    const target = profiles[profileId]
    if (target && isNPC(target) && !isViewableProfile(target)) return
    setViewingPostId(null)
    setViewingDmNpcId(null)
    setShowPeople(false)
    setViewingProfileId(profileId)
  }
  const handleOpenThread = (postId: string) => {
    setViewingProfileId(null)
    setViewingDmNpcId(null)
    setShowPeople(false)
    setViewingPostId(postId)
  }
  const handleOpenDM = (npcId: string) => {
    setViewingProfileId(null)
    setViewingPostId(null)
    setShowPeople(false)
    setViewingDmNpcId(npcId)
  }
  const handleMarkStoryViewed = (authorId: string) =>
    setViewedStoryAuthorIds((prev) => (prev.has(authorId) ? prev : new Set(prev).add(authorId)))

  const handleNavigate = (next: Screen) => {
    setViewingProfileId(null)
    setViewingPostId(null)
    setViewingDmNpcId(null)
    setShowSettings(false)
    setShowPeople(false)
    setScreen(next)
  }

  const handlePosted = (outcome: PostOutcome) => {
    setScreen('feed')
    setPostOutcome(outcome)
  }

  let overlay: React.ReactNode = null
  if (showSettings) {
    overlay = <Settings onBack={() => setShowSettings(false)} />
  } else if (viewingDmNpcId !== null) {
    overlay = (
      <DMThread npcId={viewingDmNpcId} onOpenProfile={handleOpenProfile} onBack={() => setViewingDmNpcId(null)} />
    )
  } else if (viewingPostId !== null) {
    overlay = (
      <PostThread postId={viewingPostId} onOpenProfile={handleOpenProfile} onBack={() => setViewingPostId(null)} />
    )
  } else if (viewingProfileId !== null) {
    overlay = (
      <Profile
        profileId={viewingProfileId}
        onOpenProfile={handleOpenProfile}
        onOpenThread={handleOpenThread}
        onOpenDM={handleOpenDM}
        onBack={() => setViewingProfileId(null)}
        onOpenSettings={() => setShowSettings(true)}
      />
    )
  } else if (showPeople) {
    overlay = <People onOpenProfile={handleOpenProfile} onOpenDM={handleOpenDM} onBack={() => setShowPeople(false)} />
  }

  return (
    <div
      className="relative mx-auto flex w-full max-w-xl overflow-hidden md:max-w-4xl"
      style={{ height: '100dvh' }}
    >
      <SidebarNav screen={screen} onNavigate={handleNavigate} />

      <div
        className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 md:border-x md:border-neutral-200 md:dark:border-neutral-800"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {postOutcome && (
          <div className="absolute inset-x-0 z-50" style={{ top: 'env(safe-area-inset-top)' }}>
            <OutcomeBanner outcome={postOutcome} onDismiss={() => setPostOutcome(null)} />
          </div>
        )}

        {viewingStoryAuthorId !== null && (
          <StoryViewer
            authorId={viewingStoryAuthorId}
            viewedAuthorIds={viewedStoryAuthorIds}
            onMarkViewed={handleMarkStoryViewed}
            onChangeAuthor={setViewingStoryAuthorId}
            onClose={() => setViewingStoryAuthorId(null)}
          />
        )}
        {showAddStory && (
          <AddStory onBack={() => setShowAddStory(false)} onPosted={() => setShowAddStory(false)} />
        )}

        {!overlay && screen === 'feed' && <EventButton />}
        <EventModal onOpenProfile={handleOpenProfile} />

        <main className="min-h-0 flex-1">
          {overlay ?? (
            <>
              {screen === 'feed' && (
                <div className="flex h-full flex-col">
                  <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-bold">Home</h1>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        Day {dayNumber}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPeople(true)}
                      aria-label="People"
                      className="cursor-pointer rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <PeopleIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <StoriesRow
                    viewedAuthorIds={viewedStoryAuthorIds}
                    onOpenStories={setViewingStoryAuthorId}
                    onAddStory={() => setShowAddStory(true)}
                  />
                  <div className="min-h-0 flex-1">
                    <Feed onOpenProfile={handleOpenProfile} onOpenThread={handleOpenThread} />
                  </div>
                </div>
              )}
              {screen === 'activity' && <ActivityScreen onOpenProfile={handleOpenProfile} />}
              {screen === 'compose' && <Compose onPosted={handlePosted} />}
              {screen === 'dms' && <DMs onOpenThread={handleOpenDM} />}
              {screen === 'notifications' && (
                <Notifications onOpenProfile={handleOpenProfile} onOpenThread={handleOpenThread} />
              )}
              {screen === 'profile' && (
                <Profile
                  profileId={PLAYER_ID}
                  onOpenProfile={handleOpenProfile}
                  onOpenThread={handleOpenThread}
                  onOpenSettings={() => setShowSettings(true)}
                />
              )}
            </>
          )}
        </main>
        <div className="md:hidden">
          <BottomNav screen={screen} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  )
}
