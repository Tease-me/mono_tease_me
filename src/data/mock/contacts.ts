import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import loliPic from "@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.jpg";
import bella from "@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg";
import anna from "@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg";

export const contacts: InfluencerDataModel[] = [
    {
        id: "loli",
        name: "Lola Fairfax",
        username: "loli",
        img: loliPic,
        bio: "Daring temptress: confident, playful, and always in contro"
    },
    {
        id: "bella",
        name: "Bella Thorne",
        username: "bella",
        img: bella,
        bio: "Warm-hearted soulmate: gentle comfort with a playful spark."
    },
    {
        id: "anna",
        name: "Annabelle Norton",
        username: "anna",
        img: anna,
        bio: "Bubbly mischief: innocent charm meets irresistible kawaii."
    },
];