import { z } from 'zod'
import type { CareerType } from '../../types'
import type { CareerPack, CareerPackDef } from './types'
import { GENERIC_OFFTOPIC_POSTS, GENERIC_OFFTOPIC_REACTION_POOL } from '../genericFiller'
import { footballerPack } from './footballer'
import { rapperPack } from './rapper'
import { singerPack } from './singer'
import { baseballPack } from './baseball'
import { npcSeedSchema, postPoolSchema, reactionPoolSchema } from '../schemas'

const rawPacks: Record<CareerType, CareerPackDef> = {
  footballer: footballerPack,
  rapper: rapperPack,
  singer: singerPack,
  baseball_player: baseballPack,
}

// Celebrities aren't tied to any career, so every pack gets the same
// career-agnostic pools for them rather than each hand-writing their own.
function withCelebrityPools(def: CareerPackDef): CareerPack {
  return {
    ...def,
    seedPostPool: { ...def.seedPostPool, celebrity: GENERIC_OFFTOPIC_POSTS },
    reactionPool: { ...def.reactionPool, celebrity: GENERIC_OFFTOPIC_REACTION_POOL },
  }
}

// Fail fast in dev if a career pack's content is malformed, rather than
// letting a typo surface as a broken NPC deep in the feed.
function validatePack(def: CareerPackDef): CareerPack {
  const pack = withCelebrityPools(def)
  z.array(npcSeedSchema).parse(pack.npcs)
  postPoolSchema.parse(pack.seedPostPool)
  reactionPoolSchema.parse(pack.reactionPool)
  return pack
}

export const CAREER_PACKS: Record<CareerType, CareerPack> = Object.fromEntries(
  Object.entries(rawPacks).map(([id, pack]) => [id, validatePack(pack)]),
) as Record<CareerType, CareerPack>

export const CAREER_LIST: CareerPack[] = Object.values(CAREER_PACKS)

export type { CareerPack, KeywordRule, ReactionPool, NPCSeed } from './types'
