import { describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { isNPC } from '../types'

describe('day ordering and story comments', () => {
  it('the tabloid post sits at the bottom of its day, below every other post of that day', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    useGameStore.getState().submitPlayerPost({ caption: 'went on a wild night out with friends' })
    const s = useGameStore.getState()
    const day = s.gameDay
    const today = s.postOrder.filter((id) => s.posts[id].kind === 'post' && s.posts[id].gameDay === day)
    const tabloidIds = today.filter((id) => {
      const a = s.profiles[s.posts[id].authorId]
      return a && isNPC(a) && a.persona === 'tabloid'
    })
    if (tabloidIds.length > 0) expect(today.at(-1)).toBe(tabloidIds.at(-1))
  })

  it('no two stories share the exact same comment section', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    const posts = Object.values(useGameStore.getState().posts)
    const stories = posts.filter((p) => p.kind === 'story')
    const sections = stories
      .map((st) => posts.filter((p) => p.parentId === st.id).map((p) => p.text).sort().join('|'))
      .filter((x) => x.length > 0)
    expect(new Set(sections).size).toBe(sections.length)
  })
})

describe('feed volume', () => {
  it('a day brings at most a few news-outlet posts and busy days are the reason for more', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    const before = new Set(Object.keys(useGameStore.getState().posts))
    useGameStore.getState().submitPlayerPost({ caption: 'quiet day' })
    const s = useGameStore.getState()
    const fresh = Object.values(s.posts).filter((p) => !before.has(p.id) && p.kind === 'post')
    const media = fresh.filter((p) => {
      const a = s.profiles[p.authorId]
      return a && isNPC(a) && (a.persona === 'match_reporter' || a.persona === 'tabloid')
    })
    expect(media.length).toBeLessThanOrEqual(3)
  })

  it('every day-batch post gets a real comment section', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    const before = new Set(Object.keys(useGameStore.getState().posts))
    useGameStore.getState().submitPlayerPost({ caption: 'hello world' })
    const s = useGameStore.getState()
    const fresh = Object.values(s.posts).filter((p) => !before.has(p.id) && p.kind === 'post' && p.authorId !== 'player')
    const withComments = fresh.filter((p) => Object.values(s.posts).filter((r) => r.parentId === p.id).length >= 4)
    expect(withComments.length).toBeGreaterThan(0)
  })
})

describe('specific feed, stories and public responses', () => {
  it('celebs stay within the same daily allowance as the news outlets', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '',
      celebs: [{ name: 'A One' }, { name: 'B Two' }, { name: 'C Three' }, { name: 'D Four' }],
    })
    const before = new Set(Object.keys(useGameStore.getState().posts))
    useGameStore.getState().submitPlayerPost({ caption: 'plain day' })
    const s = useGameStore.getState()
    const fresh = Object.values(s.posts).filter((p) => !before.has(p.id) && p.kind === 'post' && p.authorId !== 'player')
    const celebPosts = fresh.filter((p) => {
      const a = s.profiles[p.authorId]
      return a && isNPC(a) && a.persona === 'celebrity'
    })
    expect(celebPosts.length).toBeLessThanOrEqual(3)
  })

  it('a story gets comments from people too', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    useGameStore.getState().submitPlayerStory('training day')
    const s = useGameStore.getState()
    const story = Object.values(s.posts).find((p) => p.kind === 'story' && p.authorId === 'player')!
    expect(Object.values(s.posts).filter((p) => p.parentId === story.id).length).toBeGreaterThan(0)
  })

  it('defending a celeb publicly can get a post of their own @-ing you', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    const s0 = useGameStore.getState()
    const celeb = Object.values(s0.profiles).filter(isNPC).find((n) => n.persona === 'celebrity')!
    const theirPost = Object.values(s0.posts).find((p) => p.kind === 'post' && p.authorId === celeb.id)
    const target = theirPost ?? Object.values(s0.posts).find((p) => p.kind === 'post' && p.authorId !== 'player')!
    let answered = false
    for (let i = 0; i < 30 && !answered; i++) {
      useGameStore.getState().addPlayerReply(target.id, 'I will always defend you, ignore the haters')
      answered = Object.values(useGameStore.getState().posts).some(
        (p) => p.kind === 'post' && p.authorId === target.authorId && p.text.includes('@test'),
      )
    }
    if (isNPC(s0.profiles[target.authorId]) && (s0.profiles[target.authorId] as { persona: string }).persona === 'celebrity') expect(answered).toBe(true)
  })
})
