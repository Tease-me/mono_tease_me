import * as image from "./image"
import * as users from "./user"
import * as influencers from "./influencers"

import bella from "@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.png";
import anna from "@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg";
import loli from "@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg";

import bellaVideo from "@/assets/mock/profile-video/0af48251-5061-4cf2-8c48-13d0ddd3c52c.mp4";
import annaVideo from "@/assets/mock/profile-video/20250806-1356-01k1yrcdpme5mbxcev84z7kyd5.mp4";
import loliVideo from "@/assets/mock/profile-video/20250806-1353-01k1yr5txye15vszwhfmq54mjn.mp4";

// Random Images

const LAST_NAMES = ["Smith", "Patel", "Chen", "Garcia", "Brown", "Wilson", "Khan", "Taylor", "Singh", "Martin"];
const MALE_FIRST_NAMES = ["Liam", "Noah", "Ethan", "Leo", "Mason", "Oliver", "James", "Lucas", "Henry", "Jack"];
const FEMALE_FIRST_NAMES = ["Ava", "Mia", "Zoe", "Aria", "Isla", "Emma", "Sophia", "Olivia", "Amelia", "Lily"];
const FIRST_NAMES = [...MALE_FIRST_NAMES, ...FEMALE_FIRST_NAMES]

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

/**
 * Format a Date as dd/mm/yyyy (zero‑padded).
 */
function formatDateDDMMYYYY(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const generateRandomId = (): string => Math.random().toString(36).slice(2, 10);
const makeUsername = (name: string): string => name.toLowerCase().replace(/\s+/g, "_") + Math.floor(100 + Math.random() * 900);
const getRandomName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
const getRandomMaleFirstName = (): string => pick(MALE_FIRST_NAMES);
const getRandomMaleName = (): string => `${pick(MALE_FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const getRandomFemaleFirstName = (): string => pick(FEMALE_FIRST_NAMES);
const getRandomFemaleName = (): string => `${pick(FEMALE_FIRST_NAMES)} ${pick(LAST_NAMES)}`;

const dummy = {
    getImage,
    getVideo,
    getRandomDate,
    formatDateDDMMYYYY,
    getRandomName,
    getRandomMaleFirstName,
    getRandomFemaleFirstName,
    makeUsername,
    generateRandomId,
    getRandomMaleName,
    getRandomFemaleName,
    image,
    users,
    influencers
};

export default dummy;