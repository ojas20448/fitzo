import React from 'react';
import { Tabs } from 'expo-router';
import { MemberTabBar } from '../../src/components/navigation/MemberTabBar';
import { MemberChromeProvider } from '../../src/components/navigation/MemberChromeContext';

export default function TabLayout() {
    return <MemberChromeProvider>
        <Tabs tabBar={props => <MemberTabBar {...props} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" options={{ title: 'Workout' }} />
            <Tabs.Screen name="food" options={{ title: 'Food' }} />
            <Tabs.Screen name="gym" options={{ title: 'Gym' }} />
            <Tabs.Screen name="buddies" options={{ title: 'Friends' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            <Tabs.Screen name="learn" options={{ href: null }} />
            <Tabs.Screen name="scan" options={{ href: null }} />
            <Tabs.Screen name="stats" options={{ href: null }} />
        </Tabs>
    </MemberChromeProvider>;
}
