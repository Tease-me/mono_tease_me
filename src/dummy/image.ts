const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export async function getRandomMaleProfilePictures(): Promise<string> {
    const modules = import.meta.glob<string>(
        "@/dummy/profile-pics/male/*.{png,jpg,jpeg,webp}",
        { import: "default" }
    );

    const paths = Object.keys(modules);
    if (paths.length === 0) {
        const imageModule = await import(
            "@/dummy/profile-pics/default.png"
        );
        return imageModule.default;
    }

    const picked = pick(paths);
    const src = await modules[picked]();
    return src;
}

export async function getRandomFemaleProfilePictures(): Promise<string> {
    const modules = import.meta.glob<string>(
        "@/dummy/profile-pics/female/*.{png,jpg,jpeg,webp}",
        { import: "default" }
    );

    const paths = Object.keys(modules);
    if (paths.length === 0) {
        const imageModule = await import(
            "@/dummy/profile-pics/default.png"
        );
        return imageModule.default;
    }

    const picked = pick(paths);
    const src = await modules[picked]();
    return src;
}