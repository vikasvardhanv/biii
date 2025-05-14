import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, RotateCcw, MessageSquare } from 'lucide-react';
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

        if (data.key) {
          const keyParts = data.key.split('_');
          setKeyFields({
            market: keyParts[0] || '',
            language: keyParts[1] || '',
            client: keyParts[2] || '',
            channel: keyParts[3] || '',
            page: keyParts[4] || '',
            placement: keyParts[5] ? keyParts[5].split('-') : [],
            domain: keyParts[6] || ''
          });
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

  const parseWorkflow = (workflow: any[]) => {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    
    const traverse = (node: any, parentId: string | null = null, depth: number = 0, index: number = 0) => {
      const nodeId = crypto.randomUUID();
      nodes.push({
        type: "rectangle",
        id: nodeId,
        text: node.nodeName,
        inputParameters: node.inputParameters || [],
        retryCount: node.retryCount || 1,
        retryDelaySeconds: node.retryDelaySeconds || 1,
        timeoutMilliseconds: node.timeoutMilliseconds || 1000,
        position: { x: index * 200, y: depth * 100 },
        size: { width: 120, height: 60 },
        borderRadius: 10
      });
      
      if (parentId) {
        edges.push({
          id: crypto.randomUUID(),
          source: parentId,
          target: nodeId
        });
      }
      
      // Process regular children
      if (node.children) {
        node.children.forEach((child: any, childIndex: number) => 
          traverse(child, nodeId, depth + 1, childIndex));
      }
      
      // Process fork tasks
      if (node.forkTasks) {
        node.forkTasks.forEach((fork: any, forkIndex: number) => 
          traverse(fork, nodeId, depth + 1, index + forkIndex + (node.children?.length || 0)));
      }
    };

    workflow.forEach((node: any, index: number) => traverse(node, null, 0, index));

    // Centering logic
    const minX = Math.min(...nodes.map(node => node.position.x));
    const minY = Math.min(...nodes.map(node => node.position.y));
    const maxX = Math.max(...nodes.map(node => node.position.x));
    const maxY = Math.max(...nodes.map(node => node.position.y));

    const centerX = (minX + maxX) / 2;
    const offsetX = 500 - centerX;
    const offsetY = 100;

    const positions = new Set<string>();

    nodes.forEach(node => {
      node.position.x += offsetX;
      node.position.y += offsetY;

      let curPosition = `${node.position.x},${node.position.y}`;

      while (positions.has(curPosition)) {
        node.position.y += offsetY;
        curPosition = `${node.position.x},${node.position.y}`;
      }
      positions.add(curPosition);
    });

    return { nodes, edges };
  };

  const handleApprove = async () => {
    if (!key) return;

    setLoading(true);

    const allComments = [...comments, newComment].filter(comment => comment.trim() !== '');
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

  const handleReview = async () => {
    if (!key) return;
    setLoading(true);

    const allComments = [...comments, newComment].filter(comment => comment.trim() !== '');
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

      // Send slack message or email if selected
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
                onNodesChange={() => {}}
                onEdgesChange={() => {}}
                nodeShape="rectangle"
                nodeBorderRadius={10}
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
    </div>
  );
}

export default ApproveWorkflow;




============================


// WorkflowDesigner.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2, Edit2, Maximize2, Minimize2, X, Settings, Plus, Code, Save } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge } from '../types';
import WorkflowToolbox from './WorkflowToolbox';

interface Props {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  nodeShape?: string;
  nodeBorderRadius?: number;
  readOnly?: boolean;
}

interface NodeConfigState {
  url: string;
  headersString: string;
  inputParameters: string[];
  retryCount: number;
  retryDelaySeconds: number;
  timeoutMilliseconds: number;
}

// Define node colors by type
const NODE_COLORS = {
  arbitration: { bg: '#E8F5E9', border: '#4CAF50' },
  audiencefilter: { bg: '#F3E5F5', border: '#9C27B0' },
  contentenrichment: { bg: '#E3F2FD', border: '#2196F3' },
  contentevent: { bg: '#FFF3E0', border: '#FF9800' },
  contextenrichment: { bg: '#E1F5FE', border: '#03A9F4' },
  delj: { bg: '#FBE9E7', border: '#FF5722' },
  drone: { bg: '#F1F8E9', border: '#8BC34A' },
  fork: { bg: '#FFEBEE', border: '#F44336' },
  orchestration: { bg: '#E8EAF6', border: '#3F51B5' },
  recommender: { bg: '#EDE7F6', border: '#673AB7' },
  default: { bg: '#DBEAFE', border: '#3B82F6' }
};

export default function WorkflowDesigner({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  nodeShape = 'rectangle',
  nodeBorderRadius = 4,
  readOnly = false
}: Props) {
  const [draggedNode, setDraggedNode] = useState<WorkflowNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeText, setNodeText] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNodeConfig, setShowNodeConfig] = useState<string | null>(null);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [nodeConfig, setNodeConfig] = useState<NodeConfigState>({
    url: '',
    headersString: '',
    inputParameters: [],
    retryCount: 1,
    retryDelaySeconds: 1,
    timeoutMilliseconds: 1000
  });
  const [newParameter, setNewParameter] = useState('');
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [edgeControlPoints, setEdgeControlPoints] = useState<{[key: string]: {x1: number, y1: number, x2: number, y2: number}}>({});

  const workflowJson = useMemo(() => {
    return JSON.stringify({
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        text: node.text,
        position: node.position,
        url: node.url,
        headers: node.headers,
        inputParameters: node.inputParameters,
        retryCount: node.retryCount,
        retryDelaySeconds: node.retryDelaySeconds,
        timeoutMilliseconds: node.timeoutMilliseconds
      })),
      edges: edges
    }, null, 2);
  }, [nodes, edges]);

  // Initialize edge control points for bezier curves
  useEffect(() => {
    const newControlPoints: {[key: string]: {x1: number, y1: number, x2: number, y2: number}} = {};
    
    edges.forEach(edge => {
      if (!edgeControlPoints[edge.id]) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;
          
          // Create slight random offset for control points to make curves unique
          const randomFactor = 0.2 + Math.random() * 0.2; // Between 0.2 and 0.4
          
          newControlPoints[edge.id] = {
            x1: sourceNode.position.x + dx * 0.3,
            y1: sourceNode.position.y + dy * randomFactor,
            x2: sourceNode.position.x + dx * 0.7,
            y2: targetNode.position.y - dy * randomFactor
          };
        }
      } else {
        newControlPoints[edge.id] = edgeControlPoints[edge.id];
      }
    });
    
    setEdgeControlPoints(newControlPoints);
  }, [edges, nodes]);

  useEffect(() => {
    if (!showNodeConfig) return;

    const trimmedHeaders = nodeConfig.headersString.trim();
    if (trimmedHeaders === '') {
      setHeaderError(null);
      return;
    }

    try {
      JSON.parse(trimmedHeaders);
      setHeaderError(null);
    } catch (e) {
      setHeaderError('Invalid JSON format for headers.');
    }
  }, [nodeConfig.headersString, showNodeConfig]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (draggedNode) {
      const updatedNodes = nodes.map(node =>
        node.id === draggedNode.id ? { ...node, position: { x, y } } : node
      );

      onNodesChange(updatedNodes);
    }
  };

  const handleNodeMouseDown = (node: WorkflowNode, e: React.MouseEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    if (isConnecting) {
      if (connectingSource !== node.id) {
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}`,
          source: connectingSource!,
          target: node.id
        };
        
        // Create control points for the new edge
        const sourceNode = nodes.find(n => n.id === connectingSource);
        const targetNode = node;
        
        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;
          
          // Create random control points for more natural curves
          const randomFactor1 = 0.1 + Math.random() * 0.3; // Between 0.1 and 0.4
          const randomFactor2 = 0.1 + Math.random() * 0.3; // Between 0.1 and 0.4
          
          setEdgeControlPoints(prev => ({
            ...prev,
            [newEdge.id]: {
              x1: sourceNode.position.x + dx * 0.3,
              y1: sourceNode.position.y + dy * randomFactor1,
              x2: sourceNode.position.x + dx * 0.7,
              y2: targetNode.position.y - dy * randomFactor2
            }
          }));
        }
        
        onEdgesChange([...edges, newEdge]);
      }

      setIsConnecting(false);
      setConnectingSource(null);
    } else if (!isEditing) {
      setDraggedNode(node);
      setSelectedNode(node.id);
      setNodeText(node.text);

      showNodeConfiguration(node, e, true);
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (isConnecting) {
      setIsConnecting(false);
      setConnectingSource(null);
    }

    if (!e.defaultPrevented) {
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowNodeConfig(null);
    }
  };

  const startConnecting = (nodeId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    setIsConnecting(true);
    setConnectingSource(nodeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeType = e.dataTransfer.getData('nodeType');
    const nodeTextMap: { [key: string]: string } = {
      'audiencefilter': 'AudienceFilter',
      'contextenrichment': 'ContextEnrichment',
      'orchestration': 'Orchestration',
      'arbitration': 'Arbitration',
      'recommender': 'Recommender',
      'contentenrichment': 'ContentEnrichment',
      'contentevent': 'ContentEvent',
      'delj':'Delj',
      'drone':'Drone',
      'fork': 'Fork'
    };

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x, y },
      text: nodeTextMap[nodeType] || 'New Node',
      size: { width: 160, height: 80 },
      borderRadius: nodeBorderRadius,
      url: '',
      headers: {},
      inputParameters: [],
      retryCount: 1,
      retryDelaySeconds: 1,
      timeoutMilliseconds: 1000
    };

    onNodesChange([...nodes, newNode]);
  };

  const updateNodeText = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ((e as React.KeyboardEvent).key === 'Enter' || e.type === 'blur') {
      if (selectedNode && nodeText.trim()) {
        const updatedNodes = nodes.map(node =>
          node.id === selectedNode ? { ...node, text: nodeText.trim() } : node
        );
        onNodesChange(updatedNodes);
        setIsEditing(false);
      } else if (e.type === 'blur' && selectedNode) {
        const originalNode = nodes.find(n => n.id === selectedNode);
        if (originalNode) {
          setNodeText(originalNode.text);
        }
        setIsEditing(false);
      }
    }
  };

  const updateNodeConfig = (nodeId: string) => {
    if (headerError) {
      alert(`Cannot save: ${headerError}`);
      return;
    }

    let parsedHeaders = {};
    const trimmedHeaders = nodeConfig.headersString.trim();
    if (trimmedHeaders !== '') {
      try {
        parsedHeaders = JSON.parse(trimmedHeaders);
      } catch (e) {
        alert('Error parsing headers JSON. Please fix before saving.');
        return;
      }
    }

    const updatedNodes = nodes.map(node =>
      node.id === nodeId ? {
        ...node,
        url: nodeConfig.url.trim(),
        headers: parsedHeaders,
        inputParameters: nodeConfig.inputParameters,
        retryCount: nodeConfig.retryCount,
        retryDelaySeconds: nodeConfig.retryDelaySeconds,
        timeoutMilliseconds: nodeConfig.timeoutMilliseconds
      } : node
    );
    onNodesChange(updatedNodes);
    setShowNodeConfig(null);
  };

  const addParameter = () => {
    if (newParameter.trim()) {
      setNodeConfig(prevConfig => ({
        ...prevConfig,
        inputParameters: [...prevConfig.inputParameters, newParameter.trim()]
      }));
      setNewParameter('');
    }
  };

  const removeParameter = (index: number) => {
    setNodeConfig(prevConfig => ({
      ...prevConfig,
      inputParameters: prevConfig.inputParameters.filter((_, i) => i !== index)
    }));
  };

  const deleteNode = (nodeId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    const updatedNodes = nodes.filter(node => node.id !== nodeId);

    const updatedEdges = edges.filter(edge =>
      edge.source !== nodeId && edge.target !== nodeId
    );
    
    // Remove control points for deleted edges
    const updatedControlPoints = { ...edgeControlPoints };
    edges.forEach(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        delete updatedControlPoints[edge.id];
      }
    });
    
    setEdgeControlPoints(updatedControlPoints);
    onNodesChange(updatedNodes);
    onEdgesChange(updatedEdges);

    if (selectedNode === nodeId) setSelectedNode(null);
    if (showNodeConfig === nodeId) setShowNodeConfig(null);
  };

  const deleteEdge = (edgeId: string) => {
    if (readOnly) return;
    
    const updatedEdges = edges.filter(edge => edge.id !== edgeId);
    
    // Remove control points for the deleted edge
    const updatedControlPoints = { ...edgeControlPoints };
    delete updatedControlPoints[edgeId];
    
    setEdgeControlPoints(updatedControlPoints);
    onEdgesChange(updatedEdges);
    setSelectedEdge(null);
  };

  const startEditing = (node: WorkflowNode, e: React.MouseEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    setSelectedNode(node.id);
    setNodeText(node.text);
    setIsEditing(true);
    setShowNodeConfig(null);
  };

  const showNodeConfiguration = (node: WorkflowNode, e: React.MouseEvent, onlySetState = false) => {
    if (readOnly) return;
    
    if (!onlySetState) e.stopPropagation();

    const headersExist = node.headers && typeof node.headers === 'object' && Object.keys(node.headers).length > 0;

    setNodeConfig({
      url: node.url || '',
      headersString: headersExist ? JSON.stringify(node.headers, null, 2) : '',
      inputParameters: node.inputParameters || [],
      retryCount: node.retryCount ?? 1,
      retryDelaySeconds: node.retryDelaySeconds ?? 1,
      timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
    });

    if (!onlySetState) {
      setSelectedNode(node.id);
      setIsEditing(false);
      setHeaderError(null);
      setShowNodeConfig(node.id);
    }
  };

  const resizeNode = (nodeId: string, increase: boolean) => {
    if (readOnly) return;
    
    const updatedNodes = nodes.map(node => {
      if (node.id === nodeId) {
        const size = typeof node.size === 'object' 
          ? node.size 
          : { width: node.size || 160, height: node.size || 80 };
          
        const step = { width: 20, height: 10 };
        const minSize = { width: 120, height: 60 };
        const maxSize = { width: 240, height: 120 };

        const newSize = {
          width: increase ? Math.min(size.width + step.width, maxSize.width) : Math.max(size.width - step.width, minSize.width),
          height: increase ? Math.min(size.height + step.height, maxSize.height) : Math.max(size.height - step.height, minSize.height)
        };
        
        return { ...node, size: newSize };
      }
      return node;
    });
    onNodesChange(updatedNodes);
  };

  // Create a bezier curve path for edges
  const calculateCurvePath = (sourceNode: WorkflowNode, targetNode: WorkflowNode, edgeId: string) => {
    const sourceWidth = typeof sourceNode.size === 'object' ? sourceNode.size.width : 160;
    const sourceHeight = typeof sourceNode.size === 'object' ? sourceNode.size.height : 80;
    const targetWidth = typeof targetNode.size === 'object' ? targetNode.size.width : 160;
    const targetHeight = typeof targetNode.size === 'object' ? targetNode.size.height : 80;
    
    const startX = sourceNode.position.x;
    const startY = sourceNode.position.y + sourceHeight / 2;
    
    const endX = targetNode.position.x;
    const endY = targetNode.position.y - targetHeight / 2;
    
    // Use control points from state or create default ones
    const controlPoints = edgeControlPoints[edgeId] || {
      x1: startX + (endX - startX) * 0.3,
      y1: startY + (endY - startY) * 0.2,
      x2: startX + (endX - startX) * 0.7,
      y2: startY + (endY - startY) * 0.8
    };
    
    return {
      path: `M ${startX} ${startY} C ${controlPoints.x1} ${controlPoints.y1}, ${controlPoints.x2} ${controlPoints.y2}, ${endX} ${endY}`,
      midPoint: {
        x: (controlPoints.x1 + controlPoints.x2) / 2,
        y: (controlPoints.y1 + controlPoints.y2) / 2
      }
    };
  };

  // For temporary connection line while connecting nodes
  const calculateTempConnectionPath = (sourceNode: WorkflowNode, mousePos: { x: number, y: number }) => {
    const sourceWidth = typeof sourceNode.size === 'object' ? sourceNode.size.width : 160;
    const sourceHeight = typeof sourceNode.size === 'object' ? sourceNode.size.height : 80;
    
    const startX = sourceNode.position.x;
    const startY = sourceNode.position.y + sourceHeight / 2;
    
    const endX = mousePos.x;
    const endY = mousePos.y;
    
    // Create temporary control points
    const controlX1 = startX + (endX - startX) * 0.3;
    const controlY1 = startY + (endY - startY) * 0.3;
    const controlX2 = startX + (endX - startX) * 0.7;
    const controlY2 = startY + (endY - startY) * 0.7;
    
    return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Main Layout */}
      {!readOnly && (
        <div className="flex flex-col w-64 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Workflow Designer</h2>
          </div>
          <WorkflowToolbox onDragStart={handleDragStart} />
          <div className="mt-auto p-4 border-t border-gray-200">
            <button 
              onClick={() => setShowJsonPanel(!showJsonPanel)}
              className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <Code size={16} className="mr-2" />
              {showJsonPanel ? "Hide JSON" : "Show JSON"}
            </button>
          </div>
        </div>
      )}

      {/* Canvas and JSON display flex container */}
      <div className={`flex flex-1 flex-col ${readOnly ? 'w-full' : ''}`}>
        {/* Canvas container */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className={`w-full h-full bg-white border border-gray-200 relative ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleBackgroundClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseLeave={handleMouseUp}
          >
            {!readOnly && (
              <div className="absolute top-4 left-4 bg-gray-100 p-2 rounded-md text-sm shadow z-10">
                Drag nodes • Click plus to connect • Click arrow to delete
              </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
                </marker>
              </defs>

              {edges.map(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const { path, midPoint } = calculateCurvePath(sourceNode, targetNode, edge.id);

                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      stroke={selectedEdge === edge.id ? '#3B82F6' : '#6B7280'}
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      className={`${readOnly ? '' : 'cursor-pointer pointer-events-auto'}`}
                      onClick={(e) => {
                        if (readOnly) return;
                        e.stopPropagation();
                        setSelectedEdge(edge.id);
                        setSelectedNode(null);
                        setShowNodeConfig(null);
                      }}
                    />
                    {!readOnly && selectedEdge === edge.id && (
                      <g
                        transform={`translate(${midPoint.x}, ${midPoint.y})`}
                        className="pointer-events-auto"
                      >
                        <circle
                          cx="0"
                          cy="0"
                          r="12"
                          fill="white"
                          stroke="#EF4444"
                          strokeWidth="1"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEdge(edge.id);
                          }}
                        />
                        <X
                          size={16}
                          x="-8"
                          y="-8"
                          className="text-red-500 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEdge(edge.id);
                          }}
                        />
                      </g>
                    )}
                  </g>
                );
              })}

              {isConnecting && connectingSource && nodes.find(n => n.id === connectingSource) && (
                <path
                  d={calculateTempConnectionPath(
                    nodes.find(n => n.id === connectingSource)!,
                    mousePos
                  )}
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>

            {nodes.map(node => {
              const nodeTypeColor = NODE_COLORS[node.type as keyof typeof NODE_COLORS] || NODE_COLORS.default;
              const width = (typeof node.size === 'object' && node.size.width) ? node.size.width : (typeof node.size === 'number' ? node.size : 160);
              const height = (typeof node.size === 'object' && node.size.height) ? node.size.height : (typeof node.size === 'number' ? node.size : 80);
              const borderRadius = node.borderRadius ?? nodeBorderRadius;

              const topLeftX = node.position.x - width / 2;
              const topLeftY = node.position.y - height / 2;

              return (
                <div
                  key={node.id}
                  className={`absolute transition-shadow duration-100 ease-in-out ${
                    selectedNode === node.id ? 'ring-2 ring-blue-500 ring-offset-2' : 'ring-0'
                  } ${draggedNode?.id === node.id ? 'shadow-xl' : 'shadow-md'}`}
                  style={{
                    width,
                    height,
                    transform: `translate(${topLeftX}px, ${topLeftY}px)`,
                    cursor: readOnly 
                      ? 'default' 
                      : (isConnecting ? 'crosshair' : (isEditing ? 'text' : 'move')),
                    zIndex: draggedNode?.id === node.id ? 10 : (selectedNode === node.id ? 5 : 1),
                    borderRadius: `${borderRadius}px`,
                    background: nodeTypeColor.bg,
                    border: `2px solid ${nodeTypeColor.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(node, e)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="w-full h-full flex items-center justify-center relative group p-1"
                    style={{
                      borderRadius: `${borderRadius}px`,
                      background: 'transparent',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {selectedNode === node.id && isEditing && !readOnly ? (
                      <textarea
                        value={nodeText}
                        onChange={(e) => setNodeText(e.target.value)}
                        onKeyDown={updateNodeText}
                        onBlur={updateNodeText}
                        className="w-full h-auto text-center bg-transparent outline-none border-none p-1 resize-none z-10 overflow-hidden"
                        style={{ fontSize: `${Math.max(Math.min(width, height) / 9, 10)}px`, lineHeight: 1.2 }}
                        autoFocus
                        rows={2}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center text-center w-full h-full break-words select-none px-2"
                        style={{
                          fontSize: `${Math.max(Math.min(width, height) / 9, 12)}px`,
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          padding: '4px',
                          color: '#333'
                        }}
                        onDoubleClick={(e) => startEditing(node, e)}
                      >
                        {node.text}
                      </div>
                    )}

                    {/* Plus button for connecting - only show if not read-only */}
                    {!readOnly && (
                      <div 
                        className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-md border border-gray-200 w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                        onClick={(e) => startConnecting(node.id, e)}
                      >
                        <Plus size={16} className="text-blue-500" />
                      </div>
                    )}

                    {selectedNode === node.id && !isEditing && !readOnly && (
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
                          onClick={(e) => showNodeConfiguration(node, e)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Configure Node"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={(e) => deleteNode(node.id, e)}
                          className="p-1 hover:bg-gray-100 rounded text-red-500"
                          title="Delete Node"
                        >
                          <Trash2 size={14} />
                          <button
                          onClick={(e) => deleteNode(node.id, e)}
                          className="p-1 hover:bg-gray-100 rounded text-red-500"
                          title="Delete Node"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* JSON Panel - only show if not read-only */}
        {showJsonPanel && !readOnly && (
          <div className="h-1/3 border-t border-gray-200 flex flex-col bg-gray-50">
            <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-200">
              <h3 className="font-medium text-gray-700">Workflow JSON</h3>
              <button 
                onClick={() => setShowJsonPanel(false)}
                className="p-1 hover:bg-gray-200 rounded-md"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap bg-white p-4 rounded-md border border-gray-200 h-full overflow-auto">
                {workflowJson}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Node Configuration Modal - only show if not read-only */}
      {showNodeConfig && !readOnly && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowNodeConfig(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-0 w-full max-w-4xl max-h-[90vh] flex"
            onClick={e => e.stopPropagation()}
          >
            {/* Form Panel */}
            <div className="w-2/3 border-r border-gray-200 flex flex-col">
              <div className="flex justify-between items-center bg-gray-50 p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Configure {nodes.find(n => n.id === showNodeConfig)?.text}
                </h3>
                <button onClick={() => setShowNodeConfig(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="nodeUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <input
                      id="nodeUrl"
                      type="text"
                      value={nodeConfig.url}
                      onChange={(e) => setNodeConfig({...nodeConfig, url: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="e.g., https://api.example.com/endpoint"
                    />
                  </div>

                  <div>
                    <label htmlFor="nodeHeaders" className="block text-sm font-medium text-gray-700 mb-1">
                      Headers (JSON format)
                    </label>
                    <textarea
                      id="nodeHeaders"
                      rows={4}
                      value={nodeConfig.headersString}
                      onChange={(e) => setNodeConfig({...nodeConfig, headersString: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono ${
                        headerError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                      }`}
                      placeholder='{ "Content-Type": "application/json", ... }'
                    />
                    {headerError && <p className="mt-1 text-xs text-red-600">{headerError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Input Parameters
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newParameter}
                        onChange={(e) => setNewParameter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addParameter()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Add parameter name"
                      />
                      <button
                        onClick={addParameter}
                        className="px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-sm"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto border rounded p-2 bg-gray-50">
                      {nodeConfig.inputParameters.length > 0 ? nodeConfig.inputParameters.map((param, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-1.5 rounded border border-gray-200">
                          <span className="text-sm text-gray-800 break-all">{param}</span>
                          <button
                            onClick={() => removeParameter(index)}
                            className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                            title="Remove parameter"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )) : <p className="text-sm text-gray-500 italic text-center py-1">No parameters added.</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="retryCount" className="block text-sm font-medium text-gray-700 mb-1">
                        Retry Count
                      </label>
                      <input
                        id="retryCount"
                        type="number"
                        value={nodeConfig.retryCount}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          retryCount: Math.max(0, parseInt(e.target.value, 10) || 0)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        min="0"
                      />
                    </div>

                    <div>
                      <label htmlFor="retryDelay" className="block text-sm font-medium text-gray-700 mb-1">
                        Retry Delay (seconds)
                      </label>
                      <input
                        id="retryDelay"
                        type="number"
                        value={nodeConfig.retryDelaySeconds}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          retryDelaySeconds: Math.max(0, parseInt(e.target.value, 10) || 0)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        min="0"
                      />
                    </div>

                    <div>
                      <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-1">
                        Timeout (milliseconds)
                      </label>
                      <input
                        id="timeout"
                        type="number"
                        value={nodeConfig.timeoutMilliseconds}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          timeoutMilliseconds: Math.max(100, parseInt(e.target.value, 10) || 1000)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        min="100"
                        step="100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowNodeConfig(null)}
                  className="px-4 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateNodeConfig(showNodeConfig!)}
                  disabled={!!headerError}
                  className={`px-4 py-2 text-white rounded-md text-sm font-medium flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    headerError
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <Save size={16} className="mr-2" />
                  Save Configuration
                </button>
              </div>
            </div>
            
            {/* JSON Preview Panel */}
            <div className="w-1/3 flex flex-col">
              <div className="bg-gray-50 p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">JSON Preview</h3>
              </div>
              <div className="flex-1 p-4 overflow-auto bg-gray-50">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap bg-white p-4 rounded-md border border-gray-200 h-full overflow-auto">
                  {JSON.stringify({
                    url: nodeConfig.url,
                    headers: nodeConfig.headersString ? JSON.parse(nodeConfig.headersString || '{}') : {},
                    inputParameters: nodeConfig.inputParameters,
                    retryCount: nodeConfig.retryCount,
                    retryDelaySeconds: nodeConfig.retryDelaySeconds,
                    timeoutMilliseconds: nodeConfig.timeoutMilliseconds
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

