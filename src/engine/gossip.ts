import type { RNG } from './rng'
import { pick } from './rng'

// The tabloid/gossip layer: whenever the player posts, finishes an activity,
// or resolves an event, the tabloid runs a specific, factual-sounding story
// about it, and people then comment on that story (and on related and
// unrelated posts) about the same thing. Everything here is deterministic
// template text — always specific (names, what actually happened), never a
// vague "you won't believe what happened" — and doubles as the fact sheet
// handed to the AI when it's enabled.

export type GossipKind = 'activity' | 'event' | 'post'
export type GossipTone = 'romantic' | 'positive' | 'negative' | 'wild' | 'neutral'
export type CommentTarget = 'tabloid' | 'participant_post' | 'player_post' | 'unrelated'

export interface GossipSubject {
  kind: GossipKind
  playerName: string
  // What actually happened, in the player's/neutral words: an activity's
  // description, an event's situation + the player's move, or the post text.
  detail: string
  tags: readonly string[]
  // People who were actually part of it (activity participants who showed
  // up, people @-tagged in the post) — display names.
  others: readonly string[]
  // How an event landed, and what the player actually did about it.
  // Gossip about celebs in their own lives, nothing to do with the player:
  // `playerName` is then the celeb the story is about (see store's
  // runWorldGossip) and their own posts get the reactions.
  world?: boolean
  subjectNpcId?: string
  eventTier?: 'good' | 'neutral' | 'bad'
  eventMove?: string
}

const ROMANTIC_WORDS = [
  'date', 'dinner', 'romantic', 'kiss', 'flirt', 'wine', 'drinks', 'candlelit', 'cuddle', 'hotel', 'love', 'valentine',
  'anniversary', 'together',
]
const WILD_WORDS = ['party', 'club', 'clubbing', 'night out', 'bar', 'after-party', 'afterparty', 'festival', 'rave', 'drunk']

function includesAny(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return words.some((w) => lower.includes(w))
}

export function gossipTone(subject: GossipSubject): GossipTone {
  if (subject.kind === 'event') {
    if (subject.eventTier === 'bad') return 'negative'
    if (subject.eventTier === 'good') return 'positive'
    return 'neutral'
  }
  const text = subject.detail
  if (subject.tags.includes('relationship') || includesAny(text, ROMANTIC_WORDS)) return 'romantic'
  if (subject.tags.includes('party') || includesAny(text, WILD_WORDS)) return 'wild'
  if (subject.tags.includes('controversial') || subject.tags.includes('scandal_leak') || subject.tags.includes('criticism')) {
    return 'negative'
  }
  if (
    subject.tags.includes('win') ||
    subject.tags.includes('big_moment') ||
    subject.tags.includes('huge_moment') ||
    subject.tags.includes('gratitude') ||
    subject.tags.includes('funny')
  ) {
    return 'positive'
  }
  return 'neutral'
}

