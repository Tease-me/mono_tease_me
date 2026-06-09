

export const mock = {
    getRandomDate: (): string => {
        const now = Date.now();
        const past = now - 1000 * 60 * 60 * 24 * 365;
        const randomTime = past + Math.random() * (now - past);
        return new Date(randomTime).toISOString();
    },
    getRandomProfileImage: async (): Promise<string> => {
        const imageModule = await import(
            "@/assets/mock/profile-pics/95e55f59e836885c92781897d0817a7a34955844.png"
        );
        return imageModule.default;
    }
}