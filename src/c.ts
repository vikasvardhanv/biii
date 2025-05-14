import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, Code, FileText } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge, Workflow, WorkflowKey } from '../types';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { fetchWorkflowByKey } from '../services/workflow';
import { fetchWorkflowOptions, getLanguagesForMarket, getClientsForMarket, getChannelsForClient, getPagesForChannel, getPlacementsForPage, getDomainsForPlacement } from '../services/workflowOptions';

export default function EditWorkflow() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
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
  const [error, setError] = useState('');
  const placementRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('designer');
  const [rightPanelTab, setRightPanelTab] = useState('details');
  const [workflowStatus, setWorkflowStatus] = useState<'pending' | 'approved' | 'review'>('pending');

  const [workflowOptions, setWorkflowOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [availablePlacements, setAvailablePlacements] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<any[]>([]);
  const [filteredPlacements, setFilteredPlacements] = useState<string[]>([]);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (!key) return;

      try {
        setLoading(true);
        const data = await fetchWorkflowByKey(key);
        setWorkflow(data);
        setWorkflowName(data.name || '');
        setDescription(data.description || '');
        setWorkflowStatus(data.status as 'pending' | 'approved' | 'review' || 'pending');

        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        } else if (data.workflow) {
          const { nodes, edges } = parseWorkflow(data.workflow);
          setNodes(nodes);
          setEdges(edges);
        }

        const keyUpperCase = data.key ? data.key.toUpperCase() : '';

        if (keyUpperCase) {
          const keyParts = keyUpperCase.split('_');
          if (keyParts.length >= 7) {
            const placementString = keyParts[5] || '';
            const placements = placementString.split('-');
            setKeyFields({
              market: keyParts[0] || '',
              language: keyParts[1] || '',
              client: keyParts[2] || '',
              channel: keyParts[3] || '',
              page: keyParts[4] || '',
              placement: placements,
              domain: keyParts[6] || ''
            });
            setError('');
          } else {
            console.warn("Key in JSON does not have enough parts.");
          }
        } else {
          console.warn("Key is empty in workflow data.");
        }

      } catch (err: any) {
        setError(`Failed to load workflow: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [key]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setOptionsLoading(true);
        const options = await fetchWorkflowOptions();
        setWorkflowOptions(options);

        if (options && options.MARKETS) {
          setAvailableMarkets(options.MARKETS.map((m: any) => m.MARKET));
        }
      } catch (error) {
        console.error('Failed to load workflow options:', error);
        setError('Failed to load workflow options.');
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, []);

  // Keep all the useEffect hooks for updating available options based on selections
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
      const filtered = flattenedPlacements.filter(p =>
        p.toLowerCase().includes(placementSearch.toLowerCase())
      );
      setFilteredPlacements(filtered);
    } else {
      setAvailablePlacements([]);
      setFilteredPlacements([]);
    }
  }, [workflowOptions, keyFields.market, keyFields.language, keyFields.client, keyFields.channel, keyFields.page, placementSearch]);

  useEffect(() => {
    if (availablePlacements.length > 0) {
      const filtered = availablePlacements.filter(p =>
        p.toLowerCase().includes(placementSearch.toLowerCase())
      );
      setFilteredPlacements(filtered);
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
    return Object.values(values)
      .filter(val => val !== null && val !== undefined && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== ''))
      .map(value => String(value).toUpperCase())
      .join('_')
      .replace(/\s+/g, '_');
  };

  const createNodeHierarchy = () => {
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    const connectionMap = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!connectionMap.has(edge.source)) {
        connectionMap.set(edge.source, new Set());
      }
      connectionMap.get(edge.source)!.add(edge.target);
    });

    const incomingConnections = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!incomingConnections.has(edge.target)) {
        incomingConnections.set(edge.target, new Set());
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
      status: workflowStatus,
      workflow: createNodeHierarchy(),
      lastModified: new Date(),
    };
    return workflow;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const payload = createCompleteWorkflow();

      const headers: Headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');

      const request: RequestInfo = new Request('/workflow/save', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      const response = await fetch(request);

      if (!response.ok) {
        throw new Error(`Failed to save workflow. Status: ${response.status}`);
      }

      console.log("Workflow saved successfully!");
      alert('Workflow saved successfully!');
      navigate('/');

    } catch (err: any) {
      setError(`Failed to save workflow: ${err.message}`);
      console.error("Error saving workflow:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const workflowData = createCompleteWorkflow();
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowData.key}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseWorkflow = (workflow: any[]) => {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    const traverse = (node: any, parentId: string | null = null, depth: number = 0, index: number = 0) => {
      const nodeId = crypto.randomUUID();
      nodes.push({
        type: "rectangle",
        id: nodeId,
        text: node.nodeName,
        url: node.url || '',
        headers: node.headers || {},
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

      if (node.children) {
        node.children.forEach((child: any, childIndex: number) => traverse(child, nodeId, depth + 1, childIndex));
      }
    };

    workflow.forEach((node: any, index: number) => traverse(node, null, 0, index));

    // Centering logic
    const minX = Math.min(...nodes.map(node => node.position.x));
    const minY = Math.min(...nodes.map(node => node.position.y));
    const maxX = Math.max(...nodes.map(node => node.position.x));
    const maxY = Math.max(...nodes.map(node => node.position.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const viewportCenterX = 500;
    const offsetX = viewportCenterX - centerX;
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

  const handleKeyFieldChange = (field: keyof WorkflowKey, value: string | string[]) => {
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
  };

  const renderFormField = (field: keyof WorkflowKey) => {
    let options: { value: string; label: string }[] = [];
    let disabled = false;

    switch (field) {
      case 'market':
        options = availableMarkets.map(market => ({ value: market.toUpperCase(), label: market.toUpperCase() }));
        disabled = optionsLoading;
        break;
      case 'language':
        options = availableLanguages.map(language => ({ value: language.toUpperCase(), label: language.toUpperCase() }));
        disabled = optionsLoading || !keyFields.market;
        break;
      case 'client':
        options = availableClients.map((client: any) => ({ value: client.CLIENT.toUpperCase(), label: client.CLIENT.toUpperCase() }));
        disabled = optionsLoading || !keyFields.language;
        break;
      case 'channel':
        options = availableChannels.map((channel: any) => ({ value: channel.toUpperCase(), label: channel.toUpperCase() }));
        disabled = optionsLoading || !keyFields.client;
        break;
      case 'page':
        options = availablePages.map((page: any) => ({ value: page.PAGE.toUpperCase(), label: page.PAGE.toUpperCase() }));
        disabled = optionsLoading || !keyFields.channel;
        break;
      case 'domain':
        options = availableDomains.map((domain: any) => ({ value: domain.DOMAIN.toUpperCase(), label: domain.DOMAIN.toUpperCase() }));
        disabled = optionsLoading || keyFields.placement.length === 0;
        break;
      case 'placement': {
        disabled = optionsLoading || !keyFields.page;
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
    !keyFields.market ||
    !keyFields.language ||
    !keyFields.client ||
    !keyFields.channel ||
    !keyFields.page ||
    keyFields.placement.length === 0 ||
    !keyFields.domain ||
    nodes.length === 0;

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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
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
            <h1 className="text-xl font-semibold text-gray-800">Edit Workflow</h1>
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

        import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Edit2, Code, FileText } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('designer');
  const [rightPanelTab, setRightPanelTab] = useState('details');
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

      if (node.children) {
        node.children.forEach((child: any, childIndex: number) => traverse(child, nodeId, depth + 1, childIndex));
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
            </div>

            <div className="p-4 h-[calc(100%-48px)]">
              {activeTab === 'designer' ? (
                <WorkflowDesigner
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={() => {}}
                  onEdgesChange={() => {}}
                  nodeShape="rectangle"
                  nodeBorderRadius={10}
                  readOnly={true}
                />
              ) : (
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm h-full">
                  {JSON.stringify(workflow, null, 2)}
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
                    <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                      {description || <span className="text-gray-400 italic">No description provided</span>}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 capitalize">
                      {workflow.status || 'pending'}
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
