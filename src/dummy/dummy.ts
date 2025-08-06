

import bella from "@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.png";
import anna from "@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg";
import loli from "@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg";

import bellaVideo from "@/assets/mock/profile-video/0af48251-5061-4cf2-8c48-13d0ddd3c52c.mp4";
import annaVideo from "@/assets/mock/profile-video/20250806-1353-01k1yr5txye15vszwhfmq54mjn.mp4";
import loliVideo from "@/assets/mock/profile-video/20250806-1356-01k1yrcdpme5mbxcev84z7kyd5.mp4";

const images = {
    loli,
    bella,
    anna,
};

const videos = {
    loli: loliVideo,
    bella: bellaVideo,
    anna: annaVideo,
};

function getImage(key: keyof typeof images) {
    return images[key];
}

function getVideo(key: keyof typeof videos) {
    return videos[key];
}

function getRandomDate(
    start: Date = new Date(2000, 0, 1),
    end: Date = new Date()
): Date {
    const range = end.getTime() - start.getTime();
    return new Date(start.getTime() + Math.random() * range);
}

const dummy = {
    getImage,
    getVideo,
    getRandomDate,
};

export default dummy;