import { useEffect, useState } from 'react'
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
import { PLAYER_ID, useGameStore } from '../store/gameStore'
import { PeopleIcon } from '../components/icons'
import { OutcomeBanner } from '../components/OutcomeBanner'
import { isNPC } from '../types'
import { isViewableProfile } from '../engine/npcTier'

export default function App() {
  useTheme()
  usePersistence()
  useSchedulerTick()

  const onboarded = useGameStore((s) => s.onboarded)
  const dayNumber = useGameStore((s) => s.gameDay)
  const profiles = useGameStore((s) => s.profiles)

  const [screen, setScreen] = useState<Screen>('feed')
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [viewingPostId, setViewingPostId] = useState<string | null>(null)
  const [viewingDmNpcId, setViewingDmNpcId] = useState<string | null>(null)
  const [viewingStoryAuthorId, setViewingStoryAuthorId] = useState<string | null>(null)
  const [showAddStory, setShowAddStory] = useState(false)
  const [viewedStoryAuthorIds, setViewedStoryAuthorIds] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const lastOutcomeReport = useGameStore((s) => s.lastOutcomeReport)
  const dismissOutcomeReport = useGameStore((s) => s.dismissOutcomeReport)

  // App never remounts across an onboarding reset (Settings > "Start a new
  // profile"), so all this local nav/overlay state otherwise survives it —
  // most visibly, finishing a fresh onboarding while showSettings was still
  // true from before the reset landed the player back on Settings instead
  // of the feed. Every completed/re-completed onboarding should always open
  // on a clean home feed.
  useEffect(() => {
    if (!onboarded) return
    setScreen('feed')
    setShowSettings(false)
    setShowPeople(false)
    setViewingProfileId(null)
    setViewingPostId(null)
    setViewingDmNpcId(null)
    setViewingStoryAuthorId(null)
    setShowAddStory(false)
  }, [onboarded])

  if (!onboarded) {
    return (
      <div
        className="fixed inset-0 mx-auto flex max-w-xl flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
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
  // Unmounting a screen while one of its inputs still has focus (e.g.
  // Compose's caption box, autoFocused) leaves an iOS WKWebView's on-screen
  // keyboard mid-dismiss with nothing left to blur, which can visibly glitch
  // its close animation. Blurring explicitly, before the screen swap, gives
  // it a normal close to finish against instead of vanishing out from
  // under it. (The bottom nav itself no longer depends on any of this —
  // see the shell's `fixed inset-0` below.)
  const blurActiveElement = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  const handleOpenProfile = (profileId: string) => {
    const target = profiles[profileId]
    if (target && isNPC(target) && !isViewableProfile(target)) return
    blurActiveElement()
    setViewingPostId(null)
    setViewingDmNpcId(null)
    setShowPeople(false)
    setViewingProfileId(profileId)
  }
  const handleOpenThread = (postId: string) => {
    blurActiveElement()
    setViewingProfileId(null)
    setViewingDmNpcId(null)
    setShowPeople(false)
    setViewingPostId(postId)
  }
  const handleOpenDM = (npcId: string) => {
    blurActiveElement()
    setViewingProfileId(null)
    setViewingPostId(null)
    setShowPeople(false)
    setViewingDmNpcId(npcId)
  }
  const handleMarkStoryViewed = (authorId: string) =>
    setViewedStoryAuthorIds((prev) => (prev.has(authorId) ? prev : new Set(prev).add(authorId)))

  const handleNavigate = (next: Screen) => {
    blurActiveElement()
    setViewingProfileId(null)
    setViewingPostId(null)
    setViewingDmNpcId(null)
    setShowSettings(false)
    setShowPeople(false)
    setScreen(next)
  }

  const handlePosted = () => {
    blurActiveElement()
    setScreen('feed')
  }

  const handleBack = (dismiss: () => void) => () => {
    blurActiveElement()
    dismiss()
  }

  let overlay: React.ReactNode = null
  if (showSettings) {
    overlay = <Settings onBack={handleBack(() => setShowSettings(false))} />
  } else if (viewingDmNpcId !== null) {
    overlay = (
      <DMThread npcId={viewingDmNpcId} onOpenProfile={handleOpenProfile} onBack={handleBack(() => setViewingDmNpcId(null))} />
    )
  } else if (viewingPostId !== null) {
    overlay = (
      <PostThread postId={viewingPostId} onOpenProfile={handleOpenProfile} onBack={handleBack(() => setViewingPostId(null))} />
    )
  } else if (viewingProfileId !== null) {
    overlay = (
      <Profile
        profileId={viewingProfileId}
        onOpenProfile={handleOpenProfile}
        onOpenThread={handleOpenThread}
        onOpenDM={handleOpenDM}
        onBack={handleBack(() => setViewingProfileId(null))}
        onOpenSettings={() => setShowSettings(true)}
      />
    )
  } else if (showPeople) {
    overlay = <People onOpenProfile={handleOpenProfile} onOpenDM={handleOpenDM} onBack={handleBack(() => setShowPeople(false))} />
  }

  return (
    <>
      {/* TEMPORARY diagnostic markers — not a fix, just to see exactly
          where things actually land on a real device. Remove once we know. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 12, background: 'red', zIndex: 99999 }} />
      <div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 12, background: 'blue', zIndex: 99999 }} />
      <div className="fixed inset-0 mx-auto flex max-w-xl overflow-hidden border-4 border-lime-400 md:max-w-4xl">
        <SidebarNav screen={screen} onNavigate={handleNavigate} />

      <div
        className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 md:border-x md:border-neutral-200 md:dark:border-neutral-800"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {lastOutcomeReport && (
          <div className="absolute inset-x-0 z-50" style={{ top: 'env(safe-area-inset-top)' }}>
            <OutcomeBanner report={lastOutcomeReport} onDismiss={dismissOutcomeReport} onOpenProfile={handleOpenProfile} />
          </div>
        )}

        {viewingStoryAuthorId !== null && (
          <StoryViewer
            authorId={viewingStoryAuthorId}
            viewedAuthorIds={viewedStoryAuthorIds}
            onMarkViewed={handleMarkStoryViewed}
            onChangeAuthor={setViewingStoryAuthorId}
            onClose={handleBack(() => setViewingStoryAuthorId(null))}
            onOpenProfile={(id) => {
              setViewingStoryAuthorId(null)
              handleOpenProfile(id)
            }}
          />
        )}
        {showAddStory && (
          <AddStory onBack={handleBack(() => setShowAddStory(false))} onPosted={handleBack(() => setShowAddStory(false))} />
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
    </>
  )
}
