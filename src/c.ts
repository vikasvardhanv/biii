import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, ChevronDown, UploadIcon } from 'lucide-react';
import WorkflowDesigner from '../components/WorkflowDesigner';
import type { WorkflowKey, WorkflowNode, WorkflowEdge } from '../types';
import {
  fetchWorkflowOptions,
  getLanguagesForMarket,
  getClientsForMarket,
  getChannelsForClient,
  getPagesForChannel,
  getPlacementsForPage,
  getDomainsForPlacement
} from '../services/workflowOptions';

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const placementRef = useRef<HTMLDivElement>(null);

  const [workflowOptions, setWorkflowOptions] = useState<any>(null);
  const [availableOptions, setAvailableOptions] = useState({
    markets: [] as string[],
    languages: [] as string[],
    clients: [] as any[],
    channels: [] as string[],
    pages: [] as any[],
    placements: [] as string[],
    domains: [] as any[]
  });
  const [placementSearch, setPlacementSearch] = useState('');
  const [filteredPlacements, setFilteredPlacements] = useState<string[]>([]);

  useEffect(() => {
    const initOptions = async () => {
      try {
        const options = await fetchWorkflowOptions();
        setWorkflowOptions(options);
        setAvailableOptions(prev => ({ ...prev, markets: options.markets.map((m: any) => m.MARKET) }));
      } catch (err) {
        console.error('Failed to fetch workflow options:', err);
      }
    };
    initOptions();
  }, []);

  useEffect(() => {
    if (!workflowOptions) return;

    const { market, language, client, channel, page } = keyFields;

    setAvailableOptions(prev => ({
      ...prev,
      languages: market ? getLanguagesForMarket(workflowOptions, market) : [],
      clients: market && language ? getClientsForMarket(workflowOptions, market, language) : [],
      channels: market && language && client ? getChannelsForClient(workflowOptions, market, language, client) : [],
      pages: market && language && client && channel ? getPagesForChannel(workflowOptions, market, language, client, channel) : [],
      placements: market && language && client && channel && page
        ? getPlacementsForPage(workflowOptions, market, language, client, channel, page).flatMap((p: any) => p.PLACEMENT)
        : [],
      domains: market && language && client && channel && page && keyFields.placement.length > 0
        ? getDomainsForPlacement(workflowOptions, market, language, client, channel, page, keyFields.placement.join('-'))
        : []
    }));
  }, [keyFields, workflowOptions]);

  useEffect(() => {
    const search = placementSearch.toLowerCase();
    setFilteredPlacements(
      availableOptions.placements.filter(p => p.toLowerCase().includes(search))
    );
  }, [placementSearch, availableOptions.placements]);

  const handleKeyChange = (field: keyof WorkflowKey, value: string | string[]) => {
    setKeyFields(prev => {
      const resetFields: Partial<WorkflowKey> = {};
      const order: (keyof WorkflowKey)[] = ['market', 'language', 'client', 'channel', 'page', 'placement', 'domain'];
      const index = order.indexOf(field);
      for (let i = index + 1; i < order.length; i++) {
        resetFields[order[i]] = order[i] === 'placement' ? [] : '';
      }
      return { ...prev, [field]: value, ...resetFields };
    });
  };

  const generateWorkflowKey = (): string => {
    const values = { ...keyFields };
    const placementKey = [...values.placement].sort().join('-');
    values.placement = [placementKey];
    return Object.values(values)
      .filter(val => val)
      .map(val => Array.isArray(val) ? val[0] : val)
      .map(String)
      .map(val => val.toUpperCase().replace(/\s+/g, '_'))
      .join('_');
  };

  const createNodeHierarchy = () => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgesMap = new Map<string, string[]>();
    const incoming = new Set(edges.map(e => e.target));

    edges.forEach(e => {
      if (!edgesMap.has(e.source)) edgesMap.set(e.source, []);
      edgesMap.get(e.source)!.push(e.target);
    });

    const buildTree = (id: string): any => {
      const node = nodeMap.get(id);
      if (!node) return null;
      const children = (edgesMap.get(id) || []).map(buildTree).filter(Boolean);
      return {
        nodeName: node.text,
        url: node.url || '',
        headers: node.headers || {},
        inputParameters: node.inputParameters || [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000,
        ...(children.length > 0 && { children })
      };
    };

    const roots = nodes.filter(n => !incoming.has(n.id));
    return roots.map(n => buildTree(n.id)).filter(Boolean);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: workflowName,
        key: generateWorkflowKey(),
        status: 'pending',
        workflow: createNodeHierarchy(),
        lastModified: new Date()
      };

      const response = await fetch('/workflow/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(await response.text());

      alert('Workflow saved successfully!');
      navigate('/');
    } catch (error: any) {
      console.error(error);
      setSaveError(error.message);
      alert(`Failed to save workflow: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const data = {
      name: workflowName,
      key: generateWorkflowKey(),
      status: 'pending',
      workflow: createNodeHierarchy()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.key}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!json.workflow) return alert('Invalid file');

        setWorkflowName(json.name);
        setNodes([]); // You would implement proper parsing logic
        setEdges([]); // based on your node/edge format

        const keyParts = json.key?.toUpperCase().split('_') || [];
        setKeyFields({
          market: keyParts[0] || '',
          language: keyParts[1] || '',
          client: keyParts[2] || '',
          channel: keyParts[3] || '',
          page: keyParts[4] || '',
          placement: keyParts[5] ? keyParts[5].split('-') : [],
          domain: keyParts[6] || ''
        });
      } catch (err) {
        alert('Error parsing file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      {/* UI logic omitted for brevity. Add form inputs, buttons, WorkflowDesigner, etc. */}
    </div>
  );
}
