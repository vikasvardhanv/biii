import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Edit2 } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge, Workflow, WorkflowKey } from '../types';
import { fetchWorkflowByKey } from '../services/workflow';
import WorkflowDesigner from '../components/WorkflowDesigner';

export default function ViewWorkflow() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [keyFields, setKeyFields] = useState<WorkflowKey>({
    market: '',
    language: '',
    client: '',
    channel: '',
    page: '',
    placement: [],
    domain: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rightPanelTab, setRightPanelTab] = useState('details');
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (!key) return;

      try {
        setLoading(true);
        const data = await fetchWorkflowByKey(key);
        setWorkflow(data);
        setWorkflowName(data.name || '');
        setDescription(data.description || '');
        setWorkflowStatus(data.status || 'pending');

        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        } else if (data.workflow) {
          const { nodes, edges } = parseWorkflow(data.workflow);
          setNodes(nodes);
          setEdges(edges);
        }

        // Improved key parsing logic to handle different formats
        if (data.key) {
          const keyParts = data.key.split('_');
          
          // Find the index offset based on nameKey and descKey presence
          let startIndex = 0;
          
          // Check if the beginning parts match name and description
          if (keyParts.length > 2) {
            const nameKey = data.name ? data.name.replace(/\s+/g, '_').toUpperCase() : '';
            const descKey = data.description ? data.description.replace(/\s+/g, '_').toUpperCase() : '';
            
            if (keyParts[0] === nameKey && keyParts[1] === descKey) {
              startIndex = 2;
            }
          }
          
          // Calculate field indices
          const marketIndex = startIndex;
          const languageIndex = startIndex + 1;
          const clientIndex = startIndex + 2;
          const channelIndex = startIndex + 3;
          const pageIndex = startIndex + 4;
          const placementIndex = startIndex + 5;
          const domainIndex = startIndex + 6;
          
          // Make sure we don't go out of bounds
          if (keyParts.length > placementIndex) {
            const placementString = keyParts[placementIndex] || '';
            const placements = placementString.split('-');
            
            // Set key fields with proper indices
            setKeyFields({
              market: keyParts[marketIndex] || '',
              language: keyParts[languageIndex] || '',
              client: keyParts[clientIndex] || '',
              channel: keyParts[channelIndex] || '',
              page: keyParts[pageIndex] || '',
              placement: placements,
              domain: keyParts.length > domainIndex ? keyParts[domainIndex] : ''
            });
          } else {
            console.warn("Key in JSON does not have enough parts.");
            // Set whatever parts are available
            setKeyFields({
              market: keyParts[marketIndex] || '',
              language: keyParts.length > languageIndex ? keyParts[languageIndex] : '',
              client: keyParts.length > clientIndex ? keyParts[clientIndex] : '',
              channel: keyParts.length > channelIndex ? keyParts[channelIndex] : '',
              page: keyParts.length > pageIndex ? keyParts[pageIndex] : '',
              placement: [],
              domain: ''
            });
          }
        }
      } catch (err) {
        setError('Failed to load workflow. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [key]);

  const parseWorkflow = (workflow: any[]) => {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const nodeNameToId = new Map<string, string>();

    const baseX = 500;
    const nodeHeight = 100;
    const forkTaskOffsetX = 200;
    const startY = 120;

    let currentY = startY;

    // Store fork task nodeIds for later merge edge creation
    const forkTasksToMerge: { forkIndex: number, taskNodeIds: string[] }[] = [];

    const processNode = (
      node: any,
      depth: number = 0,
      xOffset: number = 0,
      yOffset: number = 0
    ): string => {
      const nodeId = crypto.randomUUID();
      nodeNameToId.set(node.nodeName, nodeId);

      const x = baseX + xOffset * forkTaskOffsetX;
      const y = currentY + yOffset * nodeHeight;

      nodes.push({
        type: "rectangle",
        id: nodeId,
        text: node.nodeName,
        url: node.url || "",
        headers: node.headers || {},
        inputParameters: node.inputParameters || [],
        retryCount: node.retryCount || 1,
        retryDelaySeconds: node.retryDelaySeconds || 1,
        timeoutMilliseconds: node.timeoutMilliseconds || 1000,
        position: { x, y },
        size: { width: 120, height: 60 },
        borderRadius: 10
      });

      // If this is a fork, collect its fork task nodeIds for merge edge creation
      if (node.forkTasks && Array.isArray(node.forkTasks)) {
        const forkTaskNodeIds: string[] = [];
        node.forkTasks.forEach((task: any, i: number) => {
          const taskId = processNode(
            task,
            depth + 1,
            xOffset + i + 1,
            yOffset + i + 1
          );
          edges.push({
            id: crypto.randomUUID(),
            source: nodeId,
            target: taskId,
          });
          forkTaskNodeIds.push(taskId);
        });
        // Store for later merge edge creation
        forkTasksToMerge.push({ forkIndex: workflow.findIndex(w => w === node), taskNodeIds: forkTaskNodeIds });
      }

      return nodeId;
    };

    // Place all main workflow nodes vertically, starting from startY
    workflow.forEach((node, index) => {
      processNode(node, 0, 0, index);
      currentY += nodeHeight;
    });

    // Sequential edges between main nodes (not forks)
    for (let i = 0; i < workflow.length - 1; i++) {
      const currentNodeId = nodeNameToId.get(workflow[i].nodeName);
      const nextNodeId = nodeNameToId.get(workflow[i + 1].nodeName);

      if (currentNodeId && nextNodeId && workflow[i].nodeName !== "Fork") {
        edges.push({
          id: crypto.randomUUID(),
          source: currentNodeId,
          target: nextNodeId,
        });
      }
    }

    // Add merge edges from each fork task to the next main node after the fork
    forkTasksToMerge.forEach(({ forkIndex, taskNodeIds }) => {
      const nextNode = workflow[forkIndex + 1];
      if (nextNode) {
        const nextNodeId = nodeNameToId.get(nextNode.nodeName);
        if (nextNodeId) {
          taskNodeIds.forEach(taskId => {
            edges.push({
              id: crypto.randomUUID(),
              source: taskId,
              target: nextNodeId,
            });
          });
        }
      }
    });

    return { nodes, edges };
  };

  const handleExport = () => {
    if (!workflow) return;

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.key}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle node selection for viewing node details
  const handleNodeSelected = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    
    // Switch to node details tab when a node is selected
    if (nodeId) {
      setRightPanelTab('node-details');
    }
  }, []);

  // Get the currently selected node
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  
  // Render node details panel for view mode
  const renderNodeDetails = () => {
    if (!selectedNode) {
      return (
        <div className="p-6 text-gray-500 text-center">
          Select a node to view its details
        </div>
      );
    }

    return (
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Node Name
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
            {selectedNode.text}
          </div>
        </div>

        {selectedNode.url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 overflow-x-auto">
              {selectedNode.url}
            </div>
          </div>
        )}

        {selectedNode.headers && Object.keys(selectedNode.headers).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Headers
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(selectedNode.headers, null, 2)}</pre>
            </div>
          </div>
        )}

        {selectedNode.inputParameters && selectedNode.inputParameters.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Input Parameters
            </label>
            <div className="space-y-1">
              {selectedNode.inputParameters.map((param, index) => (
                <div key={index} className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                  {param}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Count
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.retryCount || 1}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Delay (seconds)
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.retryDelaySeconds || 1}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (milliseconds)
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.timeoutMilliseconds || 1000}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error || 'Workflow not found'}
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // NoOp functions for read-only mode
  const noOpFunction = () => {};

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold text-gray-800">View Workflow</h1>
          </div>
          <div>
            <button
              onClick={() => navigate(`/edit/${workflow.key}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Edit2 size={16} className="inline mr-2" />
              Edit Workflow
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Workflow Designer */}
        <div className="w-2/3 p-4 overflow-auto border-r border-gray-200">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full">
            <div className="p-4 h-full">
              <WorkflowDesigner
                nodes={nodes}
                edges={edges}
                onNodesChange={noOpFunction}
                onEdgesChange={noOpFunction}
                nodeShape="rectangle"
                nodeBorderRadius={10}
                onNodeSelected={handleNodeSelected}
                selectedNodeId={selectedNodeId}
                readOnly={true}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Workflow Details */}
        <div className="w-1/3 p-4 overflow-auto bg-gray-50">
          {/* Tab navigation for right panel */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRightPanelTab('details')}
            >
              Details
            </button>
            {/* Node Details tab - only visible when a node is selected */}
            {selectedNodeId && (
              <button
                className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'node-details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setRightPanelTab('node-details')}
              >
                Node Details
              </button>
            )}
            <button
              className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'json' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRightPanelTab('json')}
            >
              JSON
            </button>
          </div>

          {rightPanelTab === 'details' ? (
            <>
              <div className="bg-white rounded-lg shadow-sm mb-4">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow Information</h2>

                  {/* Name and Description fields (read-only) */}
                  <div className="mb-4">
                    <label htmlFor="workflowName" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                      {workflowName}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 min-h-[50px]">
                      {description || <span className="text-gray-400 italic">No description provided</span>}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 capitalize">
                      {workflowStatus}
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-gray-700 my-4">Workflow Key Components</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(keyFields).map(([field, value]) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
                          {field}
                        </label>
                        <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                          {Array.isArray(value) ? value.join(', ') : value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 mt-4 p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="font-medium">Key:</span> {workflow.key}
                  </div>
                </div>
              </div>
            </>
          ) : rightPanelTab === 'node-details' ? (
            // Node details panel
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <div className="p-4">
                <h2 className="text-lg font-medium text-gray-700 mb-4">Node Details</h2>
                {renderNodeDetails()}
              </div>
            </div>
          ) : (
            // JSON tab for right panel
            <div className="bg-white rounded-lg shadow-sm mb-4 h-[calc(100%-60px)]">
              <div className="p-4 h-full">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow JSON</h2>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-[calc(100%-40px)]">
                  {JSON.stringify(workflow, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back to List
            </button>
            <div className="flex space-x-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Download size={20} />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



========================



import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, RotateCcw, MessageSquare, Edit2, X } from 'lucide-react';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowKey } from '../types';
import { fetchWorkflowByKey } from '../services/workflow';
import WorkflowDesigner from '../components/WorkflowDesigner';

interface ApproveWorkflowProps {
  onStatusChange?: (key: string, newStatus: 'pending' | 'approved' | 'review') => void;
}

function ApproveWorkflow({ onStatusChange }: ApproveWorkflowProps) {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'review'>('pending');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendSlack, setSendSlack] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('approval');
  const [keyFields, setKeyFields] = useState<WorkflowKey>({
    market: '',
    language: '',
    client: '',
    channel: '',
    page: '',
    placement: [],
    domain: ''
  });
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Load workflow data
  useEffect(() => {
    const loadWorkflow = async () => {
      if (!key) return;
      try {
        setLoading(true);
        const data = await fetchWorkflowByKey(key);
        setWorkflow(data);
        setWorkflowName(data.name || '');
        setDescription(data.description || '');

        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        } else if (data.workflow) {
          const { nodes, edges } = parseWorkflow(data.workflow);
          setNodes(nodes);
          setEdges(edges);
        }

        if (data.status) {
          setApprovalStatus(data.status as 'pending' | 'approved' | 'review');
        }

        if (data.comments) {
          setComments(data.comments);
        }

        // Improved key parsing logic
        if (data.key) {
          const keyParts = data.key.split('_');
          
          // Find the index offset based on nameKey and descKey presence
          let startIndex = 0;
          
          // Check if the beginning parts match name and description
          if (keyParts.length > 2) {
            const nameKey = data.name ? data.name.replace(/\s+/g, '_').toUpperCase() : '';
            const descKey = data.description ? data.description.replace(/\s+/g, '_').toUpperCase() : '';
            
            if (keyParts[0] === nameKey && keyParts[1] === descKey) {
              startIndex = 2;
            }
          }
          
          // Calculate field indices
          const marketIndex = startIndex;
          const languageIndex = startIndex + 1;
          const clientIndex = startIndex + 2;
          const channelIndex = startIndex + 3;
          const pageIndex = startIndex + 4;
          const placementIndex = startIndex + 5;
          const domainIndex = startIndex + 6;
          
          // Make sure we don't go out of bounds
          if (keyParts.length > placementIndex) {
            const placementString = keyParts[placementIndex] || '';
            const placements = placementString.split('-');
            
            // Set key fields with proper indices
            setKeyFields({
              market: keyParts[marketIndex] || '',
              language: keyParts[languageIndex] || '',
              client: keyParts[clientIndex] || '',
              channel: keyParts[channelIndex] || '',
              page: keyParts[pageIndex] || '',
              placement: placements,
              domain: keyParts.length > domainIndex ? keyParts[domainIndex] : ''
            });
          } else {
            console.warn("Key in JSON does not have enough parts.");
            // Set whatever parts are available
            setKeyFields({
              market: keyParts[marketIndex] || '',
              language: keyParts.length > languageIndex ? keyParts[languageIndex] : '',
              client: keyParts.length > clientIndex ? keyParts[clientIndex] : '',
              channel: keyParts.length > channelIndex ? keyParts[channelIndex] : '',
              page: keyParts.length > pageIndex ? keyParts[pageIndex] : '',
              placement: [],
              domain: ''
            });
          }
        }
      } catch (error) {
        console.error("Failed to load workflow:", error);
        setError('Failed to load workflow. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [key]);

  // Parse workflow data
  const parseWorkflow = (workflow: any[]) => {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const nodeNameToId = new Map<string, string>();

    const baseX = 500;
    const nodeHeight = 100;
    const forkTaskOffsetX = 200;
    const startY = 120;

    let currentY = startY;

    // Store fork task nodeIds for later merge edge creation
    const forkTasksToMerge: { forkIndex: number, taskNodeIds: string[] }[] = [];

    const processNode = (
      node: any,
      depth: number = 0,
      xOffset: number = 0,
      yOffset: number = 0
    ): string => {
      const nodeId = crypto.randomUUID();
      nodeNameToId.set(node.nodeName, nodeId);

      const x = baseX + xOffset * forkTaskOffsetX;
      const y = currentY + yOffset * nodeHeight;

      nodes.push({
        type: "rectangle",
        id: nodeId,
        text: node.nodeName,
        url: node.url || "",
        headers: node.headers || {},
        inputParameters: node.inputParameters || [],
        retryCount: node.retryCount || 1,
        retryDelaySeconds: node.retryDelaySeconds || 1,
        timeoutMilliseconds: node.timeoutMilliseconds || 1000,
        position: { x, y },
        size: { width: 120, height: 60 },
        borderRadius: 10
      });

      // If this is a fork, collect its fork task nodeIds for merge edge creation
      if (node.forkTasks && Array.isArray(node.forkTasks)) {
        const forkTaskNodeIds: string[] = [];
        node.forkTasks.forEach((task: any, i: number) => {
          const taskId = processNode(
            task,
            depth + 1,
            xOffset + i + 1,
            yOffset + i + 1
          );
          edges.push({
            id: crypto.randomUUID(),
            source: nodeId,
            target: taskId,
          });
          forkTaskNodeIds.push(taskId);
        });
        // Store for later merge edge creation
        forkTasksToMerge.push({ forkIndex: workflow.findIndex(w => w === node), taskNodeIds: forkTaskNodeIds });
      }

      return nodeId;
    };

    // Place all main workflow nodes vertically, starting from startY
    workflow.forEach((node, index) => {
      processNode(node, 0, 0, index);
      currentY += nodeHeight;
    });

    // Sequential edges between main nodes (not forks)
    for (let i = 0; i < workflow.length - 1; i++) {
      const currentNodeId = nodeNameToId.get(workflow[i].nodeName);
      const nextNodeId = nodeNameToId.get(workflow[i + 1].nodeName);

      if (currentNodeId && nextNodeId && workflow[i].nodeName !== "Fork") {
        edges.push({
          id: crypto.randomUUID(),
          source: currentNodeId,
          target: nextNodeId,
        });
      }
    }

    // Add merge edges from each fork task to the next main node after the fork
    forkTasksToMerge.forEach(({ forkIndex, taskNodeIds }) => {
      const nextNode = workflow[forkIndex + 1];
      if (nextNode) {
        const nextNodeId = nodeNameToId.get(nextNode.nodeName);
        if (nextNodeId) {
          taskNodeIds.forEach(taskId => {
            edges.push({
              id: crypto.randomUUID(),
              source: taskId,
              target: nextNodeId,
            });
          });
        }
      }
    });

    return { nodes, edges };
  };

  // Handle node selection
  const handleNodeSelected = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    
    // Switch to node details tab when a node is selected
    if (nodeId) {
      setRightPanelTab('node-details');
    }
  }, []);

  // Handle workflow approval
  const handleApprove = async () => {
    if (!key) return;

    setLoading(true);

    const allComments = [...comments];
    if (newComment.trim() !== '') {
      allComments.push(newComment);
    }

    const payload = {
      key: key,
      status: 'approved',
      comment: allComments,
    };

    try {
      const response = await fetch('/workflow/updateStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Status updated successfully:", data);

      setApprovalStatus('approved');
      setComments(allComments);
      setNewComment('');
      if (onStatusChange) {
        onStatusChange(key, 'approved');
      }
      alert('Workflow Approved!');

    } catch (error: any) {
      console.error("Failed to update status:", error);
      setError(`Failed to update status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle workflow review
  const handleReview = async () => {
    if (!key) return;
    setLoading(true);

    const allComments = [...comments];
    if (newComment.trim() !== '') {
      allComments.push(newComment);
    }

    const payload = {
      key: key,
      status: 'review',
      comment: allComments,
    };

    try {
      const response = await fetch('/workflow/updateStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Status updated successfully:", data);

      setApprovalStatus('review');
      setComments(allComments);
      setNewComment('');

      if (onStatusChange) {
        onStatusChange(key, 'review');
      }
      alert('Workflow review in progress!');

      if (sendSlack) {
        await sendNotification('slack', key, newComment);
      }
      if (sendEmail) {
        await sendNotification('email', key, newComment);
      }

    } catch (error: any) {
      console.error("Failed to update status:", error);
      setError(`Failed to update status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Send notification
  const sendNotification = async (type: string, key: string, comment: string) => {
    try {
      const response = await fetch('/workflow/sendNotification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, key, comment }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send ${type} notification. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`${type} notification sent successfully:`, data);
    } catch (error: any) {
      console.error(`Failed to send ${type} notification:`, error);
      setError(`Failed to send ${type} notification: ${error.message}`);
    }
  };

  // Handle edit workflow
  const handleEditWorkflow = async () => {
    if (!workflow?.key) return;
    if (approvalStatus === 'review') {
      setLoading(true);
      try {
        const payload = {
          key: workflow.key,
          status: 'pending',
          comment: comments,
        };
        const response = await fetch('/workflow/updateStatus', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Failed to update status. Status: ${response.status}`);
        }
        setApprovalStatus('pending');
      } catch (error: any) {
        setError(`Failed to update status: ${error.message}`);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    navigate(`/edit/${workflow.key}`);
  };

  // Get the currently selected node
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  
  // Render node details panel
  const renderNodeDetails = () => {
    if (!selectedNode) {
      return (
        <div className="p-6 text-gray-500 text-center">
          Select a node to view its details
        </div>
      );
    }

    return (
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Node Name
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
            {selectedNode.text}
          </div>
        </div>

        {selectedNode.url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 overflow-x-auto">
              {selectedNode.url}
            </div>
          </div>
        )}

        {selectedNode.headers && Object.keys(selectedNode.headers).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Headers
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(selectedNode.headers, null, 2)}</pre>
            </div>
          </div>
        )}

        {selectedNode.inputParameters && selectedNode.inputParameters.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Input Parameters
            </label>
            <div className="space-y-1">
              {selectedNode.inputParameters.map((param, index) => (
                <div key={index} className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                  {param}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Count
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.retryCount || 1}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Delay (seconds)
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.retryDelaySeconds || 1}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (milliseconds)
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
              {selectedNode.timeoutMilliseconds || 1000}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error || 'Workflow not found'}
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Define NoOp functions for read-only components
  const noOpFunction = () => {};

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold text-gray-800">Approve Workflow</h1>
          </div>
          <div className="flex items-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              approvalStatus === 'approved'
                ? 'bg-green-100 text-green-800'
                : approvalStatus === 'review'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
            }`}>
              {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Workflow Designer */}
        <div className="w-2/3 p-4 overflow-auto border-r border-gray-200">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full">
            <div className="p-4 h-full">
              <WorkflowDesigner
                nodes={nodes}
                edges={edges}
                onNodesChange={noOpFunction}
                onEdgesChange={noOpFunction}
                nodeShape="rectangle"
                nodeBorderRadius={10}
                onNodeSelected={handleNodeSelected}
                selectedNodeId={selectedNodeId}
                readOnly={true}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Approval and Details */}
        <div className="w-1/3 p-4 overflow-auto bg-gray-50">
          {/* Tab navigation for right panel */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'approval' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRightPanelTab('approval')}
            >
              Approval
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRightPanelTab('details')}
            >
              Details
            </button>
            {selectedNodeId && (
              <button
                className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'node-details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setRightPanelTab('node-details')}
              >
                Node Details
              </button>
            )}
            <button
              className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'json' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRightPanelTab('json')}
            >
              JSON
            </button>
          </div>

          {rightPanelTab === 'approval' ? (
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Approval</h2>

                {/* Add Comment */}
                <div className="mb-4">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Add Comment:
                  </label>
                  <textarea
                    id="comment"
                    className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${approvalStatus === 'approved' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={4}
                    disabled={approvalStatus === 'approved'}
                    placeholder="Enter your review comments here..."
                  />
                </div>

                {/* Previous Comments */}
                {comments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Previous Comments:</h3>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                      {comments.map((comment, index) => (
                        <div key={index} className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                          <div className="flex items-start">
                            <MessageSquare size={16} className="mr-2 text-gray-500 mt-1" />
                            <div>
                              <p className="text-sm text-gray-600">{comment}</p>
                              <span className="text-xs text-gray-400">Comment {index + 1}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notification Options */}
                {approvalStatus !== 'approved' && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Notification Options:</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="sendSlack"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={sendSlack}
                          onChange={() => setSendSlack(!sendSlack)}
                        />
                        <label htmlFor="sendSlack" className="ml-2 block text-sm text-gray-700">
                          Send Slack
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="sendEmail"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={sendEmail}
                          onChange={() => setSendEmail(!sendEmail)}
                        />
                        <label htmlFor="sendEmail" className="ml-2 block text-sm text-gray-700">
                          Send Email
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approval Status Message */}
                {approvalStatus !== 'pending' && (
                  <div className={`p-3 rounded-md mb-4 ${
                    approvalStatus === 'approved'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}>
                    <div className="flex">
                      {approvalStatus === 'approved' ? (
                        <ThumbsUp className="h-5 w-5 mr-2" />
                      ) : (
                        <RotateCcw className="h-5 w-5 mr-2" />
                      )}
                      <span className="text-sm font-medium">
                        {approvalStatus === 'approved'
                          ? 'This workflow has been approved.'
                          : 'This workflow is under review. Navigate to Edit page to make changes.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {approvalStatus === 'pending' && (
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={handleApprove}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      disabled={loading}
                    >
                      <ThumbsUp className="-ml-1 mr-2 h-5 w-5" />
                      Approve
                    </button>
                    <button
                      onClick={handleReview}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      disabled={loading}
                    >
                      <RotateCcw className="-ml-1 mr-2 h-5 w-5" />
                      Request Review
                    </button>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
                    {error}
                  </div>
                )}
              </div>
            </div>
          ) : rightPanelTab === 'details' ? (
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <div className="p-4">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow Information</h2>

                {/* Name and Description fields (read-only) */}
                <div className="mb-4">
                  <label htmlFor="workflowName" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                    {workflowName}
                  </div>
                </div>
                <div className="mb-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 min-h-[50px]">
                    {description || <span className="text-gray-400 italic">No description provided</span>}
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 capitalize">
                    {approvalStatus}
                  </div>
                </div>

                <h3 className="text-sm font-medium text-gray-700 my-4">Workflow Key Components</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(keyFields).map(([field, value]) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
                        {field}
                      </label>
                      // ApproveWorkflow.jsx (continued)
                      <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-500 mt-4 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="font-medium">Key:</span> {workflow.key}
                </div>
              </div>
            </div>
          ) : rightPanelTab === 'node-details' ? (
            // Node details tab
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <div className="p-4">
                <h2 className="text-lg font-medium text-gray-700 mb-4">Node Details</h2>
                {renderNodeDetails()}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm mb-4 h-[calc(100%-60px)]">
              <div className="p-4 h-full">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow JSON</h2>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-[calc(100%-40px)]">
                  {JSON.stringify(workflow, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back to List
            </button>
            <button
              onClick={handleEditWorkflow}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Edit2 size={16} className="inline mr-2" />
              Edit Workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApproveWorkflow;


=======================



// Add this code to the WorkflowDesigner component props
interface Props {
  // ... existing props
  readOnly?: boolean;  // Add this
}

// Inside the component function declaration, update to include readOnly
export default function WorkflowDesigner({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange,
  nodeShape = "rectangle",
  nodeBorderRadius = 4,
  onNodeSelected,
  selectedNodeId: externalSelectedNodeId,
  readOnly = false  // Initialize with default value
}: Props) {
  // ... existing code
  
  // Modify the node rendering to disable editing in read-only mode
  // In the nodes.map function, add this condition:
  
  return (
    <div
      key={node.id}
      className={`absolute transition-shadow duration-100 ease-in-out ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'ring-0'
      } ${draggedNode?.id === node.id ? 'shadow-xl' : 'shadow-md'}`}
      style={{
        width,
        height,
        transform: `translate(${topLeftX}px, ${topLeftY}px)`,
        cursor: readOnly ? 'default' : (isConnecting ? 'crosshair' : (isEditing ? 'text' : 'move')),
        zIndex: draggedNode?.id === node.id ? 10 : (isSelected ? 5 : 1),
        borderRadius: `${borderRadius}px`,
        background: node.backgroundColor || 'white',
        border: `2px solid ${nodeColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
      onMouseDown={readOnly ? (e) => {
        e.stopPropagation();
        // Only allow selection in read-only mode
        if (onNodeSelected) {
          const newSelectedNodeId = node.id === selectedNode ? null : node.id;
          setSelectedNode(newSelectedNodeId);
          onNodeSelected(newSelectedNodeId);
        }
      } : (e) => handleNodeMouseDown(node, e)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ... existing node content */}
      
      {/* Only show editing controls if not in read-only mode */}
      {!readOnly && (
        <>
          {/* Plus button for connecting */}
          <div
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-md border border-gray-200 w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
            onClick={(e) => startConnecting(node.id, e)}
          >
            <Plus size={16} className="text-blue-500" />
          </div>

          {isSelected && !isEditing && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex gap-1 bg-white rounded-md shadow-lg p-1 z-20">
              <button
                onClick={(e) => { e.stopPropagation(); resizeNode(node.id, true); }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Increase size"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); resizeNode(node.id, false); }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Decrease size"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={(e) => startEditing(node, e)}
                className="p-1 hover:bg-gray-100 rounded"
                title="Edit Text"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => deleteNode(node.id, e)}
                className="p-1 hover:bg-gray-100 rounded text-red-500"
                title="Delete Node"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
