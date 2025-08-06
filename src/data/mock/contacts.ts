import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import dummy from '@/dummy/dummy';

export const contacts: InfluencerDataModel[] = [
    {
        id: "loli",
        name: "Lola Fairfax",
        username: "loli",
        img: dummy.getImage("loli"),
        bio: "Daring temptress: confident, playful, and always in contro"
    },
    {
        id: "bella",
        name: "Bella Thorne",
        username: "bella",
        img: dummy.getImage("bella"),
        bio: "Warm-hearted soulmate: gentle comfort with a playful spark."
    },
    {
        id: "anna",
        name: "Annabelle Norton",
        username: "anna",
        img: dummy.getImage("anna"),
        bio: "Bubbly mischief: innocent charm meets irresistible kawaii."
    },
];