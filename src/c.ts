import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, UploadIcon, Code, FileText } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('designer');

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

  // Input/Output parameters
  const [inputParameters, setInputParameters] = useState<{key: string, value: string}[]>([]);
  const [outputParameters, setOutputParameters] = useState<{key: string, value: string}[]>([]);

  // Workflow flags
  const [isRestartable, setIsRestartable] = useState(false);
  const [enforceSchema, setEnforceSchema] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState('0');
  const [timeoutPolicy, setTimeoutPolicy] = useState('Alert Only');
  const [failureWorkflowName, setFailureWorkflowName] = useState('');
  const [statusListenerEnabled, setStatusListenerEnabled] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        const options = await fetchWorkflowOptions();
        setWorkflowOptions(options);

        if (options && options.markets) {
          setAvailableMarkets(options.markets.map((m: any) => m.MARKET));
        }
      } catch (error) {
        console.error('Failed to load workflow options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, []);

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

    const result = rootNodes
      .sort((a, b) => a.position.y - b.position.y)
      .map(node => buildNodeTree(node.id))
      .filter(Boolean);

    return result;
  };

  const createCompleteWorkflow = () => {
    const workflow = {
      name: workflowName,
      description: description,
      key: generateKey(),
      status: 'pending',
      workflow: createNodeHierarchy(),
      lastModified: new Date(),
      inputParameters: inputParameters.filter(p => p.key.trim() !== '').map(p => p.key.trim()),
      outputParameters: outputParameters.filter(p => p.key.trim() !== '').map(p => p.key.trim()),
      flags: {
        restartable: isRestartable,
        enforceSchema: enforceSchema
      },
      timeoutSettings: {
        timeoutSeconds: parseInt(timeoutSeconds) || 0,
        timeoutPolicy: timeoutPolicy
      },
      failureWorkflow: failureWorkflowName,
      statusListener: {
        enabled: statusListenerEnabled
      }
    };
    return workflow;
  };

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

  const parseWorkflow = (workflow: any[]) => {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const traverse = (node: any, parentId: string | null = null, depth: number = 10, index: number = 10) => {
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
        position: { x: depth * 200, y: index * 100 },
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.workflow) {
            const { nodes, edges } = parseWorkflow(json.workflow);
            setNodes(nodes);
            setEdges(edges);
            setWorkflowName(json.name || '');
            setDescription(json.description || '');

            // Import other settings if available
            if (json.inputParameters) {
              setInputParameters(json.inputParameters.map((p: string) => ({ key: p, value: '' })));
            }
            if (json.outputParameters) {
              setOutputParameters(json.outputParameters.map((p: string) => ({ key: p, value: '' })));
            }
            if (json.flags) {
              setIsRestartable(json.flags.restartable || false);
              setEnforceSchema(json.flags.enforceSchema || false);
            }
            if (json.timeoutSettings) {
              setTimeoutSeconds(json.timeoutSettings.timeoutSeconds?.toString() || '0');
              setTimeoutPolicy(json.timeoutSettings.timeoutPolicy || 'Alert Only');
            }
            if (json.failureWorkflow) {
              setFailureWorkflowName(json.failureWorkflow);
            }
            if (json.statusListener) {
              setStatusListenerEnabled(json.statusListener.enabled || false);
            }

            if (json.key) {
              try {
                const keyUpperCase = json.key.toUpperCase();
                const keyParts = keyUpperCase.split('_');

                if (keyParts.length >= 7) {
                  setKeyFields({
                    market: keyParts[0] || '',
                    language: keyParts[1] || '',
                    client: keyParts[2] || '',
                    channel: keyParts[3] || '',
                    page: keyParts[4] || '',
                    placement: keyParts[5] ? keyParts[5].split('-') : [],
                    domain: keyParts[6] || '',
                  });
                } else {
                  console.warn("Key in JSON does not have enough parts. Some dropdowns may not be populated.");
                  alert("Key in JSON does not have enough parts. Some dropdowns may not be populated.");
                  setKeyFields({
                    market: keyParts[0] || '',
                    language: keyParts[1] || '',
                    client: keyParts[2] || '',
                    channel: keyParts[3] || '',
                    page: keyParts[4] || '',
                    placement: keyParts[5] ? keyParts[5].split('-') : [],
                    domain: '',
                  });
                }
              } catch (error) {
                console.error("Error parsing key from JSON:", error);
                alert("Error parsing key from JSON. Some dropdowns may not be populated.");
              }
            } else {
              setKeyFields({ market: '', language: '', client: '', channel: '', page: '', placement: [], domain: '' });
            }
          } else {
            alert('Invalid workflow file: "workflow" array not found.');
          }
        } catch (error) {
          console.error("Failed to parse JSON file:", error);
          alert('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    }

    if (event.target) {
      event.target.value = '';
    }
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

  const addInputParameter = () => {
    setInputParameters([...inputParameters, { key: '', value: '' }]);
  };

  const removeInputParameter = (index: number) => {
    const newParams = [...inputParameters];
    newParams.splice(index, 1);
    setInputParameters(newParams);
  };

  const updateInputParameter = (index: number, key: string) => {
    const newParams = [...inputParameters];
    newParams[index].key = key;
    setInputParameters(newParams);
  };

  const addOutputParameter = () => {
    setOutputParameters([...outputParameters, { key: '', value: '' }]);
  };

  const removeOutputParameter = (index: number) => {
    const newParams = [...outputParameters];
    newParams.splice(index, 1);
    setOutputParameters(newParams);
  };

  const updateOutputParameter = (index: number, key: string) => {
    const newParams = [...outputParameters];
    newParams[index].key = key;
    setOutputParameters(newParams);
  };

  const renderFormField = (field: keyof WorkflowKey) => {
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
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-500">Last updated about 1 month ago</p>
            <span className="text-sm text-gray-700">sample@example.com</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
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

        {/* Right Panel - Workflow Details */}
{/* Right Panel - Workflow Details */}
        <div className="w-1/3 p-4 overflow-auto bg-gray-50">
          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
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
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Input parameters</h2>
              {inputParameters.length === 0 ? (
                <p className="text-sm text-gray-500 mb-2">(empty)</p>
              ) : (
                <div className="space-y-2 mb-2">
                  {inputParameters.map((param, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => updateInputParameter(index, e.target.value)}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Parameter name"
                      />
                      <button
                        onClick={() => removeInputParameter(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addInputParameter}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Output parameters</h2>
              {outputParameters.length === 0 ? (
                <p className="text-sm text-gray-500 mb-2">(empty)</p>
              ) : (
                <div className="space-y-2 mb-2">
                  {outputParameters.map((param, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => updateOutputParameter(index, e.target.value)}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Parameter name"
                      />
                      <button
                        onClick={() => removeOutputParameter(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addOutputParameter}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Schema</h2>
              <p className="text-sm text-gray-600 mb-2">JSON schema for input/output validation. <a href="#" className="text-blue-600 hover:text-blue-800">Learn more</a>.</p>
              
              <div className="flex items-center mb-4">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <span className="mr-2">Enforce schema</span>
                  <div className={`relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in ${enforceSchema ? 'bg-blue-600' : 'bg-gray-200'}`} style={{ borderRadius: '20px' }}>
                    <input
                      type="checkbox"
                      name="enforceSchema"
                      id="enforceSchema"
                      checked={enforceSchema}
                      onChange={() => setEnforceSchema(!enforceSchema)}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 appearance-none cursor-pointer"
                      style={{ top: '1px', left: enforceSchema ? '21px' : '1px', transition: 'left 0.2s' }}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow flags</h2>
              
              <div className="flex items-center mb-4">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <span className="mr-2">Restartable</span>
                  <div className={`relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in ${isRestartable ? 'bg-blue-600' : 'bg-gray-200'}`} style={{ borderRadius: '20px' }}>
                    <input
                      type="checkbox"
                      name="restartable"
                      id="restartable"
                      checked={isRestartable}
                      onChange={() => setIsRestartable(!isRestartable)}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 appearance-none cursor-pointer"
                      style={{ top: '1px', left: isRestartable ? '21px' : '1px', transition: 'left 0.2s' }}
                    />
                  </div>
                </label>
              </div>
              
              <p className="text-xs text-gray-500 mb-4">
                If restarting a completed workflow can have side effects, turn this flag off and completed workflows will not be allowed to restart.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="timeoutSeconds" className="block text-sm font-medium text-gray-700">
                    Timeout seconds
                  </label>
                  <input
                    type="number"
                    id="timeoutSeconds"
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(e.target.value)}
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="timeoutPolicy" className="block text-sm font-medium text-gray-700">
                    Timeout policy
                  </label>
                  <select
                    id="timeoutPolicy"
                    value={timeoutPolicy}
                    onChange={(e) => setTimeoutPolicy(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="Alert Only">Alert Only</option>
                    <option value="Time Out">Time Out</option>
                    <option value="Alert and Time Out">Alert and Time Out</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="failureWorkflowName" className="block text-sm font-medium text-gray-700">
                  Failure workflow name
                </label>
                <input
                  type="text"
                  id="failureWorkflowName"
                  value={failureWorkflowName}
                  onChange={(e) => setFailureWorkflowName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter workflow name to trigger on failure"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If present, this workflow will be triggered upon a failure of the execution of this workflow.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow status listener</h2>
              
              <div className="flex items-center mb-4">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <span className="mr-2">Workflow status listener enabled</span>
                  <div className={`relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in ${statusListenerEnabled ? 'bg-blue-600' : 'bg-gray-200'}`} style={{ borderRadius: '20px' }}>
                    <input
                      type="checkbox"
                      name="statusListener"
                      id="statusListener"
                      checked={statusListenerEnabled}
                      onChange={() => setStatusListenerEnabled(!statusListenerEnabled)}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 appearance-none cursor-pointer"
                      style={{ top: '1px', left: statusListenerEnabled ? '21px' : '1px', transition: 'left 0.2s' }}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Workflow Key</h2>
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

      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: white;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #4F46E5;
        }
      `}</style>
    </div>
  );
}
