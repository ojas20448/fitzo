const number = { type: 'number', minimum: 0, maximum: 100000 };
const string = { type: 'string', minLength: 1, maxLength: 12000 };
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = (items, minItems = 0) => ({ type: 'array', items, minItems, maxItems: 100 });
const macros = object({ calories: number, protein_g: number, carbs_g: number, fat_g: number });
const food = object({ name: string, calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number, sugar_g: number, serving_size: string });
const schemas = {
    food_photo: object({ items: array(food, 1), total: macros }),
    food_text: food,
    workout_plan: object({ plan_name: string, duration_weeks: number, days: array(object({ day: string, focus: string, exercises: array(object({ name: string, sets: number, reps: string, rest_seconds: number, notes: { type: 'string', maxLength: 2000 } }), 1) }), 1) }),
    nutrition: object({ calories: number, macros: object({ protein_g: number, carbs_g: number, fats_g: number }), meal_timing: array(string), supplements: array(string), tips: array(string) }),
    food_extract: array(object({ item: string, quantity: string })),
    workout_extract: array(object({ name: string, is_unilateral: { type: 'boolean' }, sets: array(object({ reps: number, weight_kg: number, rir: number })) })),
    coach: string, form: string, daily_insight: string, weekly_recap: string,
};
function validate(schema, value) {
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_OUTPUT');
        for (const k of schema.required) validate(schema.properties[k], value[k]);
        if (Object.keys(value).some(k => !schema.properties[k])) throw Error('INVALID_OUTPUT');
    } else if (schema.type === 'array') {
        if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) throw Error('INVALID_OUTPUT');
        value.forEach(v => validate(schema.items, v));
    } else if (schema.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < schema.minimum || value > schema.maximum) throw Error('INVALID_OUTPUT');
    } else if (typeof value !== schema.type || (schema.type === 'string' && (value.trim().length < (schema.minLength || 0) || value.length > schema.maxLength))) throw Error('INVALID_OUTPUT');
    return value;
}
function validateResult(feature, value) {
    if (!schemas[feature]) throw Error('UNSUPPORTED_CAPABILITY');
    validate(schemas[feature], value);
    if (feature === 'food_photo') {
        for (const k of Object.keys(macros.properties)) {
            const sum = value.items.reduce((s, item) => s + item[k], 0);
            if (Math.abs(sum - value.total[k]) > Math.max(2, sum * 0.05)) throw Error('INVALID_OUTPUT');
        }
    }
    return value;
}
function photoBytes(image, mimeType) {
    if (!['image/jpeg', 'image/png'].includes(mimeType) || typeof image !== 'string') throw Error('INVALID_PHOTO');
    const raw = image.replace(/^data:image\/(jpeg|png);base64,/, '');
    if (!raw || raw.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw Error('INVALID_PHOTO');
    const bytes = Buffer.from(raw, 'base64');
    if (bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== raw) throw Error('INVALID_PHOTO');
    const jpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!(mimeType === 'image/jpeg' ? jpeg : png)) throw Error('INVALID_PHOTO');
    return bytes;
}
module.exports = { schemas, validateResult, photoBytes };