export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// Trim to a readable length without cutting mid-word.
export function shorten(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?-]+$/, '')}…`
}

// Event situations are written to the player ("...something about you...").
// The tabloid tells it in third person.
export function thirdPerson(text: string, playerName: string): string {
  return text
    .replace(/\byour\b/gi, `${playerName}'s`)
    .replace(/\byou're\b/gi, `${playerName} is`)
    .replace(/\byou've\b/gi, `${playerName} has`)
    .replace(/\byou\b/gi, playerName)
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

// --- What the tabloid posts --------------------------------------------

export function tabloidPostText(rng: RNG, subject: GossipSubject): string {
  const player = subject.playerName
  const others = joinNames(subject.others)
  const detail = shorten(subject.detail, 110)
  const tone = gossipTone(subject)

  if (subject.kind === 'activity') {
    const vars = { player, others, detail }
    if (subject.others.length === 0) {
      return fill(
        pick(rng, [
          '{player} was spotted out and about — "{detail}". Say what you will, they know how to be seen. 👀',
          'CAUGHT: {player} doing "{detail}". No plus-one this time... or is there?',
        ]),
        vars,
      )
    }
    if (tone === 'romantic') {
      return fill(
        pick(rng, [
          'SPOTTED 👀 {player} and {others}: "{detail}". Is there a new power couple in town?',
          'EXCLUSIVE: {player} caught with {others} — "{detail}". Sources say it looked way more than friendly.',
          'Paparazzi caught {player} and {others} on "{detail}". Are they together?? 👀',
          '{player} and {others} were seen getting cozy: "{detail}". Neither has commented.',
        ]),
        vars,
      )
    }
    if (tone === 'wild') {
      return fill(
        pick(rng, [
          'WILD NIGHT: {player} was out with {others} — "{detail}". Witnesses say it got messy. 👀',
          'Cameras caught {player} and {others} at "{detail}". The after-party is where it got interesting.',
        ]),
        vars,
      )
    }
    return fill(
      pick(rng, [
        'SPOTTED: {player} hanging out with {others} — "{detail}". Just friends? Sources are split. 👀',
        '{player} and {others} were seen together: "{detail}". What are they up to?',
      ]),
      vars,
    )
  }

  if (subject.kind === 'event') {
    const situation = shorten(thirdPerson(subject.detail, player), 130)
    const move = subject.eventMove ? ` ${player}'s move: "${shorten(subject.eventMove, 80)}".` : ''
    const ending =
      subject.eventTier === 'good'
        ? 'It went down a treat — the crowd loved it.'
        : subject.eventTier === 'bad'
          ? 'It did NOT go well. People are already calling it a mess.'
          : 'Nobody is quite sure what to make of it.'
    return fill(
      pick(rng, [
        'BREAKING: {player} in the middle of it — {situation}{move} {ending}',
        'HEADLINE: {situation}{move} That was {player}, and the reaction is everywhere. {ending}',
        '{player} makes headlines: {situation}{move} {ending}',
      ]),
      { player, situation, move, ending },
    )
  }

  // post
  const quote = shorten(subject.detail, 100)
  const vars = { player, quote, others }
  const tagged = subject.others.length > 0 ? ` (and yes, that's a shout-out to ${others})` : ''
  const base =
    tone === 'negative'
      ? pick(rng, [
          '{player} is under fire after posting: "{quote}" People are NOT happy.',
          'Backlash for {player}: "{quote}" — the replies are getting heated.',
        ])
      : tone === 'romantic'
        ? pick(rng, [
            '{player} just posted "{quote}" and fans think it\'s about someone special. 👀',
            'Is {player} hinting at a relationship? Their new post: "{quote}"',
          ])
        : tone === 'wild'
          ? pick(rng, [
              '{player} posted "{quote}" — looks like the night got wild. 👀',
              'After the weekend {player} had, their post says it all: "{quote}"',
            ])
          : tone === 'positive'
            ? pick(rng, [
                '{player} is trending after posting: "{quote}"',
                'The internet is loving {player}\'s latest post: "{quote}"',
              ])
            : pick(rng, [
                '{player} just posted "{quote}" and people are already talking.',
                'Everyone is talking about {player}\'s new post: "{quote}"',
              ])
  return `${fill(base, vars)}${tagged}`
}

// --- What people say about it ------------------------------------------

const LINES: Record<CommentTarget, Record<'withOthers' | 'solo', Record<GossipTone, string[]>>> = {
  tabloid: {
    withOthers: {
      romantic: [
        '{player} and {other}?? I did NOT see this coming 👀',
        "Not {player} and {other} 😭 they'd be so cute together",
        'So {player} and {other} are a thing now?? 😳',
        'the way {other} looks at {player} in these pics... it is SO obvious',
        '{other} deserves better than being in the tabloids over this tbh',
        'okay but {player} and {other} at "{detail}" is the best thing on my timeline today',
        'someone tell me {player} and {other} are official 🥹',
        'if {player} and {other} are dating I will literally scream 😭',
        'tmz ate with this one, {player} and {other} together?? 👀',
        'the {player} and {other} rumors just keep getting louder',
      ],
      wild: [
        '{player} and {other} out again?? that night sounds unreal 😂',
        'Only {player} could turn "{detail}" into a headline lol',
        '{other} really let {player} drag them into this 💀',
        '{player} and {other} out all night, the receipts are everywhere',
        'nobody survives a night out with {player} and {other} 😭',
        'the {player} and {other} story keeps getting wilder',
      ],
      positive: [
        'Love that {player} and {other} are out having a good time',
        '{player} and {other} together is honestly the best content',
        '{player} and {other} seem like they had a great time, love that',
        'this {player} and {other} outing is such a vibe',
      ],
      negative: [
        'This does not look good for {player} and {other}...',
        'Give {player} and {other} some privacy, jeez',
        'why is the press always on {player} and {other}?',
        'leave {player} and {other} alone, let them have a night out',
      ],
      neutral: [
        'Wait, {player} and {other}? What are they up to?',
        '{player} and {other} hanging out — I need to know more',
        'so what exactly were {player} and {other} doing at "{detail}"?',
        '{player} and {other}: friends, or something more?',
      ],
    },
    solo: {
      romantic: ['{player} out again... who were they with though? 👀', 'The way {player} keeps popping up in these headlines 😂'],
      wild: ['{player} really said "{detail}" and meant it 😂', 'Only {player} would end up in the news for this lol', 'Every week it is something new with {player} 😂'],
      positive: ['{player} living their best life, I love it', 'Good for {player}, honestly 🙌'],
      negative: ['{player} really cannot catch a break in the press', 'This is so overblown, leave {player} alone'],
      neutral: ['{player} is always in the news huh 😂', 'Okay but what was {player} actually doing?'],
    },
  },
  participant_post: {
    withOthers: {
      romantic: [
        '{other}, is it true about you and {player}?? 👀',
        'Everyone is talking about {other} and {player} right now',
        '{other} spill!! what is going on with {player}?',
      ],
      wild: ['{other} what happened with {player}?? the whole timeline is talking 😭', '{other} you and {player} are all over the news lol'],
      positive: ['{other} and {player} — congrats?? the news is everywhere 🙌', '{other} we saw you with {player}, looked fun!'],
      negative: ['{other} are you okay after the {player} headlines?', '{other} the {player} story is everywhere, hope you are good'],
      neutral: ['{other}, what were you and {player} up to? TMZ has a story', '{other} caught you with {player} in the news lol'],
    },
    solo: {
      romantic: ['{other} have you seen the {player} story?? 👀'],
      wild: ['{other} have you seen what {player} got up to?? 😂'],
      positive: ['{other} the {player} news is so good!'],
      negative: ['{other} the {player} story is getting messy'],
      neutral: ['{other} did you see the {player} story?'],
    },
  },
  player_post: {
    withOthers: {
      romantic: [
        'So what is really going on with you and {other}?? 👀',
        'We saw the TMZ story about you and {other}... care to explain?',
        '{player}, is {other} the reason for the smile in this post?',
      ],
      wild: ['Is this post about the night with {other}?? the headlines are wild 😂', '{player} after the {other} story, we need details'],
      positive: ['Great to see you and {other} having fun, {player}!', '{player} you and {other} looked great in that story'],
      negative: ['{player}, is the story about you and {other} true?', 'Everyone is asking about you and {other}, {player}'],
      neutral: ['{player} what was the deal with you and {other} in that story?', 'Seen the news about you and {other} — what happened?'],
    },
    solo: {
      romantic: ['{player} we saw the TMZ story... is there someone special?? 👀'],
      wild: ['{player} that story about you is wild, is it true?? 😂'],
      positive: ['{player} the story about you is so good, proud of you!'],
      negative: ['{player} is that story about you true? people are worried'],
      neutral: ['{player} is the story going around about you true?'],
    },
  },
  unrelated: {
    withOthers: {
      romantic: [
        'Random but did y\'all see the {player} and {other} story?? cannot stop thinking about it 😭',
        'Not me still stuck on the {player} and {other} headline 👀',
      ],
      wild: ['Anyway, the {player} and {other} night out story is unreal 💀', 'Everyone is talking about {player} and {other} — this feed is no better lol'],
      positive: ['Off topic but {player} and {other} are having a moment and I love it', 'Can we talk about the {player} and {other} news? 🙌'],
      negative: ['Not to derail but the {player} and {other} news looks rough', 'Anyone else seeing the {player} and {other} story everywhere?'],
      neutral: ['Off topic: did anyone read the {player} and {other} story?', 'Timeline is all {player} and {other} today'],
    },
    solo: {
      romantic: ['Off topic but that {player} story has me curious 👀'],
      wild: ['Anyway, the {player} story is wild 😂'],
      positive: ['Not to change the subject but {player} is doing great lately 🙌'],
      negative: ['Not to derail but the {player} story is a lot'],
      neutral: ['Off topic: everyone is talking about {player} today'],
    },
  },
}

export function gossipCommentText(rng: RNG, subject: GossipSubject, target: CommentTarget, other?: string): string {
  const tone = gossipTone(subject)
  const hasOther = !!other || subject.others.length > 0
  const pool = LINES[target][hasOther ? 'withOthers' : 'solo'][tone]
  const line = pick(rng, pool)
  return fill(line, {
    player: subject.playerName,
    other: other ?? subject.others[0] ?? '',
    detail: shorten(subject.kind === 'event' ? thirdPerson(subject.detail, subject.playerName) : subject.detail, 60),
  })
}

// One-line fact sheet for the AI (and the report card): what happened and
// who was involved, so generated tabloid posts and comments stay specific.
export function gossipFacts(subject: GossipSubject): string {
  const others = joinNames(subject.others)
  if (subject.kind === 'activity') {
    return `${subject.playerName}${others ? ` and ${others}` : ''} — activity: "${shorten(subject.detail, 140)}"`
  }
  if (subject.kind === 'event') {
    const did = subject.eventMove ? `; their move: "${shorten(subject.eventMove, 100)}"` : ''
    const outcome = subject.eventTier === 'good' ? 'it went well' : subject.eventTier === 'bad' ? 'it went badly' : 'the outcome was unclear'
    return `${subject.playerName} — ${shorten(thirdPerson(subject.detail, subject.playerName), 160)} ${did} (${outcome})`
  }
  return `${subject.playerName} posted: "${shorten(subject.detail, 140)}"${others ? ` (mentioning ${others})` : ''}`
}
