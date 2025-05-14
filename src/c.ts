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
  const [activeTab, setActiveTab] = useState<'details' | 'json'>('details');

  const handleSave = () => {
    console.log('Saving workflow...', { workflowName, keyFields, nodes, edges });
    navigate('/workflows');
  };

  const workflowJson = JSON.stringify({ workflowName, keyFields, nodes, edges }, null, 2);

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Workflow Builder</h1>
          <p className="text-sm text-gray-500">Design your custom workflow</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border px-4 py-2 rounded-md shadow">Import</button>
          <button className="bg-white border px-4 py-2 rounded-md shadow">Export</button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700"
          >
            Save Workflow
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <div className="col-span-9 overflow-hidden">
          <WorkflowDesigner
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
          />
        </div>

        <div className="col-span-3 border-l bg-white p-4 overflow-y-auto">
          <div className="mb-4 border-b flex gap-4">
            <button
              className={`pb-2 ${activeTab === 'details' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-500'}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              className={`pb-2 ${activeTab === 'json' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-500'}`}
              onClick={() => setActiveTab('json')}
            >
              JSON
            </button>
          </div>

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Workflow Name</label>
                <input
                  className="w-full border px-3 py-2 rounded-md"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                />
              </div>
              {Object.entries(keyFields).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium capitalize">{key}</label>
                  <input
                    className="w-full border px-3 py-2 rounded-md"
                    value={Array.isArray(value) ? value.join(', ') : value}
                    onChange={(e) =>
                      setKeyFields({
                        ...keyFields,
                        [key]: key === 'placement' ? e.target.value.split(',').map((s) => s.trim()) : e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'json' && (
            <pre className="text-xs bg-gray-100 p-2 rounded-md overflow-auto max-h-[60vh]">
              {workflowJson}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
