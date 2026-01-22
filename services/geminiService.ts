
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY! });
  }

  async generateJson(prompt: string, schema: any, model: string = 'gemini-3-pro-preview') {
    const response = await this.ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse JSON response:", response.text);
      throw e;
    }
  }

  async generateStream(prompt: string, systemInstruction: string, model: string = 'gemini-3-flash-preview') {
    return await this.ai.models.generateContentStream({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
  }
}

export const gemini = new GeminiService();
