export type MemberTabName = 'index' | 'food' | 'gym' | 'buddies' | 'profile';
export const MEMBER_TABS = [
    { name: 'index', title: 'Workout', icon: 'barbell-outline' },
    { name: 'food', title: 'Food', icon: 'restaurant-outline' },
    { name: 'gym', title: 'Gym', icon: 'business-outline' },
    { name: 'buddies', title: 'Friends', icon: 'people-outline' },
    { name: 'profile', title: 'Profile', icon: 'person-outline' },
] as const;
export function getMemberChromeInset({ barHeight, bottomInset, bannerHeight }: {
    barHeight: number; bottomInset: number; bannerHeight: number;
}): number {
    return barHeight + Math.max(bottomInset, 10) + (bannerHeight > 0 ? bannerHeight + 8 : 0) + 16;
}
