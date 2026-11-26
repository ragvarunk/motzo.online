// The questions Motzo's agent asks every business before the owner decides.
// Rag's list: price, type of service, how they will do it, materials used,
// plus everything else the owner needs to understand the job and trust them.

export const SHOP_QUESTIONS: { topic: string; question: string }[] = [
  { topic: "Price", question: "What is the total, split into parts, labor, fees and tax? Can the price change, and why?" },
  { topic: "Parts", question: "Is the part OEM, OEM-equivalent or aftermarket? Which brand? Is it in stock, or when does it arrive?" },
  { topic: "Materials", question: "What materials do you use (for glass: which adhesive, and how long before the vehicle is safe to drive)?" },
  { topic: "How the work is done", question: "What are the steps, how long does it take, and is it done at the owner's location or in your shop?" },
  { topic: "Timing", question: "What is your earliest slot? Can it be done today?" },
  { topic: "Who does it", question: "How many technicians do you have, how many years have you done this work, and what certifications do they hold?" },
  { topic: "Safety systems", question: "Do cameras or sensors need calibration after this job, and do you do it?" },
  { topic: "Warranty", question: "What does your warranty cover and for how long?" },
  { topic: "Insurance", question: "Do you bill the insurer directly, and what would the owner pay?" },
  { topic: "Payment", question: "When and how do you take payment?" },
];
