const mockHK = {
    isHealthDataAvailable: jest.fn(() => true),
    requestAuthorization: jest.fn(async () => true),
    queryStatisticsForQuantity: jest.fn(async (id: string) => ({ sumQuantity: { quantity: id.includes('Step') ? 1234 : 210.4 } })),
    queryQuantitySamples: jest.fn(async () => [{ quantity: 57 }]),
    queryCategorySamples: jest.fn(async () => [
        { value: 0, startDate: new Date('2026-09-09T22:00Z'), endDate: new Date('2026-09-10T06:00Z') },
        { value: 1, startDate: new Date('2026-09-09T23:00Z'), endDate: new Date('2026-09-10T05:00Z') },
        { value: 3, startDate: new Date('2026-09-10T00:00Z'), endDate: new Date('2026-09-10T03:00Z') },
        { value: 2, startDate: new Date('2026-09-10T05:00Z'), endDate: new Date('2026-09-10T06:00Z') },
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
            { stage: 4, startTime: '2026-09-10T00:00Z', endTime: '2026-09-10T02:00Z' },
            { stage: 1, startTime: '2026-09-10T02:00Z', endTime: '2026-09-10T03:00Z' },
        ], startTime: '2026-09-10T00:00Z', endTime: '2026-09-10T03:00Z' }] }),
};

function service(os: string): typeof import('../../services/healthService') {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    jest.doMock('@kingstinct/react-native-healthkit', () => mockHK);
    jest.doMock('react-native-health-connect', () => mockHC);
    return require('../../services/healthService');
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-09-10T08:00Z')); });
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
