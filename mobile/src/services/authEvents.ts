type LogoutListener = () => void;

let listeners: LogoutListener[] = [];

export const authEvents = {
    subscribe: (listener: LogoutListener) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter((l) => l !== listener);
        };
    },

    emitLogout: () => {
        listeners.forEach((listener) => listener());
    },
};
