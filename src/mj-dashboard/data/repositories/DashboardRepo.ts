import dummy from "@/dummy/dummy";

function generateMonthlyEarnings() {
    const monthLabels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "July",
        "Aug",
        "Sept",
        "Oct",
        "Nov",
        "Dec",
    ];

    const base = 20000 + Math.floor(Math.random() * 15000); // 20k–35k base

    return monthLabels.map((label, i) => {
        const seasonal = Math.sin((i / 12) * Math.PI * 2) * 5000; // +/-5k wave
        const noise = Math.floor(Math.random() * 3000) - 1500;    // +/-1.5k noise
        const value = Math.max(8000, Math.round(base + seasonal + noise));
        return { name: label, uv: value };
    });
}

export function DashboardRepo() {
    return {
        getDashboardData: async (): Promise<DashboardResponse> => {
            const earning_data = generateMonthlyEarnings();

            const makeInfluencer = async (gender: "female" | "male" = "female") => ({
                imgUrl: await dummy.image.getRandomFemaleProfilePictures(),
                name:
                    gender === "female"
                        ? dummy.getRandomFemaleName()
                        : dummy.getRandomMaleName(),
                earnings: Math.floor(20000 + Math.random() * 40000), // 20k–60k
            });

            const makeUser = async () => ({
                imgUrl: await dummy.image.getRandomMaleProfilePictures(),
                name: dummy.getRandomName(),
                earnings: Math.floor(500 + Math.random() * 5000), // 0.5k–5.5k
            });

            const top_influencers = await Promise.all([
                makeInfluencer("female"),
                makeInfluencer("female"),
                makeInfluencer("female"),
                makeInfluencer("female"),
                makeInfluencer("female"),
            ]);

            const top_users = await Promise.all([
                makeUser(),
                makeUser(),
                makeUser(),
                makeUser(),
                makeUser(),
            ]);

            return {
                earning_data,
                total_users: 123,
                total_new_users: 3,
                total_influencers: 5,
                total_issues_reported: 3,
                total_chats: 150,
                top_influencers,
                top_users,
            };
        },
    } as const;
}