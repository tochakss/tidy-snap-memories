import birthday from "@/assets/photo-birthday.jpg";
import beach from "@/assets/photo-beach.jpg";
import dance from "@/assets/photo-dance.jpg";
import picnic from "@/assets/photo-picnic.jpg";
import hike from "@/assets/photo-hike.jpg";
import baby from "@/assets/photo-baby.jpg";
import wedding from "@/assets/photo-wedding.jpg";
import coffee from "@/assets/photo-coffee.jpg";
import dog from "@/assets/photo-dog.jpg";
import city from "@/assets/photo-city.jpg";
import food from "@/assets/photo-food.jpg";
import snow from "@/assets/photo-snow.jpg";

export type MediaType = "HEIC" | "JPG" | "MP4" | "MOV" | "PNG";

export interface Photo {
  id: string;
  src: string;
  filename: string;
  type: MediaType;
  score: number; // 1-10
  size: string; // e.g. "4.2 MB"
  date: string; // human readable
  aspect: "tall" | "wide" | "square";
  event?: string;
  reasoning?: string;
  breakdown?: { faces: number; composition: number; uniqueness: number; quality: number; brightness: number };
  sharpness?: number;
}

export const photos: Photo[] = [
  { id: "p1", src: birthday, filename: "IMG_4821.HEIC", type: "HEIC", score: 9, size: "4.2 MB", date: "Jun 14, 2025", aspect: "square", event: "Mia's Birthday",
    reasoning: "Only wide-angle family frame from this event. 4 smiling faces detected. Strong composition and warm golden-hour lighting.",
    breakdown: { faces: 92, composition: 88, uniqueness: 95, quality: 82, brightness: 78 }, sharpness: 94 },
  { id: "p2", src: beach, filename: "DSC_0142.JPG", type: "JPG", score: 8, size: "5.8 MB", date: "Jul 02, 2025", aspect: "tall", event: "Algarve Trip",
    reasoning: "Strong silhouettes against sunset. Rare candid action shot of all three kids together.",
    breakdown: { faces: 70, composition: 95, uniqueness: 88, quality: 80, brightness: 85 }, sharpness: 86 },
  { id: "p3", src: dance, filename: "MVI_0083.MP4", type: "MP4", score: 10, size: "128 MB", date: "May 22, 2025", aspect: "tall", event: "Spring Recital",
    reasoning: "High-motion clip with stable focus. Subject sharply rendered, dramatic stage lighting captured cleanly.",
    breakdown: { faces: 88, composition: 92, uniqueness: 98, quality: 95, brightness: 90 }, sharpness: 97 },
  { id: "p4", src: picnic, filename: "IMG_3201.HEIC", type: "HEIC", score: 7, size: "3.9 MB", date: "Oct 18, 2024", aspect: "square", event: "Autumn Picnic",
    reasoning: "Warm seasonal palette, natural group composition. Slight motion blur on foreground figure.",
    breakdown: { faces: 75, composition: 80, uniqueness: 70, quality: 72, brightness: 68 }, sharpness: 79 },
  { id: "p5", src: hike, filename: "IMG_2740.HEIC", type: "HEIC", score: 9, size: "6.1 MB", date: "Aug 09, 2025", aspect: "tall", event: "Dolomites Hike",
    reasoning: "Epic landscape with single human element for scale. Dramatic cloud formation and sun flare.",
    breakdown: { faces: 35, composition: 98, uniqueness: 92, quality: 90, brightness: 88 }, sharpness: 91 },
  { id: "p6", src: baby, filename: "IMG_5012.HEIC", type: "HEIC", score: 10, size: "4.7 MB", date: "Mar 03, 2025", aspect: "square", event: "Newborn",
    reasoning: "Once-in-a-lifetime moment. Soft window light, peaceful expression, intimate framing.",
    breakdown: { faces: 98, composition: 90, uniqueness: 100, quality: 88, brightness: 82 }, sharpness: 89 },
  { id: "p7", src: wedding, filename: "DSC_8821.JPG", type: "JPG", score: 9, size: "8.2 MB", date: "Sep 12, 2024", aspect: "tall", event: "Anna & Tom",
    reasoning: "Decisive ceremony moment captured. Both faces visible, soft light, milestone event.",
    breakdown: { faces: 95, composition: 88, uniqueness: 90, quality: 85, brightness: 80 }, sharpness: 92 },
  { id: "p8", src: coffee, filename: "IMG_6622.HEIC", type: "HEIC", score: 5, size: "2.1 MB", date: "Apr 28, 2025", aspect: "square", event: "Lisbon Cafe",
    reasoning: "Pleasing flat-lay but similar to 4 other coffee shots this week. Consider archiving duplicates.",
    breakdown: { faces: 0, composition: 70, uniqueness: 35, quality: 75, brightness: 72 }, sharpness: 78 },
  { id: "p9", src: dog, filename: "IMG_4499.HEIC", type: "HEIC", score: 8, size: "3.4 MB", date: "Jun 30, 2025", aspect: "square", event: "Luna at Home",
    reasoning: "Tack-sharp action shot, joyful expression. Bright daylight color rendering.",
    breakdown: { faces: 0, composition: 85, uniqueness: 80, quality: 90, brightness: 92 }, sharpness: 95 },
  { id: "p10", src: city, filename: "MVI_0091.MP4", type: "MP4", score: 7, size: "94 MB", date: "Feb 14, 2025", aspect: "tall", event: "NYC Weekend",
    reasoning: "Long-exposure light trails captured cleanly. Strong leading lines but no human subjects.",
    breakdown: { faces: 0, composition: 92, uniqueness: 78, quality: 88, brightness: 70 }, sharpness: 88 },
  { id: "p11", src: food, filename: "IMG_7710.HEIC", type: "HEIC", score: 4, size: "2.8 MB", date: "Mar 19, 2025", aspect: "square",
    reasoning: "Well-composed but generic food shot. 12 similar in library.",
    breakdown: { faces: 0, composition: 75, uniqueness: 25, quality: 80, brightness: 68 }, sharpness: 82 },
  { id: "p12", src: snow, filename: "IMG_8801.HEIC", type: "HEIC", score: 9, size: "5.5 MB", date: "Jan 11, 2025", aspect: "tall", event: "Alps Trip",
    reasoning: "Pristine alpine sunrise. Unique composition, no near-duplicates in library.",
    breakdown: { faces: 0, composition: 96, uniqueness: 94, quality: 90, brightness: 85 }, sharpness: 93 },
];

