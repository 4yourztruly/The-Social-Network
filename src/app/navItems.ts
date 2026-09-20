import { BellIcon, HomeIcon, MailIcon, PlusIcon, SparkleIcon, UserIcon } from '../components/icons'

export type Screen = 'feed' | 'activity' | 'compose' | 'dms' | 'notifications' | 'profile'

export const NAV_ITEMS: { screen: Screen; label: string; Icon: typeof HomeIcon }[] = [
  { screen: 'feed', label: 'Feed', Icon: HomeIcon },
  { screen: 'activity', label: 'Activity', Icon: SparkleIcon },
  { screen: 'compose', label: 'Post', Icon: PlusIcon },
  { screen: 'dms', label: 'DMs', Icon: MailIcon },
  { screen: 'notifications', label: 'Alerts', Icon: BellIcon },
  { screen: 'profile', label: 'Profile', Icon: UserIcon },
]
