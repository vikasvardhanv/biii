// WorkflowDesigner.jsx - Optimized Version

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  onSettingsChange?: (nodeId: string, settings: any) => void;
}

interface NodeConfigState {
  url: string;
  headersString: string;
  inputParameters: string[];
  retryCount: number;
  retryDelaySeconds: number;
  timeoutMilliseconds: number;
}

const NODE_COLORS = {
  start: { bg: '#E8F5E9', border: '#4CAF50' },
  end: { bg: '#F3E5F5', border: '#9C27B0' },
  fork: { bg: '#E3F2FD', border: '#2196F3' },
  default: { bg: '#FFFFFF', border: '#9E9E9E' }
};

export default function WorkflowDesigner({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange,
  nodeShape = "rectangle",
  nodeBorderRadius = 4,
  onSettingsChange 
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
  const [availableTasks, setAvailableTasks] = useState<WorkflowNode[]>([]);
  const [newParameter, setNewParameter] = useState('');
  const [headerError, setHeaderError] = useState<string | null>(null);
  
  // Initialize node configuration state with empty values
  const [nodeConfig, setNodeConfig] = useState<NodeConfigState>({
    url: '',
    headersString: '',
    inputParameters: [],
    retryCount: 1,
    retryDelaySeconds: 1,
    timeoutMilliseconds: 1000
  });

  // Memoize the workflow JSON to prevent unnecessary recalculations
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

  // Validate headers when they change
  useEffect(() => {
    if (!selectedNode) return;

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
  }, [nodeConfig.headersString, selectedNode]);

  // Handle mouse movement for node drag and connections
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
  }, [draggedNode, nodes, onNodesChange]);

  // Handle node selection and interaction
  const handleNodeMouseDown = useCallback((node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      if (connectingSource !== node.id) {
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}`,
          source: connectingSource!,
          target: node.id
        };
        onEdgesChange([...edges, newEdge]);
      }

      setIsConnecting(false);
      setConnectingSource(null);
    } else if (!isEditing) {
      setDraggedNode(node);
      setSelectedNode(node.id);
      setNodeText(node.text);

      showNodeConfiguration(node);
    }
  }, [isConnecting, connectingSource, isEditing, edges, onEdgesChange]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
  }, []);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (isConnecting) {
      setIsConnecting(false);
      setConnectingSource(null);
    }

    if (!e.defaultPrevented) {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }, [isConnecting]);

  const startConnecting = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectingSource(nodeId);
  }, []);

  // Handlers for node creation and manipulation
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeType = e.dataTransfer.getData('nodeType');
    const nodeName = e.dataTransfer.getData('nodeName') || 'New Node';
    
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x, y },
      text: nodeName,
      size: { width: 160, height: 80 },
      url: '',
      headers: {},
      inputParameters: [],
      retryCount: 1,
      retryDelaySeconds: 1,
      timeoutMilliseconds: 1000,
      borderRadius: nodeBorderRadius
    };

    onNodesChange([...nodes, newNode]);
  }, [containerRef, nodes, onNodesChange, nodeBorderRadius]);

  // Callback for handling task addition from JSON
  const onAddTaskFromJson = useCallback((data: any) => {
    // Create a new node from JSON data
    const newNode = {
      id: crypto.randomUUID(),
      type: "rectangle",
      text: data.node || "New Task",
      url: data.url || "",
      headers: data.headers || {},
      inputParameters: data.inputParameters || [],
      retryCount: data.retryCount ?? 1,
      retryDelaySeconds: data.retryDelaySeconds ?? 1,
      timeoutMilliseconds: data.timeoutMilliseconds ?? 1000,
      position: { x: 100, y: 100 + nodes.length * 80 },
      size: { width: 120, height: 60 },
      borderRadius: nodeBorderRadius,
    };
    
    // Add node to available tasks for reuse
    setAvailableTasks(prev => {
      // Check if a task with this name already exists
      const taskExists = prev.some(task => task.text === newNode.text);
      if (!taskExists) {
        return [...prev, newNode];
      }
      return prev;
    });
    
    // Add node to canvas
    onNodesChange([...nodes, newNode]);
  }, [nodes, onNodesChange, nodeBorderRadius]);

  // Node text editing functionality
  const updateNodeText = useCallback((e: React.KeyboardEvent | React.FocusEvent) => {
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
  }, [selectedNode, nodeText, nodes, onNodesChange]);

  // Update node configuration
  const updateNodeConfig = useCallback((nodeId: string) => {
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

    const updatedConfig = {
      url: nodeConfig.url.trim(),
      headers: parsedHeaders,
      inputParameters: nodeConfig.inputParameters,
      retryCount: nodeConfig.retryCount,
      retryDelaySeconds: nodeConfig.retryDelaySeconds,
      timeoutMilliseconds: nodeConfig.timeoutMilliseconds
    };

    const updatedNodes = nodes.map(node =>
      node.id === nodeId ? {
        ...node,
        ...updatedConfig
      } : node
    );
    
    onNodesChange(updatedNodes);
    
    // Notify parent component about settings change if callback provided
    if (onSettingsChange) {
      onSettingsChange(nodeId, updatedConfig);
    }
  }, [headerError, nodeConfig, nodes, onNodesChange, onSettingsChange]);

  // Parameter management
  const addParameter = useCallback(() => {
    if (newParameter.trim()) {
      setNodeConfig(prevConfig => ({
        ...prevConfig,
        inputParameters: [...prevConfig.inputParameters, newParameter.trim()]
      }));
      setNewParameter('');
    }
  }, [newParameter]);

  const removeParameter = useCallback((index: number) => {
    setNodeConfig(prevConfig => ({
      ...prevConfig,
      inputParameters: prevConfig.inputParameters.filter((_, i) => i !== index)
    }));
  }, []);

  // Node deletion
  const deleteNode = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedNodes = nodes.filter(node => node.id !== nodeId);

    const updatedEdges = edges.filter(edge =>
      edge.source !== nodeId && edge.target !== nodeId
    );
    onNodesChange(updatedNodes);
    onEdgesChange(updatedEdges);

    if (selectedNode === nodeId) setSelectedNode(null);
  }, [nodes, edges, selectedNode, onNodesChange, onEdgesChange]);

  // Edge deletion
  const deleteEdge = useCallback((edgeId: string) => {
    const updatedEdges = edges.filter(edge => edge.id !== edgeId);
    onEdgesChange(updatedEdges);
    setSelectedEdge(null);
  }, [edges, onEdgesChange]);

  // Node editing
  const startEditing = useCallback((node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node.id);
    setNodeText(node.text);
    setIsEditing(true);
  }, []);

  // Load node configuration for editing
  const showNodeConfiguration = useCallback((node: WorkflowNode) => {
    const headersExist = node.headers && typeof node.headers === 'object' && Object.keys(node.headers).length > 0;

    setNodeConfig({
      url: node.url || '',
      headersString: headersExist ? JSON.stringify(node.headers, null, 2) : '',
      inputParameters: node.inputParameters || [],
      retryCount: node.retryCount ?? 1,
      retryDelaySeconds: node.retryDelaySeconds ?? 1,
      timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
    });

    setSelectedNode(node.id);
    setIsEditing(false);
    setHeaderError(null);
  }, []);

  // Node resizing
  const resizeNode = useCallback((nodeId: string, increase: boolean) => {
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
  }, [nodes, onNodesChange]);

  // Calculate path for arrows
  const calculateArrowPath = useCallback((start: { x: number; y: number }, end: { x: number; y: number }, sourceNode: WorkflowNode, targetNode?: WorkflowNode) => {
    const sourceSize = typeof sourceNode.size === 'object'
      ? sourceNode.size
      : { width: sourceNode.size || 160, height: sourceNode.size || 80 };

    const targetSize = targetNode && typeof targetNode.size === 'object'
      ? targetNode.size
      : { width: (targetNode?.size || 160), height: (targetNode?.size || 80) };

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      return { path: `M ${start.x} ${start.y}`, midPoint: start };
    }

    const startX = start.x;
    const startY = start.y + sourceSize.height / 2;

    let endX, endY;

    if (targetNode) {
      endX = end.x;
      endY = end.y - targetSize.height / 2;
    } else {
      endX = end.x;
      endY = end.y;
    }

    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      midPoint: {
        x: (startX + endX) / 2,
        y: (startY + endY) / 2
      }
    };
  }, []);

  // Get the current selected node (memoized)
  const currentSelectedNode = useMemo(() => {
    return selectedNode ? nodes.find(n => n.id === selectedNode) : null;
  }, [selectedNode, nodes]);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Main Layout */}
      <div className="flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Workflow Designer</h2>
        </div>
        <WorkflowToolbox
          availableTasks={availableTasks}
          onAddTaskFromJson={onAddTaskFromJson}
          onDragStart={(type, name) => (e: React.DragEvent) => {
            e.dataTransfer.setData('nodeType', type);
            e.dataTransfer.setData('nodeName', name || '');
          }}
        />
      </div>

      {/* Canvas container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full bg-white border border-gray-200 relative cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleBackgroundClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute top-4 left-4 bg-gray-100 p-2 rounded-md text-sm shadow z-10">
            Drag nodes • Click plus to connect • Click arrow to delete
          </div>

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

            {/* Render edges */}
            {edges.map(edge => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const { path, midPoint } = calculateArrowPath(
                sourceNode.position,
                targetNode.position,
                sourceNode,
                targetNode
              );

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    stroke={selectedEdge === edge.id ? '#3B82F6' : '#6B7280'}
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    className="cursor-pointer pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdge(edge.id);
                      setSelectedNode(null);
                    }}
                  />
                  {selectedEdge === edge.id && (
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

            {/* Show connection line when connecting nodes */}
            {isConnecting && connectingSource && nodes.find(n => n.id === connectingSource) && (
              <path
                d={calculateArrowPath(
                  nodes.find(n => n.id === connectingSource)!.position,
                  mousePos,
                  nodes.find(n => n.id === connectingSource)!,
                ).path}
                stroke="#3B82F6"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
                markerEnd="url(#arrowhead)"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>

          {/* Render nodes */}
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
                  cursor: isConnecting ? 'crosshair' : (isEditing ? 'text' : 'move'),
                  zIndex: draggedNode?.id === node.id ? 10 : (selectedNode === node.id ? 5 : 1),
                  borderRadius: `${borderRadius}px`,
                  background: nodeTypeColor?.bg || '#FFFFFF',
                  border: `2px solid ${nodeTypeColor?.border || '#9E9E9E'}`,
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
                  {selectedNode === node.id && isEditing ? (
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

                  {/* Plus button for connecting */}
                  <div
                    className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-md border border-gray-200 w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                    onClick={(e) => startConnecting(node.id, e)}
                  >
                    <Plus size={16} className="text-blue-500" />
                  </div>

                  {selectedNode === node.id && !isEditing && (
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}







===============================




// WorkflowToolbox.jsx - Optimized Version

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Plus, X, Search, Code } from 'lucide-react';

interface Props {
  onDragStart: (type: string, name: string) => (e: React.DragEvent) => void;
  onAddTaskFromJson: (data: any) => void;
  availableTasks?: any[];
}

const initialNodeTypes = [
  { type: 'start', name: 'Start', color: '#22C55E' },
  { type: 'end', name: 'End', color: '#EF4444' },
  { type: 'fork', name: 'Fork', color: '#3B82F6' }
];

function WorkflowToolbox({ onDragStart, onAddTaskFromJson, availableTasks = [] }: Props) {
  const [nodeTypes, setNodeTypes] = useState(initialNodeTypes);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // Convert available tasks to node types
  useEffect(() => {
    if (availableTasks.length > 0) {
      // Map available tasks to node types format
      const taskNodeTypes = availableTasks.map(task => ({
        type: task.type || 'rectangle',
        name: task.text,
        color: '#3B82F6',
        data: task // Store the full task data for drag and drop
      }));
      
      // Combine initial types with task types and remove duplicates
      const combinedTypes = [...initialNodeTypes];
      
      taskNodeTypes.forEach(taskType => {
        // Check if this task name already exists
        if (!combinedTypes.some(t => t.name === taskType.name)) {
          combinedTypes.push(taskType);
        }
      });
      
      // Sort alphabetically
      setNodeTypes(combinedTypes.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [availableTasks]);

  // Handle adding task from JSON
  const handleAddTaskFromJson = useCallback(() => {
    try {
      let data = JSON.parse(jsonInput);
      
      // Handle both single task and array of tasks
      if (!Array.isArray(data)) {
        data = [data];
      }
      
      // Process all tasks in the array
      data.forEach(task => {
        onAddTaskFromJson(task);
      });
      
      setShowJsonModal(false);
      setJsonInput('');
    } catch (error) {
      alert('Invalid JSON format. Please check and try again.');
    }
  }, [jsonInput, onAddTaskFromJson]);

  // Filter node types based on search query
  const filteredNodeTypes = nodeTypes.filter(node =>
    node.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          // WorkflowToolbox.jsx (continued)
          <Search size={16} className="absolute left-2.5 top-2 text-gray-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Available Tasks</h3>
        <div className="space-y-1.5">
          {filteredNodeTypes.map((node) => (
            <div
              key={`${node.type}-${node.name}`}
              className="flex items-center p-2 rounded cursor-move hover:bg-gray-100 transition-colors"
              draggable
              onDragStart={onDragStart(node.type, node.name)}
            >
              <div
                className="w-4 h-4 rounded-sm mr-2 flex-shrink-0"
                style={{ backgroundColor: node.color }}
              />
              <span className="text-sm truncate">{node.name}</span>
            </div>
          ))}

          {filteredNodeTypes.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">
              No tasks found.
            </p>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200">
        <button
            onClick={() => setShowJsonModal(true)}
            className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Plus size={16} className="mr-1.5" />
          Add New Task
        </button>
      </div>

      {/* JSON Modal for adding tasks */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium text-gray-800">Add Task from JSON</h4>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              className="w-full h-40 border border-gray-300 rounded-md p-2 text-sm font-mono"
              placeholder={`{
  "node": "Arbitrator",
  "url": "",
  "headers": {},
  "inputParameters": [],
  "retryCount": 1,
  "retryDelaySeconds": 1,
  "timeoutMilliseconds": 1000
}`}
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
            />
            <div className="text-xs text-gray-500 mt-2 mb-4">
              <p>You can add a single task or an array of tasks. Tasks will be added to the canvas and saved to the available tasks list.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTaskFromJson}
                className="px-4 py-2 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Using memo to prevent unnecessary re-renders
export default memo(WorkflowToolbox);





============================





// CreateWorkflow.jsx - Main Container Component

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, UploadIcon, FileText } from 'lucide-react';
import type { WorkflowKey, WorkflowNode, WorkflowEdge } from '../types';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { fetchWorkflowOptions, getLanguagesForMarket, getClientsForMarket, getChannelsForClient, getPagesForChannel, getPlacementsForPage, getDomainsForPlacement } from '../services/workflowOptions';

export default function CreateWorkflow() {
  const navigate = useNavigate();
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
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
  const [isPlacementOpen, setIsPlacementOpen] = useState(false);
  const [placementSearch, setPlacementSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const placementRef = useRef<HTMLDivElement>(null);
  const [rightPanelTab, setRightPanelTab] = useState('details');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeConfig, setNodeConfig] = useState<any>(null);

  // Options state
  const [workflowOptions, setWorkflowOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [availablePlacements, setAvailablePlacements] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<any[]>([]);
  const [filteredPlacements, setFilteredPlacements] = useState<string[]>([]);

  // Load workflow options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        const options = await fetchWorkflowOptions();
        setWorkflowOptions(options);

        if (options && Array.isArray(options.MARKETS)) {
          setAvailableMarkets(options.MARKETS.map((m: any) => m.MARKET));
        } else {
          setAvailableMarkets([]);
        }
      } catch (error) {
        console.error('Failed to load workflow options:', error);
        setAvailableMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, []);

  // Update available options for each dropdown based on selections
  useEffect(() => {
    if (workflowOptions && keyFields.market) {
      const languages = getLanguagesForMarket(workflowOptions, keyFields.market);
      setAvailableLanguages(languages);
    } else {
      setAvailableLanguages([]);
    }
  }, [workflowOptions, keyFields.market]);

  useEffect(() => {
    if (workflowOptions && keyFields.market && keyFields.language) {
      const clients = getClientsForMarket(workflowOptions, keyFields.market, keyFields.language);
      setAvailableClients(clients);
    } else {
      setAvailableClients([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language]);

  useEffect(() => {
    if (workflowOptions && keyFields.market && keyFields.language && keyFields.client) {
      const channels = getChannelsForClient(workflowOptions, keyFields.market, keyFields.language, keyFields.client);
      setAvailableChannels(channels);
    } else {
      setAvailableChannels([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language, keyFields.client]);

  useEffect(() => {
    if (workflowOptions && keyFields.market && keyFields.language && keyFields.client && keyFields.channel) {
      const pages = getPagesForChannel(workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel);
      setAvailablePages(pages);
    } else {
      setAvailablePages([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel]);

  useEffect(() => {
    if (workflowOptions && keyFields.market && keyFields.language && keyFields.client && keyFields.channel && keyFields.page) {
      const placements = getPlacementsForPage(workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel, keyFields.page);
      const flattenedPlacements = placements.flatMap((p: any) => p.PLACEMENT);
      setAvailablePlacements(flattenedPlacements);
      setFilteredPlacements(flattenedPlacements.filter(p =>
        p.toLowerCase().includes(placementSearch.toLowerCase())
      ));
    } else {
      setAvailablePlacements([]);
      setFilteredPlacements([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel, keyFields.page, placementSearch]);

  useEffect(() => {
    if (availablePlacements.length > 0) {
      setFilteredPlacements(availablePlacements.filter(p =>
        p.toLowerCase().includes(placementSearch.toLowerCase())
      ));
    }
  }, [placementSearch, availablePlacements]);

  useEffect(() => {
    if (workflowOptions && keyFields.market && keyFields.language && keyFields.client && keyFields.channel && keyFields.page && keyFields.placement.length > 0) {
      const placementsString = keyFields.placement.join('-');
      const domains = getDomainsForPlacement(workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel, keyFields.page, placementsString);
      setAvailableDomains(domains);
    } else {
      setAvailableDomains([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel, keyFields.page, keyFields.placement]);

  // Handle click outside placement dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (placementRef.current && !placementRef.current.contains(event.target as Node)) {
        setIsPlacementOpen(false);
        setPlacementSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle node selection for settings panel
  const handleNodeSelection = useCallback((nodeId: string | null, config: any) => {
    setSelectedNodeId(nodeId);
    setNodeConfig(config);
    
    // Switch to settings tab when a node is selected
    if (nodeId) {
      setRightPanelTab('settings');
    }
  }, []);

  // Toggle placement selection
  const togglePlacement = useCallback((value: string) => {
    setKeyFields(prev => {
      const updatedPlacements = prev.placement.includes(value)
        ? prev.placement.filter(p => p !== value)
        : [...prev.placement, value];
      return {
        ...prev,
        placement: updatedPlacements,
        domain: ''
      }
    });
  }, []);

  // Generate workflow key
  const generateKey = useCallback(() => {
    const values = { ...keyFields };
    const sortedPlacements = [...values.placement].sort();
    const placementKey = sortedPlacements.length > 0 ? sortedPlacements.join('-') : '';
    values.placement = [placementKey];

    const nameKey = workflowName.trim() !== '' ? workflowName.replace(/\s+/g, '_').toUpperCase() : '';
    const descKey = description.trim() !== '' ? description.replace(/\s+/g, '_').toUpperCase() : '';

    const keyParts = [
      nameKey,
      descKey,
      ...Object.values(values)
        .filter(val => val !== null && val !== undefined && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== ''))
        .map(value => String(value).toUpperCase())
    ];

    return keyParts
      .filter(part => part !== '')
      .join('_')
      .replace(/\s+/g, '_');
  }, [keyFields, workflowName, description]);

  // Create node hierarchy for workflow
  const createNodeHierarchy = useCallback(() => {
    // Build connection maps
    const connectionMap = new Map<string, Set<string>>();
    const incomingConnections = new Map<string, Set<string>>();

    nodes.forEach(node => {
      connectionMap.set(node.id, new Set());
      incomingConnections.set(node.id, new Set());
    });

    edges.forEach(edge => {
      connectionMap.get(edge.source)?.add(edge.target);
      incomingConnections.get(edge.target)?.add(edge.source);
    });

    // Helper to build node object
    const buildNodeObj = (node: WorkflowNode) => {
      const obj: any = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };

      if (node.url && node.url.trim() !== '') obj.url = node.url.trim();
      if (node.headers && Object.keys(node.headers).length > 0) obj.headers = node.headers;

      return obj;
    };

    // Identify different node types
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const forkNodes = nodes.filter(n => n.text === "Fork");

    // Identify direct fork tasks
    const forkTaskMap = new Map<string, string[]>();
    const isForkTask = new Set<string>();

    forkNodes.forEach(fork => {
      const forkId = fork.id;
      const tasks = Array.from(connectionMap.get(forkId) || []);
      forkTaskMap.set(forkId, tasks);

      // Mark these as fork tasks
      tasks.forEach(taskId => {
        isForkTask.add(taskId);
      });
    });

    // Track nodes that have been processed
    const processed = new Set<string>();

    // Create the result array
    const result: any[] = [];

    // Process all nodes in correct order
    nodes.forEach(node => {
      const nodeId = node.id;

      // Skip if already processed or is a fork task
      if (processed.has(nodeId) || isForkTask.has(nodeId)) {
        return;
      }

      // Process fork node
      if (node.text === "Fork") {
        const forkObj = buildNodeObj(node);
        const tasks = forkTaskMap.get(nodeId) || [];

        // Add fork tasks as children
        if (tasks.length > 0) {
          forkObj.forkTasks = tasks.map(taskId => {
            processed.add(taskId);
            return buildNodeObj(nodeMap.get(taskId)!);
          });
        }

        result.push(forkObj);
        processed.add(nodeId);
      }
      // Process regular node
      else {
        result.push(buildNodeObj(node));
        processed.add(nodeId);
      }
    });

    return result;
  }, [nodes, edges]);

  // Create complete workflow object
  const createCompleteWorkflow = useCallback(() => {
    return {
      name: workflowName,
      description: description,
      key: generateKey(),
      status: 'pending',
      workflow: createNodeHierarchy(),
      lastModified: new Date(),
    };
  }, [workflowName, description, generateKey, createNodeHierarchy]);

  // Save workflow
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');

    const payload = createCompleteWorkflow();

    const headers: Headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    try {
      const request: RequestInfo = new Request('/workflow/save', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      const response = await fetch(request);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to save workflow. Status: ${response.status}. ${errorData}`);
      }
      console.log("Workflow saved successfully!");
      alert('Workflow saved successfully!');
      navigate('/');
    } catch (err: any) {
      console.error("Error saving workflow:", err);
      setSaveError(`Failed to save workflow: ${err.message}`);
      alert(`Failed to save workflow: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Export workflow
  const handleExport = () => {
    const workflow = createCompleteWorkflow();
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

  // Parse workflow from imported JSON
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
        borderRadius: 10,
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

  // Handle workflow import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);

          // If the uploaded JSON contains nodes/edges, use them directly (preserve original design)
          if (json.nodes && json.edges) {
            setNodes(json.nodes);
            setEdges(json.edges);
          } else if (json.workflow) {
            // Fallback: parse workflow array if nodes/edges are not present
            const { nodes, edges } = parseWorkflow(json.workflow);
            setNodes(nodes);
            setEdges(edges);
          } else {
            alert('Invalid workflow file: "workflow" array not found');
            return;
          }

          // Set basic workflow info
          setWorkflowName(json.name || '');
          setDescription(json.description || '');

          // Parse key fields and update in order to trigger dependent dropdowns
          if (json.key) {
            const keyParts = json.key.split('_');
            const startIndex = keyParts.length > 7 ? 2 : 0;
            const placementIndex = startIndex + 5;
            let placements: string[] = [];
            if (keyParts.length > placementIndex) {
              placements = keyParts[placementIndex].split('-');
            }
            // Set all fields at once to trigger useEffect hooks for dropdowns
            setKeyFields({
              market: keyParts[startIndex] || '',
              language: keyParts[startIndex + 1] || '',
              client: keyParts[startIndex + 2] || '',
              channel: keyParts[startIndex + 3] || '',
              page: keyParts[startIndex + 4] || '',
              placement: placements,
              domain: keyParts[startIndex + 6] || ''
            });
          }
        } catch (error) {
          console.error("Failed to parse JSON file:", error);
          alert('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  // Handle key field changes
  const handleKeyFieldChange = useCallback((field: keyof WorkflowKey, value: string | string[]) => {
    setKeyFields(prev => {
      const newKeyFields = { ...prev, [field]: value };

      const fields: (keyof WorkflowKey)[] = ['market', 'language', 'client', 'channel', 'page', 'placement', 'domain'];
      const index = fields.indexOf(field);

      if (index !== -1) {
        for (let i = index + 1; i < fields.length; i++) {
          const fieldName = fields[i];
          newKeyFields[fieldName] = fieldName === 'placement' ? [] : '';
        }
      }

      return newKeyFields;
    });
  }, []);

  // Handle node settings change
  const handleNodeSettingsChange = useCallback((nodeId: string, settings: any) => {
    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === nodeId ? { ...node, ...settings } : node
      )
    );
  }, []);

  // Render form field for key fields
  const renderFormField = useCallback((field: keyof WorkflowKey) => {
    let options: { value: string; label: string }[] = [];
    let disabled = false;

    switch (field) {
      case 'market':
        options = availableMarkets.map(market => ({ value: market.toUpperCase(), label: market.toUpperCase() }));
        disabled = loading;
        break;
      case 'language':
        options = availableLanguages.map(language => ({ value: language.toUpperCase(), label: language.toUpperCase() }));
        disabled = loading || !keyFields.market;
        break;
      case 'client':
        options = availableClients.map((client: any) => ({ value: client.CLIENT.toUpperCase(), label: client.CLIENT.toUpperCase() }));
        disabled = loading || !keyFields.language;
        break;
      case 'channel':
        options = availableChannels.map((channel: any) => ({ value: channel.toUpperCase(), label: channel.toUpperCase() }));
        disabled = loading || !keyFields.client;
        break;
      case 'page':
        options = availablePages.map((page: any) => ({ value: page.PAGE.toUpperCase(), label: page.PAGE.toUpperCase() }));
        disabled = loading || !keyFields.channel;
        break;
      case 'domain':
        options = availableDomains.map((domain: any) => ({ value: domain.DOMAIN.toUpperCase(), label: domain.DOMAIN.toUpperCase() }));
        disabled = loading || keyFields.placement.length === 0;
        break;
      case 'placement': {
        disabled = loading || !keyFields.page;
        return (
            <div className="relative" ref={placementRef}>
              <label htmlFor="placement" className="block text-sm font-medium text-gray-700">
                Placement
              </label>
              <div
                  className={`mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm ${disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
                  onClick={() => !disabled && setIsPlacementOpen(!isPlacementOpen)}
              >
                {keyFields.placement.length > 0 ? keyFields.placement.join(', ') : 'Select Placement'}
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
              </div>
              {!disabled && isPlacementOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
                    <div className="py-1">
                      <input
                          type="text"
                          className="block w-full px-4 py-2 text-sm text-gray-900 border-b border-gray-300 focus:outline-none focus:ring-0"
                          placeholder="Search placements..."
                          value={placementSearch}
                          onChange={(e) => setPlacementSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                      />
                      <div className="max-h-60 overflow-y-auto">
                        {filteredPlacements && filteredPlacements.length > 0 ? (
                            filteredPlacements.map((option) => (
                                <div
                                    key={option}
                                    className="flex items-center px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePlacement(option);
                                    }}
                                >
                                  <input
                                      type="checkbox"
                                      checked={keyFields.placement.includes(option)}
                                      onChange={() => { }}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                  <span className="ml-3">{option}</span>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">No placements found</div>
                        )}
                      </div>
                    </div>
                  </div>
              )}
            </div>
        );
      }
      default:
        return null;
    }

    return (
        <div>
          <label htmlFor={field} className="block text-sm font-medium text-gray-700 capitalize">
            {field}
          </label>
          <select
              id={field}
              name={field}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              // CreateWorkflow.jsx (continued)
              value={keyFields[field] as string}
              onChange={(e) => handleKeyFieldChange(field, e.target.value)}
              disabled={disabled}
          >
            <option value="">Select {field.charAt(0).toUpperCase() + field.slice(1)}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
            ))}
          </select>
        </div>
    );
  }, [availableMarkets, availableLanguages, availableClients, availableChannels, availablePages, availableDomains, filteredPlacements, keyFields, loading, placementSearch, isPlacementOpen, togglePlacement, handleKeyFieldChange]);

  // Validation for save and export
  const isSaveDisabled = !workflowName ||
      !keyFields.market ||
      !keyFields.language ||
      !keyFields.client ||
      !keyFields.channel ||
      !keyFields.page ||
      keyFields.placement.length === 0 ||
      !keyFields.domain ||
      nodes.length === 0 ||
      saving;

  const isExportDisabled = !workflowName ||
      !keyFields.language ||
      !keyFields.client ||
      !keyFields.channel ||
      !keyFields.page ||
      keyFields.placement.length === 0 ||
      !keyFields.domain ||
      nodes.length === 0;

  // Get the currently selected node
  const selectedNode = nodes.find(node => node.id === selectedNodeId);

  // Render node settings panel
  const renderNodeSettings = () => {
    if (!selectedNode) {
      return (
        <div className="p-6 text-gray-500 text-center">
          Select a node to view and edit its settings
        </div>
      );
    }

    return (
      <div className="p-6 overflow-y-auto space-y-5">
        <div>
          <label htmlFor="nodeText" className="block text-sm font-medium text-gray-700 mb-1">
            Node Name
          </label>
          <input
            id="nodeText"
            type="text"
            value={selectedNode.text}
            onChange={(e) => {
              const text = e.target.value;
              setNodes(nodes.map(node => 
                node.id === selectedNodeId ? { ...node, text } : node
              ));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="nodeUrl" className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            id="nodeUrl"
            type="text"
            value={selectedNode.url || ''}
            onChange={(e) => {
              const url = e.target.value;
              setNodes(nodes.map(node => 
                node.id === selectedNodeId ? { ...node, url } : node
              ));
            }}
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
            value={JSON.stringify(selectedNode.headers || {}, null, 2)}
            onChange={(e) => {
              try {
                const headers = JSON.parse(e.target.value || '{}');
                setNodes(nodes.map(node => 
                  node.id === selectedNodeId ? { ...node, headers } : node
                ));
              } catch (error) {
                // Don't update invalid JSON
              }
            }}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
            placeholder='{ "Content-Type": "application/json", ... }'
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Input Parameters
          </label>
          <div className="space-y-2 mb-2">
            {(selectedNode.inputParameters || []).map((param, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="text"
                  value={param}
                  onChange={(e) => {
                    const newParams = [...(selectedNode.inputParameters || [])];
                    newParams[index] = e.target.value;
                    setNodes(nodes.map(node => 
                      node.id === selectedNodeId ? { ...node, inputParameters: newParams } : node
                    ));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button
                  onClick={() => {
                    const newParams = [...(selectedNode.inputParameters || [])];
                    newParams.splice(index, 1);
                    setNodes(nodes.map(node => 
                      node.id === selectedNodeId ? { ...node, inputParameters: newParams } : node
                    ));
                  }}
                  className="ml-2 p-2 text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="flex mt-2">
              <input
                type="text"
                placeholder="Add new parameter"
                value={newParameter}
                onChange={(e) => setNewParameter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newParameter.trim()) {
                    const newParams = [...(selectedNode.inputParameters || []), newParameter.trim()];
                    setNodes(nodes.map(node => 
                      node.id === selectedNodeId ? { ...node, inputParameters: newParams } : node
                    ));
                    setNewParameter('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newParameter.trim()) {
                    const newParams = [...(selectedNode.inputParameters || []), newParameter.trim()];
                    setNodes(nodes.map(node => 
                      node.id === selectedNodeId ? { ...node, inputParameters: newParams } : node
                    ));
                    setNewParameter('');
                  }
                }}
                className="ml-2 px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
              >
                Add
              </button>
            </div>
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
              value={selectedNode.retryCount || 1}
              onChange={(e) => {
                const retryCount = Math.max(1, parseInt(e.target.value) || 1);
                setNodes(nodes.map(node => 
                  node.id === selectedNodeId ? { ...node, retryCount } : node
                ));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              min="1"
            />
          </div>

          <div>
            <label htmlFor="retryDelay" className="block text-sm font-medium text-gray-700 mb-1">
              Retry Delay (seconds)
            </label>
            <input
              id="retryDelay"
              type="number"
              value={selectedNode.retryDelaySeconds || 1}
              onChange={(e) => {
                const retryDelaySeconds = Math.max(1, parseInt(e.target.value) || 1);
                setNodes(nodes.map(node => 
                  node.id === selectedNodeId ? { ...node, retryDelaySeconds } : node
                ));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              min="1"
            />
          </div>

          <div>
            <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (milliseconds)
            </label>
            <input
              id="timeout"
              type="number"
              value={selectedNode.timeoutMilliseconds || 1000}
              onChange={(e) => {
                const timeoutMilliseconds = Math.max(100, parseInt(e.target.value) || 1000);
                setNodes(nodes.map(node => 
                  node.id === selectedNodeId ? { ...node, timeoutMilliseconds } : node
                ));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              min="100"
              step="100"
            />
          </div>
        </div>
      </div>
    );
  };

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
              <h1 className="text-xl font-semibold text-gray-800">Create New Workflow</h1>
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
                    onNodesChange={setNodes}
                    onEdgesChange={setEdges}
                    nodeShape="rectangle"
                    nodeBorderRadius={10}
                    onSettingsChange={handleNodeSettingsChange}
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
              <button
                  className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setRightPanelTab('settings')}
              >
                Node Settings
              </button>
              <button
                  className={`px-4 py-2 text-sm font-medium ${rightPanelTab === 'json' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setRightPanelTab('json')}
              >
                JSON
              </button>
            </div>

            {rightPanelTab === 'settings' ? (
                <div className="bg-white rounded-lg shadow-sm mb-4">
                  <div className="p-4">
                    <h2 className="text-lg font-medium text-gray-700 mb-4">Node Settings</h2>
                    {renderNodeSettings()}
                  </div>
                </div>
            ) : null}

            {rightPanelTab === 'details' ? (
                <>
                  <div className="bg-white rounded-lg shadow-sm mb-4">
                    <div className="p-4">
                      <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow Key</h2>

                      {/* Name and Description fields */}
                      <div className="mb-4">
                        <label htmlFor="workflowName" className="block text-sm font-medium text-gray-700">
                          Name *
                        </label>
                        <input
                            type="text"
                            id="workflowName"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Workflow name"
                        />
                      </div>
                      <div className="mb-4">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Description *
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Describe the purpose of this workflow"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderFormField('market')}
                        {renderFormField('language')}
                        {renderFormField('client')}
                        {renderFormField('channel')}
                        {renderFormField('page')}
                        {renderFormField('placement')}
                        {renderFormField('domain')}
                      </div>
                      <div className="text-sm text-gray-500 mt-4 p-2 bg-gray-50 rounded border border-gray-200">
                        <span className="font-medium">Generated Key:</span> {generateKey() || <span className="italic text-gray-400">Complete selections above to generate key</span>}
                      </div>
                    </div>
                  </div>
                </>
            ) : null}

            {rightPanelTab === 'json' ? (
                <div className="bg-white rounded-lg shadow-sm mb-4 h-[calc(100%-60px)]">
                  <div className="p-4 h-full">
                    <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow JSON</h2>
                    <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-[calc(100%-40px)]">
                      {JSON.stringify(createCompleteWorkflow(), null, 2)}
                    </pre>
                  </div>
                </div>
            ) : null}

            <div className="flex justify-between mb-4">
              <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <div className="flex space-x-2">
                <button
                    onClick={() => document.getElementById('import-json-input')?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  <UploadIcon size={16} />
                  Import
                </button>
                <input
                    type="file"
                    id="import-json-input"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                />
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isExportDisabled}
                >
                  <Download size={20} />
                  Export
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaveDisabled}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={20} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}


