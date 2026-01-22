
import React, { useState, useEffect, useRef } from 'react';
import { 
  PanelLeft, 
  Terminal, 
  Code2, 
  Play, 
  Layers, 
  MessageSquare, 
  Settings,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  Send,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Download
} from 'lucide-react';
import { ChatMessage, ProjectState, FileNode, DevelopmentStep } from './types';
import { OrchestratorService } from './services/orchestratorService';

// --- Sub-components (defined outside to avoid re-renders) ---

const FileIcon = ({ name }: { name: string }) => {
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className="w-4 h-4 text-blue-400" />;
  if (name.endsWith('.css')) return <FileCode className="w-4 h-4 text-purple-400" />;
  if (name.endsWith('.json')) return <FileCode className="w-4 h-4 text-yellow-400" />;
  return <FileCode className="w-4 h-4 text-gray-400" />;
};

const SidebarItem = ({ node, activePath, onSelect, depth = 0 }: { 
  node: FileNode; 
  activePath: string | null; 
  onSelect: (path: string) => void;
  depth?: number;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isFile = node.type === 'file';
  const isActive = activePath === node.path;

  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-gray-800 transition-colors ${isActive ? 'bg-blue-900/30 border-r-2 border-blue-500' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => isFile ? onSelect(node.path) : setIsOpen(!isOpen)}
      >
        {!isFile && (
          isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
        {isFile ? <FileIcon name={node.name} /> : <Folder className="w-4 h-4 text-blue-500 fill-blue-500/20" />}
        <span className={`text-sm truncate ${isActive ? 'text-blue-300 font-medium' : 'text-gray-400'}`}>
          {node.name}
        </span>
      </div>
      {!isFile && isOpen && node.children?.map(child => (
        <SidebarItem 
          key={child.path} 
          node={child} 
          activePath={activePath} 
          onSelect={onSelect} 
          depth={depth + 1} 
        />
      ))}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [project, setProject] = useState<ProjectState>({
    files: [],
    activeFilePath: null,
    plan: [],
    logs: ['[System] Forge initialized. Waiting for prompt...']
  });
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addLog = (msg: string) => {
    setProject(prev => ({ ...prev, logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] }));
  };

  const updateFileContent = (path: string, content: string) => {
    setProject(prev => {
      const newFiles = JSON.parse(JSON.stringify(prev.files));
      const update = (nodes: FileNode[]) => {
        for (let n of nodes) {
          if (n.path === path) { n.content = content; return true; }
          if (n.children && update(n.children)) return true;
        }
        return false;
      };
      
      if (!update(newFiles)) {
        // Handle new file creation logic if path doesn't exist
        const parts = path.split('/');
        let currentLevel = newFiles;
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath += (currentPath ? '/' : '') + part;
          const existing = currentLevel.find((n: FileNode) => n.name === part);
          if (existing) {
            if (i === parts.length - 1) existing.content = content;
            else currentLevel = existing.children;
          } else {
            const newNode: FileNode = {
              name: part,
              type: i === parts.length - 1 ? 'file' : 'folder',
              path: currentPath,
              children: i === parts.length - 1 ? undefined : [],
              content: i === parts.length - 1 ? content : undefined
            };
            currentLevel.push(newNode);
            currentLevel = newNode.children || [];
          }
        }
      }
      return { ...prev, files: newFiles };
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isBuilding) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsBuilding(true);
    addLog(`Received mission: "${userMsg.content}"`);

    try {
      // Step 1: Orchestration - Create Plan
      addLog("Orchestrator: Analyzing requirements and mapping strategy...");
      const plan = await OrchestratorService.createPlan(userMsg.content);
      setProject(prev => ({ ...prev, plan }));
      addLog(`Orchestrator: Plan created with ${plan.length} phases.`);

      // Step 2: Coding Agents - Execute steps sequentially
      for (const step of plan) {
        setProject(prev => ({
          ...prev,
          plan: prev.plan.map(p => p.id === step.id ? { ...p, status: 'in-progress' } : p)
        }));
        
        addLog(`Agent [${step.agent}]: Working on "${step.title}"...`);
        const { files } = await OrchestratorService.generateFiles(step, project.files);
        
        files.forEach(f => {
          updateFileContent(f.path, f.content);
          if (!project.activeFilePath) {
             setProject(prev => ({ ...prev, activeFilePath: f.path }));
          }
        });

        setProject(prev => ({
          ...prev,
          plan: prev.plan.map(p => p.id === step.id ? { ...p, status: 'completed' } : p)
        }));
        addLog(`Agent [${step.agent}]: Phase "${step.title}" successfully integrated.`);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've finished building the prototype of your app. You can explore the code in the editor or view the generated structure.`,
        timestamp: Date.now()
      }]);
      
      addLog("System: All agents completed. Forge idle.");
    } catch (error) {
      console.error(error);
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBuilding(false);
    }
  };

  const getActiveFileContent = () => {
    const find = (nodes: FileNode[]): string | undefined => {
      for (let n of nodes) {
        if (n.path === project.activeFilePath) return n.content;
        if (n.children) {
          const res = find(n.children);
          if (res !== undefined) return res;
        }
      }
    };
    return find(project.files) || "// Select a file to view its contents";
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-gray-100 tracking-tight">FORGE <span className="text-blue-500 font-light ml-1">META-BUILDER</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded-md">
             <div className={`w-2 h-2 rounded-full ${isBuilding ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
             <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{isBuilding ? 'Agent Active' : 'Forge Idle'}</span>
          </div>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Chat Pane */}
        <div className="w-80 lg:w-96 border-r border-gray-800 flex flex-col bg-gray-950">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> Agent Comms
            </h2>
            {isBuilding && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="p-4 bg-blue-900/20 rounded-full">
                  <Play className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-gray-200 font-medium">Ready to Forge?</h3>
                  <p className="text-gray-500 text-sm mt-2">Describe the application you want to build and let the agents handle the rest.</p>
                </div>
                <div className="w-full space-y-2 mt-4">
                   {['Build a modern SaaS Landing Page', 'Create a Weather App with React', 'Design a Task Manager with Express'].map(t => (
                     <button key={t} onClick={() => setInput(t)} className="w-full text-left p-2.5 text-xs bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition-all text-gray-400">
                       {t}
                     </button>
                   ))}
                </div>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-gray-900 text-gray-300 border border-gray-800 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
                <span className="text-[10px] text-gray-600 mt-1 uppercase font-bold tracking-tighter">
                  {m.role === 'user' ? 'Architect' : 'Orchestrator'}
                </span>
              </div>
            ))}
          </div>

          {/* Prompt Input */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/30">
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message Forge..."
                rows={2}
                disabled={isBuilding}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-3 pr-12 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none disabled:opacity-50"
              />
              <button 
                onClick={handleSend}
                disabled={isBuilding || !input.trim()}
                className="absolute right-3 bottom-3 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right Content Area */}
        <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
          
          {/* Main Action Bar */}
          <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/20">
            <div className="flex items-center gap-1 bg-gray-900/80 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('editor')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'editor' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Code2 className="w-3.5 h-3.5" /> Editor
              </button>
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'preview' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Play className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
            
            <div className="flex items-center gap-3">
               <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-md transition-all">
                 <Download className="w-3.5 h-3.5" /> Export
               </button>
               <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-500 rounded-md shadow-lg shadow-blue-500/20 transition-all">
                 <Play className="w-3.5 h-3.5 fill-current" /> Deploy
               </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* File Explorer (Inner Sidebar) */}
            <div className="w-64 border-r border-gray-800 flex flex-col bg-gray-950/50">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Workspace</span>
                <PanelLeft className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {project.files.map(f => (
                  <SidebarItem 
                    key={f.path} 
                    node={f} 
                    activePath={project.activeFilePath} 
                    onSelect={(path) => setProject(prev => ({ ...prev, activeFilePath: path }))} 
                  />
                ))}
                {project.files.length === 0 && (
                  <div className="p-4 text-xs text-gray-600 italic">No files generated yet.</div>
                )}
              </div>

              {/* Development Plan Checklist */}
              <div className="h-1/3 border-t border-gray-800 bg-gray-900/20 flex flex-col">
                 <div className="p-2 border-b border-gray-800 bg-gray-900/40">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Development Loop</span>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                   {project.plan.map(step => (
                     <div key={step.id} className="flex items-start gap-2 p-1.5 rounded bg-gray-900/40 border border-gray-800/50">
                        {step.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5" /> : 
                         step.status === 'in-progress' ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin mt-0.5" /> :
                         <Circle className="w-3.5 h-3.5 text-gray-600 mt-0.5" />}
                        <div className="flex-1 overflow-hidden">
                           <p className="text-[11px] font-medium text-gray-300 truncate">{step.title}</p>
                           <p className="text-[9px] text-gray-500 uppercase">{step.agent}</p>
                        </div>
                     </div>
                   ))}
                   {project.plan.length === 0 && (
                     <div className="p-2 text-[10px] text-gray-600">Waiting for plan...</div>
                   )}
                 </div>
              </div>
            </div>

            {/* Code / Preview Area */}
            <div className="flex-1 flex flex-col bg-[#0d1117]">
               {activeTab === 'editor' ? (
                 <>
                   {/* Editor Tabs */}
                   <div className="h-10 bg-[#161b22] border-b border-gray-800 flex items-center px-2 gap-1 overflow-x-auto overflow-y-hidden">
                     {project.activeFilePath && (
                       <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-gray-800 border-b-0 rounded-t-md text-sm text-blue-400">
                         <FileIcon name={project.activeFilePath.split('/').pop() || ''} />
                         <span className="whitespace-nowrap">{project.activeFilePath.split('/').pop()}</span>
                       </div>
                     )}
                   </div>
                   
                   {/* Monaco-like Editor Area */}
                   <div className="flex-1 relative overflow-hidden flex">
                      <div className="w-12 bg-[#0d1117] border-r border-gray-800 flex flex-col items-center py-4 text-gray-700 text-[11px] mono select-none">
                        {Array.from({ length: 40 }).map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <div className="flex-1 bg-[#0d1117] p-4 font-mono text-sm leading-relaxed overflow-auto text-gray-300 whitespace-pre">
                        <code>{getActiveFileContent()}</code>
                      </div>
                   </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col bg-white">
                    <div className="h-8 bg-gray-100 border-b border-gray-300 flex items-center px-3 gap-2">
                       <div className="flex gap-1.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                         <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                         <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                       </div>
                       <div className="flex-1 flex justify-center">
                         <div className="px-12 py-0.5 bg-white border border-gray-300 rounded text-[10px] text-gray-400 font-medium">
                           localhost:5173
                         </div>
                       </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 space-y-4">
                       <Play className="w-12 h-12 text-gray-200" />
                       <div className="text-center">
                         <p className="text-lg font-medium text-gray-600">Forge Sandbox Active</p>
                         <p className="text-sm">Mock preview rendering generated structure...</p>
                       </div>
                       
                       <div className="w-2/3 grid grid-cols-2 gap-4 mt-8">
                         {project.files.map(f => (
                           <div key={f.path} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-3">
                             <div className="p-2 bg-blue-50 rounded">
                               <FileCode className="w-5 h-5 text-blue-500" />
                             </div>
                             <div className="flex-1 overflow-hidden">
                               <p className="text-xs font-bold text-gray-700 truncate">{f.name}</p>
                               <p className="text-[10px] text-gray-400">{f.type === 'folder' ? 'Component Group' : 'Functional Module'}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                 </div>
               )}

               {/* Log Terminal (Bottom) */}
               <div className="h-40 border-t border-gray-800 bg-[#0d1117] flex flex-col">
                  <div className="h-8 px-4 flex items-center justify-between border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Terminal className="w-3.5 h-3.5" /> Output Monitor
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-600">Memory:</span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 w-1/3" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 p-3 font-mono text-[11px] text-gray-500 overflow-y-auto space-y-0.5">
                    {project.logs.map((log, i) => (
                      <div key={i} className={log.includes('Error') ? 'text-red-400' : log.includes('Agent') ? 'text-blue-400' : ''}>
                        {log}
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Deployment Footer */}
      <footer className="h-8 border-t border-gray-800 bg-gray-950 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-bold tracking-tight">
             <AlertCircle className="w-3 h-3 text-blue-500" /> Vibe coding: Enabled
           </div>
           <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-bold tracking-tight">
             <CheckCircle2 className="w-3 h-3 text-green-500" /> Reflection: Active
           </div>
        </div>
        <div className="text-[10px] text-gray-600 font-mono">
          FORGE_SESSION: 0x{Date.now().toString(16).toUpperCase()}
        </div>
      </footer>
    </div>
  );
}
