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
  
  // Store control points for each edge to maintain curve shape
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

  // Initialize control points for new edges
  useEffect(() => {
    const newControlPoints = { ...edgeControlPoints };
    let updated = false;
    
    edges.forEach(edge => {
      if (!edgeControlPoints[edge.id]) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;
          
          // Create random control points for more natural curves
          const randomOffsetX1 = (Math.random() - 0.5) * 50;
          const randomOffsetY1 = (Math.random() - 0.5) * 50;
          const randomOffsetX2 = (Math.random() - 0.5) * 50;
          const randomOffsetY2 = (Math.random() - 0.5) * 50;
          
          newControlPoints[edge.id] = {
            x1: sourceNode.position.x + dx * 0.3 + randomOffsetX1,
            y1: sourceNode.position.y + dy * 0.3 + randomOffsetY1,
            x2: sourceNode.position.x + dx * 0.7 + randomOffsetX2,
            y2: targetNode.position.y - dy * 0.3 + randomOffsetY2
          };
          updated = true;
        }
      }
    });
    
    if (updated) {
      setEdgeControlPoints(newControlPoints);
    }
  }, [edges, nodes, edgeControlPoints]);

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

  const handleDragStart = (type: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeType', type);
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

  // Draw a curved path between nodes or between a node and the mouse cursor
  const calculateCurvePath = (sourceNode: WorkflowNode, targetPosition: { x: number, y: number }, edgeId?: string, isTemporary = false) => {
    const sourceWidth = typeof sourceNode.size === 'object' ? sourceNode.size.width : 160;
    const sourceHeight = typeof sourceNode.size === 'object' ? sourceNode.size.height : 80;
    
    // Start position is at the bottom center of the source node
    const startX = sourceNode.position.x;
    const startY = sourceNode.position.y + sourceHeight / 2;
    
    // End position is the target position
    const endX = targetPosition.x;
    const endY = targetPosition.y;
    
    // If this is a temporary connection line or no edgeId is provided, use default control points
    if (isTemporary || !edgeId || !edgeControlPoints[edgeId]) {
      const dx = endX - startX;
      const dy = endY - startY;
      
      // Create temporary control points
      const controlX1 = startX + dx * 0.3;
      const controlY1 = startY + dy * 0.3;
      const controlX2 = startX + dx * 0.7;
      const controlY2 = startY + dy * 0.7;
      
      return {
        path: `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`,
        midPoint: {
          x: (controlX1 + controlX2) / 2,
          y: (controlY1 + controlY2) / 2
        }
      };
    }
    
    // Use stored control points for this edge
    const controlPoints = edgeControlPoints[edgeId];
    
    return {
      path: `M ${startX} ${startY} C ${controlPoints.x1} ${controlPoints.y1}, ${controlPoints.x2} ${controlPoints.y2}, ${endX} ${endY}`,
      midPoint: {
        x: (controlPoints.x1 + controlPoints.x2) / 2,
        y: (controlPoints.y1 + controlPoints.y2) / 2
      }
    };
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

                // Calculate target position (at the top center of target node)
                const targetWidth = typeof targetNode.size === 'object' ? targetNode.size.width : 160;
                const targetHeight = typeof targetNode.size === 'object' ? targetNode.size.height : 80;
                const targetPosition = {
                  x: targetNode.position.x,
                  y: targetNode.position.y - targetHeight / 2
                };

                const { path, midPoint } = calculateCurvePath(sourceNode, targetPosition, edge.id);

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

              {isConnecting && connectingSource && !readOnly && (
                <path
                  d={calculateCurvePath(
                    nodes.find(n => n.id === connectingSource)!,
                    mousePos,
                    undefined,
                    true
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
