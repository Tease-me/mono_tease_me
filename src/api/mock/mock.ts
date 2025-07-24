export const mock = {
    getRandomDate: function getRandomDate(): string {
        const now = Date.now();
        const past = now - 1000 * 60 * 60 * 24 * 365;
        const randomTime = past + Math.random() * (now - past);
        return new Date(randomTime).toISOString();
    }
}