

import bella from "@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.jpg";
import anna from "@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg";
import loli from "@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg";

const images = {
    loli,
    bella,
    anna,
};

function getImage(key: keyof typeof images) {
    return images[key];
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
    getRandomDate,
};

export default dummy;