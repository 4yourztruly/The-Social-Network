import { describe, expect, it } from 'vitest'
import { useGameStore, PLAYER_ID } from './gameStore'
import { isNPC } from '../types'

async function newWorld() {
  await useGameStore.getState().completeOnboarding({
    career: 'footballer',
    displayName: 'Test',
    username: 'test',
    bio: 'Forward for a club.',
    role: '',
    org: '',
    celebs: [{ name: 'Zendaya' }, { name: 'Other Celeb' }],
  })
}

describe('celeb outreach and DM availability', () => {
  it('a celeb in the green messages first, low-relationship and commenters never do', async () => {
    await newWorld()
    const npcs = Object.values(useGameStore.getState().profiles).filter(isNPC)
    const [close, distant] = npcs.filter((n) => n.persona === 'celebrity')
    const fan = npcs.find((n) => n.persona === 'loyal_fan')!
    useGameStore.setState((s) => ({
      profiles: {
        ...s.profiles,
        [close.id]: { ...close, relationship: 40 },
        [distant.id]: { ...distant, relationship: 10 },
        [fan.id]: { ...fan, relationship: 90 },
      },
    }))

    // Every post ends an action, which advances the day — plenty of days for
    // a 40% chance per day to land.
    for (let i = 0; i < 25 && !useGameStore.getState().threads[close.id]; i++) {
      useGameStore.getState().submitPlayerPost({ caption: `Post number ${i}` })
    }
    const threads = useGameStore.getState().threads
    expect(threads[close.id]?.messages[0].from).toBe('npc')
    expect(threads[close.id]?.unread).toBeGreaterThan(0)
    expect(threads[distant.id]).toBeUndefined()
    expect(threads[fan.id]).toBeUndefined()
  })

  it('DMs work with a celeb regardless of relationship or follow state, and never with the public', async () => {
    await newWorld()
    const state = useGameStore.getState()
    const npcs = Object.values(state.profiles).filter(isNPC)
    const celeb = npcs.find((n) => n.persona === 'celebrity')!
    const tabloid = npcs.find((n) => n.persona === 'tabloid')!
    const fan = npcs.find((n) => n.persona === 'loyal_fan')!
    state.unfollowNpc(celeb.id)
    state.sendPlayerMessage(celeb.id, 'hey')
    state.sendPlayerMessage(tabloid.id, 'no comment')
    state.sendPlayerMessage(fan.id, 'hi fan')
    const threads = useGameStore.getState().threads
    expect(threads[celeb.id]?.messages[0].text).toBe('hey')
    expect(threads[tabloid.id]?.messages[0].text).toBe('no comment')
    expect(threads[fan.id]).toBeUndefined()
    expect(PLAYER_ID).toBe('player')
  })

  it('an NPC replying to a comment @-mentions whoever they replied to', async () => {
    await newWorld()
    const state = useGameStore.getState()
    const post = Object.values(state.posts).find((p) => p.kind === 'post' && p.authorId !== PLAYER_ID)!
    state.addPlayerReply(post.id, 'nice one')
    const replies = Object.values(useGameStore.getState().posts).filter((p) => p.kind === 'reply')
    const playersReply = replies.find((r) => r.authorId === PLAYER_ID)!
    const npcReplyBack = replies.find((r) => r.parentId === playersReply.id)
    expect(npcReplyBack?.text.startsWith('@test ')).toBe(true)
  })
})

describe('reply chains', () => {
  it('a player reply pulls in the original commenter and at most a couple more, never a loop', async () => {
    await newWorld()
    const state = useGameStore.getState()
    const post = Object.values(state.posts).find((p) => p.kind === 'post' && p.authorId !== PLAYER_ID)!
    // Seed a few more participants in the thread so chain responders exist.
    state.addPlayerReply(post.id, 'first thought')
    const before = Object.values(useGameStore.getState().posts).filter((p) => p.kind === 'reply').length
    for (let i = 0; i < 12; i++) useGameStore.getState().addPlayerReply(post.id, `take ${i}`)
    const all = Object.values(useGameStore.getState().posts)
    const playerReplies = all.filter((p) => p.kind === 'reply' && p.authorId === PLAYER_ID)
    for (const mine of playerReplies) {
      const descendants: string[] = []
      const walk = (id: string) => {
        for (const c of all.filter((p) => p.parentId === id)) {
          descendants.push(c.id)
          walk(c.id)
        }
      }
      walk(mine.id)
      // guaranteed original + at most 2 chained hops, and nobody looped
      expect(descendants.length).toBeLessThanOrEqual(3 * 2)
    }
    expect(all.filter((p) => p.kind === 'reply').length).toBeGreaterThan(before)
  })
})

describe('every action gets a report card', () => {
  it('replies, stories and chats each report — chats only when you leave', async () => {
    await newWorld()
    const st = () => useGameStore.getState()
    const post = Object.values(st().posts).find((p) => p.kind === 'post' && p.authorId !== PLAYER_ID)!

    st().dismissOutcomeReport()
    st().addPlayerReply(post.id, 'this is hilarious lol')
    expect(st().lastOutcomeReport?.kind).toBe('comment')
    expect(st().lastOutcomeReport?.details?.summary).toContain('this is hilarious')

    st().dismissOutcomeReport()
    st().submitPlayerStory('training day')
    expect(st().lastOutcomeReport?.kind).toBe('story')
    expect(st().lastOutcomeReport?.followerDelta).toBeGreaterThan(0)

    const celeb = Object.values(st().profiles).filter(isNPC).find((n) => n.persona === 'celebrity')!
    st().dismissOutcomeReport()
    st().beginDmSession(celeb.id)
    st().sendPlayerMessage(celeb.id, 'hey, how are you?')
    st().sendPlayerMessage(celeb.id, 'want to hang out?')
    expect(st().lastOutcomeReport).toBeNull()
    const before = st().profiles[celeb.id] as ReturnType<typeof Object.values>[number] as { relationship: number }
    st().finishDmSession(celeb.id)
    expect(st().lastOutcomeReport?.kind).toBe('dm')
    expect((st().profiles[celeb.id] as { relationship: number }).relationship).toBeGreaterThanOrEqual(before.relationship)

    // leaving again with nothing new says nothing
    st().dismissOutcomeReport()
    st().beginDmSession(celeb.id)
    st().finishDmSession(celeb.id)
    expect(st().lastOutcomeReport).toBeNull()
  })
})