export const duplicateGroups = [
  {
    id: "g1",
    items: [
      { ...photos[0], score: 9, sharpness: 94 },
      { ...photos[0], id: "p1b", filename: "IMG_4822.HEIC", score: 6, sharpness: 71, size: "4.1 MB" },
      { ...photos[0], id: "p1c", filename: "IMG_4823.HEIC", score: 5, sharpness: 64, size: "4.3 MB" },
    ],
    bestId: "p1",
  },
  {
    id: "g2",
    items: [
      { ...photos[1], score: 8, sharpness: 86 },
      { ...photos[1], id: "p2b", filename: "DSC_0143.JPG", score: 7, sharpness: 78, size: "5.6 MB" },
    ],
    bestId: "p2",
  },
  {
    id: "g3",
    items: [
      { ...photos[7], score: 5, sharpness: 78 },
      { ...photos[7], id: "p8b", filename: "IMG_6623.HEIC", score: 4, sharpness: 70, size: "2.0 MB" },
      { ...photos[7], id: "p8c", filename: "IMG_6624.HEIC", score: 3, sharpness: 58, size: "2.1 MB" },
    ],
    bestId: "p8",
  },
];

export function scoreColor(score: number): "high" | "mid" | "low" {
  if (score >= 7) return "high";
  if (score >= 4) return "mid";
  return "low";
}
