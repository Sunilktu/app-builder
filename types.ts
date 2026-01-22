
export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  path: string;
}

export interface ProjectState {
  files: FileNode[];
  activeFilePath: string | null;
  plan: DevelopmentStep[];
  logs: string[];
}

export interface DevelopmentStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  agent: 'orchestrator' | 'coder' | 'reviewer';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AgentResponse {
  type: 'plan' | 'code' | 'review';
  data: any;
}
