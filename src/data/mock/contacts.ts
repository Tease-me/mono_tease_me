import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import loliPic from "@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.jpg";
import bella from "@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg";
import anna from "@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg";

export const contacts: InfluencerDataModel[] = [
    {
        id: "loli",
        name: "Lola Fairfax",
        username: "loli",
        likes: "27.3M",
        img: loliPic,
        featured: true,
    },
    {
        id: "bella",
        name: "Bella Thorne",
        username: "bella",
        likes: "24.5M",
        img: bella,
    },
    {
        id: "anna",
        name: "Annabelle Norton",
        username: "anna",
        likes: "10.1M",
        img: anna,
    },
];