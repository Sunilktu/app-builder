
import { gemini } from './geminiService';
import { Type } from "@google/genai";
import { DevelopmentStep, FileNode } from '../types';

export class OrchestratorService {
  
  static async createPlan(prompt: string): Promise<DevelopmentStep[]> {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          status: { type: Type.STRING },
          agent: { type: Type.STRING }
        },
        required: ["id", "title", "description", "status", "agent"]
      }
    };

    const orchestratorPrompt = `
      You are the Forge Orchestrator. Break down the following app development request into detailed steps.
      Request: "${prompt}"
      Structure the plan into 5-8 logical steps covering: Project Scaffolding, Backend API, Database models (if needed), Frontend UI, Integration.
      Status for all must start as 'pending'.
    `;

    return await gemini.generateJson(orchestratorPrompt, schema);
  }

  static async generateFiles(step: DevelopmentStep, currentFiles: FileNode[]): Promise<{ files: { path: string; content: string }[] }> {
    const schema = {
      type: Type.OBJECT,
      properties: {
        files: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["path", "content"]
          }
        }
      },
      required: ["files"]
    };

    const coderPrompt = `
      You are the Forge Coding Agent. Your task is to implement: "${step.title} - ${step.description}".
      Existing file structure (paths only): ${JSON.stringify(this.flattenPaths(currentFiles))}
      
      Generate the necessary code files for this step. 
      Use React/Vite/Tailwind for Frontend. 
      Use Node/Express for Backend. 
      Always provide complete, functional file contents.
    `;

    return await gemini.generateJson(coderPrompt, schema);
  }

  static flattenPaths(files: FileNode[]): string[] {
    let paths: string[] = [];
    files.forEach(f => {
      if (f.type === 'file') {
        paths.push(f.path);
      } else if (f.children) {
        paths = [...paths, ...this.flattenPaths(f.children)];
      }
    });
    return paths;
  }
}
