import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getAIConsent } from '../components/AIConsentModal';

/** Ask at the point of use, then resume only after the consent sheet closes. */
export function useAIConsent() {
    const [visible, setVisible] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const pending = useRef<{ promise: Promise<boolean>; resolve: (granted: boolean) => void } | null>(null);
    const acceptedOnDismiss = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            pending.current?.resolve(false);
            pending.current = null;
        };
    }, []);

    const finish = useCallback((granted: boolean) => {
        const request = pending.current;
        pending.current = null;
        acceptedOnDismiss.current = false;
        setVisible(false);
        setIsPending(false);
        request?.resolve(granted);
    }, []);

    const requestConsent = useCallback(async (): Promise<boolean> => {
        const granted = await getAIConsent();
        if (!mounted.current) return false;
        if (granted) return true;
        if (pending.current) return pending.current.promise;

        let resolve!: (granted: boolean) => void;
        const promise = new Promise<boolean>((done) => { resolve = done; });
        pending.current = { promise, resolve };
        setIsPending(true);
        setVisible(true);
        return promise;
    }, []);

    const onAccept = useCallback(() => {
        // iOS cannot present the recording modal until this sheet has dismissed.
        if (Platform.OS === 'ios') {
            acceptedOnDismiss.current = true;
            setVisible(false);
        } else {
            finish(true);
        }
    }, [finish]);

    const onDecline = useCallback(() => finish(false), [finish]);
    const onDismiss = useCallback(() => {
        if (acceptedOnDismiss.current) finish(true);
    }, [finish]);

    return { requestConsent, isPending, modalProps: { visible, onAccept, onDecline, onDismiss } };
}
