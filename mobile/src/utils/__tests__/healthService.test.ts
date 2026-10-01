const mockHK = {
    isHealthDataAvailable: jest.fn(() => true),
    isProtectedDataAvailable: jest.fn(() => true),
    requestAuthorization: jest.fn(async () => true),
    queryStatisticsForQuantity: jest.fn(async (id: string) => ({ sumQuantity: { quantity: id.includes('Step') ? 1234 : 210.4 } })),
    queryQuantitySamples: jest.fn(async () => [{ quantity: 57 }]),
    queryCategorySamples: jest.fn(async () => [
        { value: 0, startDate: new Date('2026-09-09T22:00Z'), endDate: new Date('2026-09-10T06:00Z') },
        { value: 1, startDate: new Date(2026, 8, 10, 0), endDate: new Date(2026, 8, 10, 6) },
        { value: 3, startDate: new Date(2026, 8, 10, 1), endDate: new Date(2026, 8, 10, 3) },
        { value: 2, startDate: new Date(2026, 8, 10, 6), endDate: new Date('2026-09-10T06:00Z') },
    ]),
};
const mockHC = {
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
    getSdkStatus: jest.fn(async () => 3),
    initialize: jest.fn(async () => true),
    requestPermission: jest.fn(async () => [{ accessType: 'read', recordType: 'Steps' }]),
    getGrantedPermissions: jest.fn(async () => ['Steps', 'ActiveCaloriesBurned', 'RestingHeartRate', 'SleepSession'].map(recordType => ({ accessType: 'read', recordType }))),
    aggregateRecord: jest.fn(async ({ recordType }: { recordType: string }) => recordType === 'Steps'
        ? { COUNT_TOTAL: 456, dataOrigins: ['phone'] }
        : { ACTIVE_CALORIES_TOTAL: { inKilocalories: 80.2 }, dataOrigins: ['watch'] }),
    readRecords: jest.fn(async (recordType: string) => recordType === 'RestingHeartRate'
        ? { records: [{ beatsPerMinute: 61, time: '2026-09-10T07:00Z' }] }
        : { records: [{ stages: [
            { stage: 4, startTime: new Date(2026, 8, 10, 0).toISOString(), endTime: new Date(2026, 8, 10, 2).toISOString() },
            { stage: 1, startTime: new Date(2026, 8, 10, 2).toISOString(), endTime: new Date(2026, 8, 10, 3).toISOString() },
        ], startTime: new Date(2026, 8, 10, 0).toISOString(), endTime: new Date(2026, 8, 10, 3).toISOString() }] }),
};

function service(os: string): typeof import('../../services/healthService') {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    jest.doMock('@kingstinct/react-native-healthkit', () => mockHK);
    jest.doMock('react-native-health-connect', () => mockHC);
    return require('../../services/healthService');
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date(2026, 8, 10, 14)); });
afterEach(() => jest.useRealTimers());

it('requests read-only Apple Health access using the installed API', async () => {
    expect(await service('ios').requestPermissions()).toBe(true);
    expect(mockHK.requestAuthorization).toHaveBeenCalledWith({ toRead: [
        'HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierRestingHeartRate', 'HKCategoryTypeIdentifierSleepAnalysis',
    ] });
});

it('uses daily statistics, explicit units, newest resting heart rate and nonoverlapping asleep intervals', async () => {
    const result = await service('ios').getTodaysSummary();
    expect(result).toMatchObject({ steps: 1234, activeCalories: 210, restingHeartRate: 57, sleepHours: 6 });
    expect(mockHK.queryStatisticsForQuantity).toHaveBeenCalledWith('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], expect.objectContaining({ unit: 'count', filter: { date: expect.objectContaining({ endDate: new Date() }) } }));
    expect(mockHK.queryQuantitySamples).toHaveBeenCalledWith('HKQuantityTypeIdentifierRestingHeartRate', expect.objectContaining({ ascending: false, limit: 1, unit: 'count/min' }));
});

it('requests actual resting heart rate on Android', async () => {
    await service('android').requestPermissions();
    expect(mockHC.requestPermission).toHaveBeenCalledWith(expect.arrayContaining([{ accessType: 'read', recordType: 'RestingHeartRate' }]));
});

it('imports Android aggregate totals with correct filters and excludes awake sleep stages', async () => {
    const result = await service('android').getTodaysSummary();
    expect(result).toMatchObject({ steps: 456, activeCalories: 80, restingHeartRate: 61, sleepHours: 2 });
    expect(mockHC.aggregateRecord).toHaveBeenCalledWith(expect.objectContaining({ recordType: 'Steps', timeRangeFilter: expect.objectContaining({ operator: 'between' }) }));
    expect(mockHC.readRecords).not.toHaveBeenCalledWith('HeartRate', expect.anything());
});

it('reads historical quantities using that day instead of today', async () => {
    const result = await service('ios').getSummaryForDate('2026-09-08');
    expect(result.date).toBe('2026-09-08');
    expect(mockHK.queryStatisticsForQuantity).toHaveBeenCalledWith('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], expect.objectContaining({
        filter: { date: { startDate: new Date(2026, 8, 8), endDate: new Date(2026, 8, 9) } },
    }));
    expect(result.sleepHours).toBeNull();
});

it('does not read Android health data in the background without its separate permission', async () => {
    expect(await service('android').canReadHealthInBackground()).toBe(false);
});

it('does not read Apple Health in the background while protected data is locked', async () => {
    mockHK.isProtectedDataAvailable.mockReturnValueOnce(false);
    expect(await service('ios').canReadHealthInBackground()).toBe(false);
    expect(await service('ios').canReadHealthInBackground()).toBe(true);
});

it('includes Android sessions starting before midnight and counts only sleep inside the requested day', async () => {
    mockHC.readRecords.mockResolvedValueOnce({ records: [] });
    mockHC.readRecords.mockResolvedValueOnce({ records: [{ stages: [{ stage: 4,
        startTime: new Date(2026, 8, 9, 23).toISOString(), endTime: new Date(2026, 8, 10, 6).toISOString(),
    }], startTime: new Date(2026, 8, 9, 23).toISOString(), endTime: new Date(2026, 8, 10, 6).toISOString() }] });
    const result = await service('android').getSummaryForDate('2026-09-10');
    expect(result.sleepHours).toBe(6);
    expect(mockHC.readRecords).toHaveBeenCalledWith('SleepSession', expect.objectContaining({ timeRangeFilter: expect.objectContaining({
        startTime: new Date(2026, 8, 9).toISOString(),
    }) }));
});
