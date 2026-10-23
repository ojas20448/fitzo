import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDiaryDate } from '../utils/foodDiary';

export function useLocalDay(): string {
    const [day, setDay] = useState(localDiaryDate);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const refresh = () => {
            setDay(localDiaryDate());
            const now = new Date();
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            clearTimeout(timer);
            timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 25);
        };
        refresh();
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
        return () => { clearTimeout(timer); subscription.remove(); };
    }, []);
    return day;
}
