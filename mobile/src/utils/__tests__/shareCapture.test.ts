jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(), releaseCapture: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { shareCapturedImage, getCaptureFrame } from '../shareCapture';

beforeEach(() => {
    jest.clearAllMocks();
    (captureRef as jest.Mock).mockResolvedValue('file:///temporary.png');
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
});

it('retains the temporary file until the native share operation completes', async () => {
    let finish!: () => void;
    (Sharing.shareAsync as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const pending = shareCapturedImage({ current: {} }, 'Workout');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(releaseCapture).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///temporary.png', expect.objectContaining({ mimeType: 'image/png' }));
    expect(releaseCapture).toHaveBeenCalledWith('file:///temporary.png');
});

it('releases the temporary image and propagates a share error for visible retry', async () => {
    (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('destination unavailable'));
    await expect(shareCapturedImage({ current: {} }, 'Workout')).rejects.toThrow('destination unavailable');
    expect(releaseCapture).toHaveBeenCalledWith('file:///temporary.png');
});

it('does not create an image if file sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await expect(shareCapturedImage({ current: {} }, 'Workout')).rejects.toThrow();
    expect(captureRef).not.toHaveBeenCalled();
});

it('propagates capture errors without attempting to share another format', async () => {
    (captureRef as jest.Mock).mockRejectedValue(new Error('capture failed'));
    await expect(shareCapturedImage({ current: {} }, 'Workout')).rejects.toThrow('capture failed');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(releaseCapture).not.toHaveBeenCalled();
});

it.each([[1, 1080, 1920, 1], [2, 540, 960, 0.5], [3, 360, 640, 1 / 3]])('uses a physical 1080×1920 capture at density %s', (density, width, height, scale) => {
    expect(getCaptureFrame(density)).toEqual({ width, height, scale });
});
