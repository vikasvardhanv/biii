const createNodeHierarchy = () => {
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
};



const createNodeHierarchy = () => {
  // Build connection maps
  const connectionMap = new Map<string, Set<string>>();
  const incomingConnections = new Map<string, Set<string>>();
  nodes.forEach(node => {
    connectionMap.set(node.id, new Set());
    incomingConnections.set(node.id, new Set());
  });
  
  edges.forEach(edge => {
    if (!connectionMap.has(edge.source)) connectionMap.set(edge.source, new Set());
    connectionMap.get(edge.source)!.add(edge.target);
    if (!incomingConnections.has(edge.target)) incomingConnections.set(edge.target, new Set());
    incomingConnections.get(edge.target)!.add(edge.source);
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

  // Identify forkTasks and track nodes after forktasks
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const forkNodes = nodes.filter(n => n.text === "Fork");
  const forkTaskIds = new Set<string>();
  const postForkTaskIds = new Set<string>();
  
  // First identify all fork tasks
  forkNodes.forEach(forkNode => {
    (connectionMap.get(forkNode.id) || []).forEach(taskId => {
      forkTaskIds.add(taskId);
      
      // Then identify nodes connected to fork tasks
      (connectionMap.get(taskId) || []).forEach(postId => {
        postForkTaskIds.add(postId);
      });
    });
  });

  // Compose the export array with proper hierarchy
  const exported: any[] = [];
  const visited = new Set<string>();

  // Process nodes in the correct hierarchical order
  nodes.forEach(node => {
    // Handle Fork nodes with their tasks
    if (node.text === "Fork" && !visited.has(node.id)) {
      const forkObj = buildNodeObj(node);
      const forkTasks = Array.from(connectionMap.get(node.id) || [])
        .map(forkTaskId => {
          visited.add(forkTaskId);
          return buildNodeObj(nodeMap.get(forkTaskId)!);
        });
      
      if (forkTasks.length > 0) forkObj.forkTasks = forkTasks;
      exported.push(forkObj);
      visited.add(node.id);
    } 
    // Add remaining nodes that haven't been visited yet and aren't fork tasks
    else if (!visited.has(node.id) && !forkTaskIds.has(node.id)) {
      exported.push(buildNodeObj(node));
      visited.add(node.id);
    }
  });

  return exported;
};



===========================


const parseWorkflow = (workflow: any[]) => {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const nodeNameToId = new Map<string, string>();
  const nodeIdsCreated = new Set<string>();

  // First pass: create all nodes
  const processNode = (node: any, depth: number = 0, xOffset: number = 0) => {
    const nodeId = crypto.randomUUID();
    nodeNameToId.set(node.nodeName, nodeId);
    nodeIdsCreated.add(nodeId);
    
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
      position: { x: xOffset * 200, y: depth * 100 },
      size: { width: 120, height: 60 },
      borderRadius: 10
    });
    
    // Process fork tasks if they exist
    if (node.forkTasks && Array.isArray(node.forkTasks)) {
      node.forkTasks.forEach((task: any, i: number) => {
        const taskId = processNode(task, depth + 1, xOffset + i + 1);
        // Create edge from fork to task
        edges.push({
          id: crypto.randomUUID(),
          source: nodeId,
          target: taskId
        });
      });
    }
    
    return nodeId;
  };
  
  // Process all workflow nodes
  workflow.forEach((node, index) => {
    processNode(node, 0, index);
  });
  
  // Second pass: determine if there's implicit sequencing to create edges between parent nodes
  for (let i = 0; i < workflow.length - 1; i++) {
    const currentNodeId = nodeNameToId.get(workflow[i].nodeName);
    const nextNodeId = nodeNameToId.get(workflow[i + 1].nodeName);
    
    if (currentNodeId && nextNodeId) {
      // Add edge between sequential parent nodes if not a fork node
      if (workflow[i].nodeName !== "Fork") {
        edges.push({
          id: crypto.randomUUID(),
          source: currentNodeId,
          target: nextNodeId
        });
      }
    }
  }

  // Layout positioning
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


=========================



  const generateKey = () => {
  const values = { ...keyFields };
  const sortedPlacements = [...values.placement].sort();
  const placementKey = sortedPlacements.length > 0 ? sortedPlacements.join('-') : '';
  values.placement = [placementKey];

  // Remove the name from being included twice
  const keyParts = [
    workflowName.trim() !== '' ? workflowName.replace(/\s+/g, '_').toUpperCase() : '',
    // Remove descKey from here if you don't want it in the key
    ...Object.values(values)
        .filter(val => val !== null && val !== undefined && 
                (Array.isArray(val) ? val.length > 0 : String(val).trim() !== ''))
        .map(value => String(value).toUpperCase())
  ];

  return keyParts
      .filter(part => part !== '')
      .join('_')
      .replace(/\s+/g, '_');
};





===========================



  useEffect(() => {
  const loadWorkflow = async () => {
    if (!key) return;

    try {
      setLoading(true);
      const data = await fetchWorkflowByKey(key);
      console.log("Workflow data:", data); // Debug to see data structure
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

      if (data.key) {
        try {
          const keyUpperCase = data.key.toUpperCase();
          const keyParts = keyUpperCase.split('_');
          
          // Skip the first two parts if those are name and description
          // Adjust index based on your key structure
          const keyPartsToUse = keyParts.slice(keyParts.length >= 9 ? 2 : 0);
          
          if (keyPartsToUse.length >= 7) {
            const placementString = keyPartsToUse[5] || '';
            const placements = placementString.split('-');
            setKeyFields({
              market: keyPartsToUse[0] || '',
              language: keyPartsToUse[1] || '',
              client: keyPartsToUse[2] || '',
              channel: keyPartsToUse[3] || '',
              page: keyPartsToUse[4] || '',
              placement: placements,
              domain: keyPartsToUse[6] || ''
            });
          } else {
            console.warn("Key does not have enough parts:", keyParts);
            // Set what's available and set rest to empty
            setKeyFields({
              market: keyPartsToUse[0] || '',
              language: keyPartsToUse[1] || '',
              client: keyPartsToUse[2] || '',
              channel: keyPartsToUse[3] || '',
              page: keyPartsToUse[4] || '',
              placement: keyPartsToUse[5] ? keyPartsToUse[5].split('-') : [],
              domain: keyPartsToUse[6] || ''
            });
          }
        } catch (err) {
          console.error("Error parsing key:", err, data.key);
        }
      }
    } catch (err: any) {
      setError(`Failed to load workflow: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  loadWorkflow();
}, [key]);





============================



  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        console.log("Imported JSON:", json); // Debug
        
        if (json.workflow) {
          // Parse workflow and set nodes/edges
          const { nodes, edges } = parseWorkflow(json.workflow);
          setNodes(nodes);
          setEdges(edges);
          
          // Set basic workflow info
          setWorkflowName(json.name || '');
          setDescription(json.description || '');
          
          // Parse key fields
          if (json.key) {
            const keyParts = json.key.split('_');
            
            // Skip name/description if they are part of the key
            const startIndex = keyParts.length > 7 ? 2 : 0;
            
            // Extract placement correctly
            const placementIndex = startIndex + 5;
            let placements = [];
            if (keyParts.length > placementIndex) {
              placements = keyParts[placementIndex].split('-');
            }
            
            // Set key fields
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
        } else {
          alert('Invalid workflow file: "workflow" array not found');
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


=====================



  const createNodeHierarchy = () => {
  // Build connection maps
  const connectionMap = new Map<string, Set<string>>();
  const incomingConnections = new Map<string, Set<string>>();
  
  nodes.forEach(node => {
    connectionMap.set(node.id, new Set());
    incomingConnections.set(node.id, new Set());
  });
  
  edges.forEach(edge => {
    if (!connectionMap.has(edge.source)) connectionMap.set(edge.source, new Set());
    connectionMap.get(edge.source)!.add(edge.target);
    
    if (!incomingConnections.has(edge.target)) incomingConnections.set(edge.target, new Set());
    incomingConnections.get(edge.target)!.add(edge.source);
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

  // Identify fork nodes and their direct tasks
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const forkNodes = nodes.filter(n => n.text === "Fork");
  
  // Track nodes in different categories
  const forkTaskIds = new Set<string>();
  const forkToTasksMap = new Map<string, string[]>();
  
  // Identify direct fork tasks
  forkNodes.forEach(fork => {
    const forkId = fork.id;
    const taskIds = Array.from(connectionMap.get(forkId) || []);
    
    forkToTasksMap.set(forkId, taskIds);
    
    // Mark all direct children of fork as fork tasks
    taskIds.forEach(taskId => {
      forkTaskIds.add(taskId);
    });
  });
  
  // Processed nodes tracker
  const processed = new Set<string>();
  
  // Final result array
  const result: any[] = [];
  
  // Process nodes in correct order
  nodes.forEach(node => {
    const nodeId = node.id;
    
    // Skip if already processed or is a fork task (will be added as child)
    if (processed.has(nodeId) || forkTaskIds.has(nodeId)) {
      return;
    }
    
    // Handle fork nodes specially
    if (node.text === "Fork") {
      const forkObj = buildNodeObj(node);
      const taskIds = forkToTasksMap.get(nodeId) || [];
      
      // Add fork tasks as children
      if (taskIds.length > 0) {
        forkObj.forkTasks = taskIds.map(taskId => {
          processed.add(taskId);
          return buildNodeObj(nodeMap.get(taskId)!);
        });
      }
      
      result.push(forkObj);
    } 
    // Process normal parent nodes
    else {
      result.push(buildNodeObj(node));
    }
    
    processed.add(nodeId);
  });
  
  return result;
};


  
