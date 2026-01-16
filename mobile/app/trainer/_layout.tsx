import { Stack } from 'expo-router';
import { colors } from '../../src/styles/theme';

export default function TrainerLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="member/[id]" />
        </Stack>
    );
}
