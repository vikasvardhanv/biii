import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, UploadIcon, Code, FileText, Plus } from 'lucide-react';
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
  const [, setSaveError] = useState('');
  const placementRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('designer');
  const [rightPanelTab, setRightPanelTab] = useState('details'); // New tab for right panel
  const [configJson, setConfigJson] = useState(''); // For JSON input in modal

  const [workflowOptions, setWorkflowOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [availablePlacements, setAvailablePlacements] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<any[]>([]);
  const [filteredPlacements, setFilteredPlacements] = useState<string[]>([]);

  // Sample JSON for testing
  const sampleJson = JSON.stringify({
    "tasks": [
      {
        "id": "task1",
        "name": "Start Task",
        "type": "start",
        "position": { "x": 200, "y": 100 }
      },
      {
        "id": "task2",
        "name": "Process Data",
        "type": "process",
        "position": { "x": 200, "y": 200 }
      },
      {
        "id": "task3",
        "name": "Decision Point",
        "type": "decision",
        "position": { "x": 200, "y": 300 }
      },
      {
        "id": "task4",
        "name": "End Task",
        "type": "end",
        "position": { "x": 200, "y": 400 }
      }
    ],
    "connections": [
      { "source": "task1", "target": "task2" },
      { "source": "task2", "target": "task3" },
      { "source": "task3", "target": "task4" }
    ]
  }, null, 2);

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

  // Keep all other useEffect hooks the same...

  const togglePlacement = (value: string) => {
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
  };

  const generateKey = () => {
    const values = { ...keyFields };
    const sortedPlacements = [...values.placement].sort();
    const placementKey = sortedPlacements.length > 0 ? sortedPlacements.join('-') : '';
    values.placement = [placementKey];
    
    // Include workflow name and description in the key generation
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
  };

  const createNodeHierarchy = () => {
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
    const connectionMap = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!connectionMap.has(edge.source)) {
        connectionMap.set(edge.source, new Set<string>());
      }
      connectionMap.get(edge.source)!.add(edge.target);
    });

    const incomingConnections = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!incomingConnections.has(edge.target)) {
        incomingConnections.set(edge.target, new Set<string>());
      }
      incomingConnections.get(edge.target)!.add(edge.source);
    });

    // Identify fork nodes (nodes that have multiple incoming connections)
    const forkNodes = new Set<string>();
    incomingConnections.forEach((sources, nodeId) => {
      if (sources.size > 1) {
        forkNodes.add(nodeId);
      }
    });

    const rootNodes = sortedNodes.filter(node =>
      !incomingConnections.has(node.id) || incomingConnections.get(node.id)!.size === 0
    );

    const buildNodeTree = (nodeId: string, visited: Set<string> = new Set()): any => {
      if (visited.has(nodeId)) return null;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;

      const children = connectionMap.get(nodeId);

      // Create base node result
      const result: any = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };

      if (node.url && node.url.trim() !== '') {
        result.url = node.url.trim();
      }

      if (node.headers && Object.keys(node.headers).length > 0) {
        result.headers = node.headers;
      }

      if (children && children.size > 0) {
        const sortedChildren = Array.from(children)
          .map(childId => nodes.find(n => n.id === childId))
          .filter((n): n is WorkflowNode => !!n)
          .sort((a, b) => a.position.y - b.position.y)
          .map(child => buildNodeTree(child.id, visited))
          .filter(Boolean);

        if (sortedChildren.length > 0) {
          result.children = sortedChildren;
        }
      }

      return result;
    };

    // Handle fork tasks specifically
    const processForkTasks = (result: any) => {
      // Deep clone the result to avoid modifying the original
      const processedResult = JSON.parse(JSON.stringify(result));
      
      // Function to recursively process each node
      const processNode = (node: any) => {
        // Check if this node has children
        if (node.children && node.children.length > 0) {
          // Check each child to see if it's a fork node
          const forkTaskIds = new Set<string>();
          node.children.forEach((child: any) => {
            // If this child is a fork task (multiple parents point to it)
            const nodeId = nodes.find(n => n.text === child.nodeName)?.id;
            if (nodeId && forkNodes.has(nodeId)) {
              forkTaskIds.add(nodeId);
            }
          });
          
          // If we found fork tasks, restructure them
          if (forkTaskIds.size > 0) {
            const regularChildren = node.children.filter((child: any) => {
              const nodeId = nodes.find(n => n.text === child.nodeName)?.id;
              return !nodeId || !forkTaskIds.has(nodeId);
            });
            
            const forkTasks = Array.from(forkTaskIds).map(id => {
              const forkNode = nodes.find(n => n.id === id);
              if (!forkNode) return null;
              
              const forkNodeData = node.children.find((c: any) => 
                c.nodeName === forkNode.text
              );
              
              return forkNodeData;
            }).filter(Boolean);
            
            // Replace children with regular children + fork tasks group
            node.children = regularChildren;
            if (forkTasks.length > 0) {
              node.forkTasks = forkTasks;
            }
          }
          
          // Recursively process all children
          node.children.forEach(processNode);
          if (node.forkTasks) {
            node.forkTasks.forEach(processNode);
          }
        }
      };
      
      // Process each root node
      processedResult.forEach(processNode);
      return processedResult;
    };

    const result = rootNodes
      .sort((a, b) => a.position.y - b.position.y)
      .map(node => buildNodeTree(node.id))
      .filter(Boolean);

    return processForkTasks(result);
  };

  const createCompleteWorkflow = () => {
    const workflow = {
      name: workflowName,
      description: description,
      key: generateKey(),
      status: 'pending',
      workflow: createNodeHierarchy(),
      lastModified: new Date(),
    };
    return workflow;
  };

  const handleSave = async () => {
    // Same implementation
  };

  const handleExport = () => {
    // Same implementation
  };

  const parseWorkflow = (workflow: any[]) => {
    // Same implementation
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Same implementation
  };

  const handleJsonConfig = () => {
    try {
      const config = JSON.parse(jsonInput);
      
      // Process the tasks from JSON
      const newNodes: WorkflowNode[] = config.tasks.map((task: any) => ({
        type: "rectangle",
        id: task.id || crypto.randomUUID(),
        text: task.name,
        url: task.url || '',
        headers: task.headers || {},
        inputParameters: task.inputParameters || [],
        retryCount: task.retryCount || 1,
        retryDelaySeconds: task.retryDelaySeconds || 1,
        timeoutMilliseconds: task.timeoutMilliseconds || 1000,
        position: task.position || { x: 200, y: 200 },
        size: { width: 120, height: 60 },
        borderRadius: 10
      }));
      
      // Process the connections from JSON
      const newEdges: WorkflowEdge[] = config.connections.map((conn: any) => ({
        id: crypto.randomUUID(),
        source: conn.source,
        target: conn.target
      }));
      
      setNodes(newNodes);
      setEdges(newEdges);
      setShowJsonModal(false);
      setJsonInput('');
    } catch (error) {
      console.error("Failed to parse JSON config:", error);
      alert('Failed to parse JSON config. Please check the format.');
    }
  };

  const handleKeyFieldChange = (field: keyof WorkflowKey, value: string | string[]) => {
    // Same implementation
  };

  const renderFormField = (field: keyof WorkflowKey) => {
    // Same implementation
  };

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
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                className={`px-4 py-3 text-sm font-medium ${activeTab === 'designer' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('designer')}
              >
                <div className="flex items-center space-x-2">
                  <FileText size={16} />
                  <span>Workflow Designer</span>
                </div>
              </button>
              <button
                className={`px-4 py-3 text-sm font-medium ${activeTab === 'json' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('json')}
              >
                <div className="flex items-center space-x-2">
                  <Code size={16} />
                  <span>JSON</span>
                </div>
              </button>
              
              {/* New button for JSON Config */}
              <button
                className="ml-auto px-4 py-3 text-sm font-medium text-green-600 hover:text-green-700 flex items-center"
                onClick={() => setShowJsonModal(true)}
              >
                <Plus size={16} className="mr-1" />
                <span>Add Tasks from JSON</span>
              </button>
            </div>

            <div className="p-4 h-[calc(100%-48px)]">
              {activeTab === 'designer' ? (
                <WorkflowDesigner
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={setNodes}
                  onEdgesChange={setEdges}
                  nodeShape="rectangle"
                  nodeBorderRadius={10}
                />
              ) : (
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-full">
                  {JSON.stringify(createCompleteWorkflow(), null, 2)}
                </pre>
              )}
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
                  <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow Key</h2>
                  
                  {/* Name and Description fields moved into the Workflow Key section */}
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
          ) : (
            // JSON tab for right panel
            <div className="bg-white rounded-lg shadow-sm mb-4 h-[calc(100%-60px)]">
              <div className="p-4 h-full">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow JSON</h2>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-[calc(100%-40px)]">
                  {JSON.stringify(createCompleteWorkflow(), null, 2)}
                </pre>
              </div>
            </div>
          )}

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
      
      {/* Modal for JSON Config Input */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-2/3 max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Import Tasks from JSON</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                Paste your JSON configuration below. It should follow this format:
              </p>
              <div className="bg-gray-50 p-3 rounded mb-4 text-xs overflow-auto max-h-40">
                <pre>{sampleJson}</pre>
              </div>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-md min-h-[200px] mb-4 font-mono text-sm"
              placeholder="Paste your JSON here..."
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setJsonInput(sampleJson);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Use Sample
              </button>
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleJsonConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Import Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
