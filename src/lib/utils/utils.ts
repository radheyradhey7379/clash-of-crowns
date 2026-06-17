import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { domToPng } from "modern-screenshot";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function downloadElement(element: HTMLElement, fileName: string) {
  try {
    const dataUrl = await domToPng(element, {
      backgroundColor: "#030204",
      scale: 2,
      quality: 1,
    });
    
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  } catch (error) {
    console.error("Failed to download element:", error);
    alert("Failed to download image. Please try again.");
  }
}
