import { displayName, firstName, looksLikeEmail } from '../displayName';

describe('looksLikeEmail', () => {
    it('recognises an address', () => {
        expect(looksLikeEmail('ojas@gmail.com')).toBe(true);
        expect(looksLikeEmail('  ojas.narang@sub.domain.io  ')).toBe(true);
    });

    it('does not flag ordinary names', () => {
        expect(looksLikeEmail('Ojas Narang')).toBe(false);
        expect(looksLikeEmail('O')).toBe(false);
    });

    it('needs a dotted domain, not just an @', () => {
        expect(looksLikeEmail('ojas@localhost')).toBe(false);
    });

    it('handles null/undefined/empty', () => {
        expect(looksLikeEmail(null)).toBe(false);
        expect(looksLikeEmail(undefined)).toBe(false);
        expect(looksLikeEmail('')).toBe(false);
    });
});

describe('displayName', () => {
    it('passes a real name straight through', () => {
        expect(displayName({ name: 'Ojas Narang' })).toBe('Ojas Narang');
    });

    it('prefers the username when the name is an email', () => {
        expect(displayName({ name: 'ojas@gmail.com', username: 'ojas4123' })).toBe('ojas4123');
    });

    it('humanizes the local part when there is no username', () => {
        expect(displayName({ name: 'ojas.narang@example.io' })).toBe('Ojas Narang');
        expect(displayName({ name: 'ojas_narang@example.io' })).toBe('Ojas Narang');
        expect(displayName({ name: 'ojas-narang@example.io' })).toBe('Ojas Narang');
    });

    it('strips digits appended to a local part', () => {
        expect(displayName({ name: 'ojas4123@example.io' })).toBe('Ojas');
    });

    it('ignores a username that is itself an email', () => {
        expect(displayName({ name: 'a@b.com', username: 'c@d.com' })).toBe('A');
    });

    it('trims surrounding whitespace', () => {
        expect(displayName({ name: '  Ojas Narang  ' })).toBe('Ojas Narang');
    });

    it('falls back when there is nothing usable', () => {
        expect(displayName(null)).toBe('Member');
        expect(displayName({})).toBe('Member');
        expect(displayName({ name: '   ' })).toBe('Member');
        expect(displayName({ name: '' }, 'Athlete')).toBe('Athlete');
    });
});

describe('firstName', () => {
    it('takes the first token of a real name', () => {
        expect(firstName({ name: 'Ojas Narang' })).toBe('Ojas');
    });

    it('never returns an email fragment with an @', () => {
        expect(firstName({ name: 'ojas.narang@example.io' })).toBe('Ojas');
    });
    it('cuts handle-shaped names at the first digit', () => {
        // The case from the profile header: a username stored in `name`, with no
        // space to split on.
        expect(firstName({ name: 'Ojas4123narang' })).toBe('Ojas');
        expect(firstName({ username: 'ojas4123' })).toBe('Ojas');
        expect(firstName({ name: 'ojas4123narang' })).toBe('Ojas');
    });

    it('capitalises a lowercase handle', () => {
        expect(firstName({ name: 'ojas' })).toBe('Ojas');
    });

    it('leaves a name whole when cutting would gut it', () => {
        // Nothing plausible survives the cut, so do not mangle these.
        expect(firstName({ name: '4123' })).toBe('4123');
        expect(firstName({ name: 'J2' })).toBe('J2');
    });

    it('falls back for an empty user', () => {
        expect(firstName(null)).toBe('there');
        expect(firstName({}, 'friend')).toBe('friend');
    });
});
