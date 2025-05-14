import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit2, Maximize2, Minimize2, X, Settings } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge } from '../types';
import WorkflowToolbox from './WorkflowToolbox';

interface Props {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
}

export default function WorkflowDesigner({ nodes, edges, onNodesChange, onEdgesChange }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const renderNodes = () =>
    nodes.map((node) => (
      <div
        key={node.id}
        className={`absolute rounded-xl border p-4 shadow-md transition-all cursor-pointer bg-white ${
          selectedNode === node.id ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-300'
        }`}
        style={{ top: node.y, left: node.x }}
        onClick={() => setSelectedNode(node.id)}
      >
        <div className="font-semibold text-sm mb-1">{node.label}</div>
        <div className="text-xs text-gray-500">{node.type}</div>
      </div>
    ));

  return (
    <div className="grid grid-cols-12 h-screen w-full">
      {/* Task Drawer */}
      <div className="col-span-2 bg-gray-50 border-r p-4 overflow-y-auto">
        <WorkflowToolbox />
      </div>

      {/* Canvas */}
      <div className="col-span-7 relative" ref={canvasRef}>
        <div className="absolute inset-0 bg-white">
          {renderNodes()}
          {/* Edges can be rendered with SVG lines if needed */}
        </div>
      </div>

      {/* Right Panel */}
      <div className="col-span-3 border-l bg-white p-4 overflow-y-auto">
        {selectedNode ? (
          <div>
            <h2 className="text-lg font-bold mb-4">Task Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input className="w-full border px-3 py-2 rounded-md" defaultValue="Sample Task" />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea className="w-full border px-3 py-2 rounded-md" rows={3}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium">Timeout</label>
                <input type="number" className="w-full border px-3 py-2 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="accent-blue-600" />
                <label>Restartable</label>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md">Save</button>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Select a task node to configure.</div>
        )}
      </div>
    </div>
  );
}




import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkflowDesigner from '../components/WorkflowDesigner';
import type { WorkflowKey, WorkflowNode, WorkflowEdge } from '../types';

export default function CreateWorkflow() {
  const navigate = useNavigate();
  const [workflowName, setWorkflowName] = useState('');
  const [keyFields, setKeyFields] = useState<WorkflowKey>({
    market: '',
    language: '',
    client: '',
    channel: '',
    page: '',
    placement: [],
    domain: ''
  });
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);

  const handleSave = () => {
    console.log('Saving workflow...', { workflowName, keyFields, nodes, edges });
    navigate('/workflows');
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Workflow Builder</h1>
          <p className="text-sm text-gray-500">Design your custom workflow</p>
        </div>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Save Workflow
        </button>
      </header>

      <div className="flex-1">
        <WorkflowDesigner
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
        />
      </div>
    </div>
  );
}
