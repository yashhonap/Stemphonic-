import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeTrack(title: string, author: string) {
  const prompt = `
    Analyze this song: "${title}" by "${author}".
    Provide a brief response in JSON format (no backticks):
    {
      "mood": "Brief description of the mood",
      "bpm": "Estimated BPM",
      "key": "Estimated Key",
      "facts": ["3 interesting facts about the song or production"],
      "vocalType": "Description of the vocal style",
      "eqSuggestion": "Brief EQ advice for mixing/separation"
    }
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const text = response.text || "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return null;
  }
}
