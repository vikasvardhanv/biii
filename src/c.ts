import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, Upload, Plus, Trash2 } from 'lucide-react';
import type { WorkflowKey, WorkflowNode, WorkflowEdge } from '../types';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { fetchWorkflowOptions, getLanguagesForMarket, getClientsForMarket, getChannelsForClient, getPagesForChannel, getPlacementsForPage, getDomainsForPlacement } from '../services/workflowOptions';

export default function CreateWorkflow() {
  const navigate = useNavigate();
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
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
  
  const [inputParameters, setInputParameters] = useState<Array<{key: string, value: string}>>([
    {key: 'saleOrderId', value: ''}
  ]);
  const [outputParameters, setOutputParameters] = useState<Array<{key: string, value: string}>>([]);
  
  const [timeoutSeconds, setTimeoutSeconds] = useState('0');
  const [timeoutPolicy, setTimeoutPolicy] = useState('Alert Only');
  const [failureWorkflowName, setFailureWorkflowName] = useState('');
  const [isRestartable, setIsRestartable] = useState(true);
  const [enableStatusListener, setEnableStatusListener] = useState(false);
  const [enforceSchema, setEnforceSchema] = useState(false);

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
  const [selectedTab, setSelectedTab] = useState('all');

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

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');

    const payload = {
      name: workflowName,
      description: workflowDescription,
      key: generateKey(),
      status: 'pending',
      workflow: createNodeHierarchy(),
      lastModified: new Date(),
      inputParameters: inputParameters.filter(param => param.key.trim() !== ''),
      outputParameters: outputParameters.filter(param => param.key.trim() !== ''),
      timeoutSeconds: parseInt(timeoutSeconds) || 0,
      timeoutPolicy: timeoutPolicy,
      failureWorkflowName: failureWorkflowName,
      isRestartable: isRestartable,
      enableStatusListener: enableStatusListener,
      enforceSchema: enforceSchema
    };

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
    const workflowKey = generateKey();
    const workflow = {
      name: workflowName,
      description: workflowDescription,
      status: 'pending',
      key: workflowKey,
      workflow: createNodeHierarchy(),
      inputParameters: inputParameters.filter(param => param.key.trim() !== ''),
      outputParameters: outputParameters.filter(param => param.key.trim() !== ''),
      timeoutSeconds: parseInt(timeoutSeconds) || 0,
      timeoutPolicy: timeoutPolicy,
      failureWorkflowName: failureWorkflowName,
      isRestartable: isRestartable,
      enableStatusListener: enableStatusListener,
      enforceSchema: enforceSchema
    };

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
            setWorkflowDescription(json.description || '');
            
            // Import additional workflow settings
            if (json.inputParameters) setInputParameters(json.inputParameters);
            if (json.outputParameters) setOutputParameters(json.outputParameters);
            if (json.timeoutSeconds) setTimeoutSeconds(json.timeoutSeconds.toString());
            if (json.timeoutPolicy) setTimeoutPolicy(json.timeoutPolicy);
            if (json.failureWorkflowName) setFailureWorkflowName(json.failureWorkflowName);
            if (json.isRestartable !== undefined) setIsRestartable(json.isRestartable);
            if (json.enableStatusListener !== undefined) setEnableStatusListener(json.enableStatusListener);
            if (json.enforceSchema !== undefined) setEnforceSchema(json.enforceSchema);

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
              setKeyFields({ market: '', language: '', client: '', channel: '', page: '', placement: [], domain: ''});
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
      const newKeyFields = {...prev, [field]: value};

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
    setInputParameters([...inputParameters, {key: '', value: ''}]);
  };
  
  const removeInputParameter = (index: number) => {
    const newParams = [...inputParameters];
    newParams.splice(index, 1);
    setInputParameters(newParams);
  };
  
  const updateInputParameter = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...inputParameters];
    newParams[index][field] = value;
    setInputParameters(newParams);
  };
  
  const addOutputParameter = () => {
    setOutputParameters([...outputParameters, {key: '', value: ''}]);
  };
  
  const removeOutputParameter = (index: number) => {
    const newParams = [...outputParameters];
    newParams.splice(index, 1);
    setOutputParameters(newParams);
  };
  
  const updateOutputParameter = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...outputParameters];
    newParams[index][field] = value;
    setOutputParameters(newParams);
  };

  const renderFormField = (field: keyof WorkflowKey) => {
    let options: { value: string; label: string }[] = [];
    let disabled = false;

    switch (field) {
      case 'market':
        options = availableMarkets.map(market => ({value: market.toUpperCase(), label: market.toUpperCase()}));
        disabled = loading;
        break;
      case 'language':
        options = availableLanguages.map(language => ({value: language.toUpperCase(), label: language.toUpperCase()}));
        disabled = loading || !keyFields.market;
        break;
      case 'client':
        options = availableClients.map((client : any) => ({value: client.CLIENT.toUpperCase(), label: client.CLIENT.toUpperCase()}));
        disabled = loading || !keyFields.language;
        break;
      case 'channel':
        options = availableChannels.map((channel : any)  => ({value: channel.toUpperCase(), label: channel.toUpperCase()}));
        disabled = loading || !keyFields.client;
        break;
      case 'page':
        options = availablePages.map((page : any) => ({value: page.PAGE.toUpperCase(), label: page.PAGE.toUpperCase()}));
        disabled = loading || !keyFields.channel;
        break;
      case 'domain':
        options = availableDomains.map((domain : any) => ({value: domain.DOMAIN.toUpperCase(), label: domain.DOMAIN.toUpperCase()}));
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
                            onChange={() => {}}
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <button
            onClick={() => navigate('/')}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </button>
          Create New Workflow
        </h1>
        <div className="text-sm text-gray-600">
          Last updated about 1 month ago · manivaradhan.kasthuri@gmail.com
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label htmlFor="workflowName" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="workflowName"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Workflow demo"
            />
          </div>
          
          <div>
            <label htmlFor="workflowDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              id="workflowDescription"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Demo of calling HTTP API along with one human task"
            />
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        {/* Left: Form */}
        <div className="flex-1 min-w-[350px]">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Workflow Configuration</h2>
            
            {loading && (
              <div className="text-center py-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                <p className="mt-2">Loading options...</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {renderFormField('market')}
              {renderFormField('language')}
             {renderFormField('client')}
             {renderFormField('channel')}
             {renderFormField('page')}
             {renderFormField('placement')}
             {renderFormField('domain')}
           </div>
           
           <div className="text-sm text-gray-500 mt-2 p-2 bg-gray-50 rounded border border-gray-200 mb-6">
             <span className="font-medium">Generated Key:</span> {generateKey() || <span className="italic text-gray-400">Complete selections above to generate key</span>}
           </div>
           
           <h3 className="text-md font-medium mb-3">Input parameters</h3>
           <div className="space-y-3 mb-6">
             {inputParameters.map((param, index) => (
               <div key={index} className="flex items-center gap-2">
                 <div className="flex-grow">
                   <label className={index === 0 ? "block text-xs text-gray-500 mb-1" : "sr-only"}>
                     Key
                   </label>
                   <input
                     type="text"
                     value={param.key}
                     onChange={(e) => updateInputParameter(index, 'key', e.target.value)}
                     className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                     placeholder="Parameter key"
                   />
                 </div>
                 <div className="flex-grow">
                   <label className={index === 0 ? "block text-xs text-gray-500 mb-1" : "sr-only"}>
                     Value
                   </label>
                   <input
                     type="text"
                     value={param.value}
                     onChange={(e) => updateInputParameter(index, 'value', e.target.value)}
                     className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                     placeholder="Default value"
                   />
                 </div>
                 <div className="flex items-end h-10">
                   {index === 0 ? (
                     <button 
                       onClick={addInputParameter}
                       className="h-10 px-3 py-2 ml-2 bg-blue-600 text-white rounded-md flex items-center justify-center"
                     >
                       <Plus size={18} />
                     </button>
                   ) : (
                     <button 
                       onClick={() => removeInputParameter(index)}
                       className="h-10 px-3 py-2 ml-2 text-gray-500 hover:text-red-500 rounded-md flex items-center justify-center"
                     >
                       <Trash2 size={18} />
                     </button>
                   )}
                 </div>
               </div>
             ))}
           </div>
           
           <h3 className="text-md font-medium mb-3">Output parameters</h3>
           <div className="space-y-3 mb-6">
             {outputParameters.length === 0 ? (
               <div className="text-center py-3 border-dashed border-2 border-gray-200 rounded-md">
                 <span className="text-gray-500">(empty)</span>
               </div>
             ) : (
               outputParameters.map((param, index) => (
                 <div key={index} className="flex items-center gap-2">
                   <div className="flex-grow">
                     <input
                       type="text"
                       value={param.key}
                       onChange={(e) => updateOutputParameter(index, 'key', e.target.value)}
                       className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                       placeholder="Parameter key"
                     />
                   </div>
                   <div className="flex-grow">
                     <input
                       type="text"
                       value={param.value}
                       onChange={(e) => updateOutputParameter(index, 'value', e.target.value)}
                       className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                       placeholder="Default value"
                     />
                   </div>
                   <button 
                     onClick={() => removeOutputParameter(index)}
                     className="h-10 px-3 py-2 ml-2 text-gray-500 hover:text-red-500 rounded-md flex items-center justify-center"
                   >
                     <Trash2 size={18} />
                   </button>
                 </div>
               ))
             )}
             <button
               onClick={addOutputParameter}
               className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800"
             >
               <Plus size={16} /> Add
             </button>
           </div>
           
           <h3 className="text-md font-medium mb-3">Schema</h3>
           <div className="mb-6">
             <p className="text-sm text-gray-600 mb-2">
               JSON schema for input/output validation. <a href="#" className="text-blue-600 hover:underline">Learn more</a>.
             </p>
             <div className="flex items-center gap-2">
               <span>Enforce schema</span>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={enforceSchema} onChange={() => setEnforceSchema(!enforceSchema)} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
             </div>
           </div>
           
           <h3 className="text-md font-medium mb-3">Workflow flags</h3>
           <div className="mb-6">
             <div className="flex items-center gap-2 mb-2">
               <span>Restartable</span>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={isRestartable} onChange={() => setIsRestartable(!isRestartable)} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
             </div>
             <p className="text-sm text-gray-600 mb-4">
               If restarting a completed workflow can have side effects, turn this flag off and completed workflows will not be allowed to restart.
             </p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
               <div>
                 <label htmlFor="timeoutSeconds" className="block text-sm font-medium text-gray-700 mb-1">
                   Timeout seconds
                 </label>
                 <input
                   type="number"
                   id="timeoutSeconds"
                   min="0"
                   value={timeoutSeconds}
                   onChange={(e) => setTimeoutSeconds(e.target.value)}
                   className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                 />
               </div>
               <div>
                 <label htmlFor="timeoutPolicy" className="block text-sm font-medium text-gray-700 mb-1">
                   Timeout policy
                 </label>
                 <select
                   id="timeoutPolicy"
                   className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                   value={timeoutPolicy}
                   onChange={(e) => setTimeoutPolicy(e.target.value)}
                 >
                   <option value="Alert Only">Alert Only</option>
                   <option value="Retry">Retry</option>
                   <option value="Time Out">Time Out</option>
                 </select>
               </div>
             </div>
             
             <div>
               <label htmlFor="failureWorkflowName" className="block text-sm font-medium text-gray-700 mb-1">
                 Failure workflow name
               </label>
               <input
                 type="text"
                 id="failureWorkflowName"
                 value={failureWorkflowName}
                 onChange={(e) => setFailureWorkflowName(e.target.value)}
                 className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                 placeholder="Enter workflow name"
               />
               <p className="text-sm text-gray-600 mt-1">
                 If present, this workflow will be triggered upon a failure of the execution of this workflow.
               </p>
             </div>
           </div>
           
           <h3 className="text-md font-medium mb-3">Workflow status listener</h3>
           <div className="flex items-center gap-2 mb-6">
             <span>Workflow status listener enabled</span>
             <label className="relative inline-flex items-center cursor-pointer">
               <input type="checkbox" checked={enableStatusListener} onChange={() => setEnableStatusListener(!enableStatusListener)} className="sr-only peer" />
               <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
             </label>
           </div>
           
           <div className="flex flex-wrap gap-3 mt-6">
             <button
               onClick={handleSave}
               disabled={isSaveDisabled}
               className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Save size={20} />
               {saving ? 'Saving...' : 'Save Workflow'}
             </button>
             <button
               onClick={() => document.getElementById('import-json-input')?.click()}
               className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
             >
               <Upload size={16} />
               Import Workflow
             </button>
             <input
               type="file"
               id="import-json-input"
               accept=".json"
               style={{display: 'none'}}
               onChange={handleImport}
             />
             <button
               onClick={handleExport}
               className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={isExportDisabled}
             >
               <Download size={20} />
               Export Workflow
             </button>
             <button
               onClick={() => navigate('/')}
               className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
             >
               Cancel
             </button>
           </div>
           
           {saveError && (
             <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
               {saveError}
             </div>
           )}
         </div>
       </div>
       
       {/* Right: Workflow Designer */}
       <div className="flex-1 min-w-[350px]">
         <div className="bg-white rounded-lg shadow-md p-6 h-full">
           <h2 className="text-lg font-semibold mb-4">Workflow Diagram</h2>
           
           <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-4">
             <div className="flex">
               <button
                 className={`px-4 py-2 text-sm font-medium ${selectedTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                 onClick={() => setSelectedTab('all')}
               >
                 All
               </button>
               <button
                 className={`px-4 py-2 text-sm font-medium ${selectedTab === 'system' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                 onClick={() => setSelectedTab('system')}
               >
                 System
               </button>
               <button
                 className={`px-4 py-2 text-sm font-medium ${selectedTab === 'operators' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                 onClick={() => setSelectedTab('operators')}
               >
                 Operators
               </button>
               <button
                 className={`px-4 py-2 text-sm font-medium ${selectedTab === 'aiAgents' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                 onClick={() => setSelectedTab('aiAgents')}
               >
                 AI Agents
               </button>
             </div>
             
             <div className="mt-4 px-4">
               <div className="relative">
                 <input
                   type="text"
                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="Filter tasks"
                 />
                 <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                   <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                 </div>
                 <button className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
               
               <div className="mt-4 space-y-2">
                 <div className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer">
                   <div className="bg-blue-100 rounded-full p-2 mr-3">
                     <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-sm font-medium">Worker Task (Simple)</h3>
                     <p className="text-xs text-gray-500">Runs a Worker task.</p>
                   </div>
                 </div>
                 
                 <div className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                   <div className="bg-gray-100 rounded-full p-2 mr-3">
                     <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-sm font-medium">Event Task</h3>
                     <p className="text-xs text-gray-500">Runs an event task.</p>
                   </div>
                 </div>
                 
                 <div className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                   <div className="bg-gray-100 rounded-full p-2 mr-3">
                     <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-sm font-medium">HTTP Task</h3>
                     <p className="text-xs text-gray-500">Call an HTTP endpoint.</p>
                   </div>
                 </div>
                 
                 <div className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                   <div className="bg-gray-100 rounded-full p-2 mr-3">
                     <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-sm font-medium">HTTP Poll Task</h3>
                     <p className="text-xs text-gray-500">Call an HTTP poll endpoint.</p>
                   </div>
                 </div>
               </div>
             </div>
           </div>
           
           <div className="bg-white border border-gray-200 rounded-lg h-96 flex justify-center items-center">
             <WorkflowDesigner
               nodes={nodes}
               edges={edges}
               onNodesChange={setNodes}
               onEdgesChange={setEdges}
               nodeShape="rectangle"
               nodeBorderRadius={10}
             />
           </div>
         </div>
       </div>
     </div>
   </div>
 );
}
