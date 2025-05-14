const parseWorkflow = (workflow: any[]) => {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const nodeMap = new Map<string, string>(); // Map nodeName to nodeId
  
  // First pass: Create all nodes with appropriate positioning
  let xPosition = 0;
  const yLevels = {
    main: 0,
    forkTask: 100,
    afterForkTask: 200
  };
  
  // Helper to create a node and get its ID
  const createNode = (nodeDef: any, level: 'main' | 'forkTask' | 'afterForkTask', xOffset: number = 0) => {
    const nodeId = crypto.randomUUID();
    nodeMap.set(nodeDef.nodeName, nodeId);
    
    nodes.push({
      type: "rectangle",
      id: nodeId,
      text: nodeDef.nodeName,
      url: nodeDef.url || '',
      headers: nodeDef.headers || {},
      inputParameters: nodeDef.inputParameters || [],
      retryCount: nodeDef.retryCount || 1,
      retryDelaySeconds: nodeDef.retryDelaySeconds || 1,
      timeoutMilliseconds: nodeDef.timeoutMilliseconds || 1000,
      position: { x: (xPosition + xOffset) * 200, y: yLevels[level] },
      size: { width: 120, height: 60 },
      borderRadius: 10
    });
    
    return nodeId;
  };
  
  // Process regular and fork nodes
  for (let i = 0; i < workflow.length; i++) {
    const node = workflow[i];
    const nodeId = createNode(node, 'main');
    
    // Connect to previous node if not the first node
    if (i > 0 && nodeMap.has(workflow[i-1].nodeName)) {
      const prevNodeId = nodeMap.get(workflow[i-1].nodeName)!;
      edges.push({
        id: crypto.randomUUID(),
        source: prevNodeId,
        target: nodeId
      });
    }
    
    // If it's a fork node with tasks, create the tasks
    if (node.forkTasks && Array.isArray(node.forkTasks)) {
      const forkTasks: string[] = [];
      
      // Create each fork task
      node.forkTasks.forEach((task: any, taskIndex: number) => {
        const taskId = createNode(task, 'forkTask', taskIndex);
        forkTasks.push(taskId);
        
        // Connect fork to task
        edges.push({
          id: crypto.randomUUID(),
          source: nodeId,
          target: taskId
        });
      });
      
      // If there's a next node after this fork, connect last fork task to it
      if (i < workflow.length - 1 && forkTasks.length > 0) {
        const nextNodeId = createNode(workflow[i+1], 'main');
        nodeMap.set(workflow[i+1].nodeName, nextNodeId);
        
        // Connect all fork tasks to the next node
        forkTasks.forEach(taskId => {
          edges.push({
            id: crypto.randomUUID(),
            source: taskId,
            target: nextNodeId
          });
        });
        
        // Skip the next node since we already created it
        i++;
      }
    }
    
    // Increment x position for next node
    xPosition += 1;
  }
  
  // Layout adjustments for better visualization
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




=====================





  // In ViewWorkflow.tsx
return (
  // ... other JSX
  <div className="w-2/3 p-4 overflow-auto border-r border-gray-200">
    <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full">
      <div className="p-4 h-full">
        <WorkflowDesigner
          nodes={nodes}
          edges={edges}
          onNodesChange={() => {}} // This is fine for read-only
          onEdgesChange={() => {}} // This is fine for read-only
          nodeShape="rectangle"
          nodeBorderRadius={10}
          readOnly={true}
          // Add this line to ensure arrows are visible
          arrowHeadType="arrowclosed"
        />
      </div>
    </div>
  </div>
  // ... other JSX
);




+++++++++++++++


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

  // Identify fork nodes and their tasks
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const forkNodes = nodes.filter(n => n.text === "Fork");
  
  // Track different node types
  const forkTaskIds = new Set<string>();
  const forkToTasksMap = new Map<string, string[]>();
  
  // Find all fork tasks
  forkNodes.forEach(fork => {
    const forkId = fork.id;
    const taskIds = Array.from(connectionMap.get(forkId) || []);
    
    forkToTasksMap.set(forkId, taskIds);
    
    taskIds.forEach(taskId => {
      forkTaskIds.add(taskId);
    });
  });
  
  // Find nodes after fork tasks
  const afterForkTaskMap = new Map<string, Set<string>>();
  forkTaskIds.forEach(taskId => {
    const connectedNodes = connectionMap.get(taskId) || new Set<string>();
    if (connectedNodes.size > 0) {
      afterForkTaskMap.set(taskId, connectedNodes);
    }
  });
  
  // Keep track of processed nodes
  const processed = new Set<string>();
  
  // Build the workflow structure preserving connections
  const result: any[] = [];
  
  // Build main workflow nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeId = node.id;
    
    // Skip processed nodes and fork tasks
    if (processed.has(nodeId) || forkTaskIds.has(nodeId)) {
      continue;
    }
    
    if (node.text === "Fork") {
      // Create fork node
      const forkObj = buildNodeObj(node);
      
      // Add fork tasks
      const taskIds = forkToTasksMap.get(nodeId) || [];
      if (taskIds.length > 0) {
        forkObj.forkTasks = taskIds.map(taskId => {
          processed.add(taskId);
          return buildNodeObj(nodeMap.get(taskId)!);
        });
      }
      
      result.push(forkObj);
      processed.add(nodeId);
    } else {
      // Regular node
      result.push(buildNodeObj(node));
      processed.add(nodeId);
    }
  }
  
  // Add metadata to help with connections
  // This won't be exported but helps with reconstruction
  result.forEach((node, index) => {
    // Add next node reference if not the last node
    if (index < result.length - 1) {
      node._nextNode = result[index + 1].nodeName;
    }
    
    // For fork nodes, add connections from fork tasks
    if (node.forkTasks) {
      node._forkTaskConnections = [];
      const forkId = nodes.find(n => n.text === node.nodeName)?.id;
      
      if (forkId) {
        const taskIds = forkToTasksMap.get(forkId) || [];
        
        taskIds.forEach(taskId => {
          const afterNodes = afterForkTaskMap.get(taskId);
          if (afterNodes && afterNodes.size > 0) {
            afterNodes.forEach(afterNodeId => {
              const afterNodeName = nodeMap.get(afterNodeId)?.text;
              if (afterNodeName) {
                node._forkTaskConnections.push({
                  from: nodeMap.get(taskId)?.text,
                  to: afterNodeName
                });
              }
            });
          }
        });
      }
    }
  });
  
  return result;
};




++++++++++++


useEffect(() => {
  const loadWorkflow = async () => {
    if (!key) return;

    try {
      setLoading(true);
      const data = await fetchWorkflowByKey(key);
      console.log("Loaded workflow data:", data); // Debug log
      
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

      // Special handling for key fields
      if (data.key) {
        // Log the key for debugging
        console.log("Parsing key:", data.key);
        
        try {
          // First, get the key parts
          const keyParts = data.key.split('_');
          console.log("Key parts:", keyParts);
          
          // Extract the workflow-specific part and the metadata parts
          let metadataParts = keyParts;
          
          // If key format is NAME_DESC_MARKET_LANG_etc
          // we need to skip name and description
          if (keyParts.length > 7) {
            // Skip workflow name and description
            metadataParts = keyParts.slice(2);
          }
          
          console.log("Metadata parts:", metadataParts);
          
          // Even if we don't have 7 parts, set what we have
          const market = metadataParts[0] || '';
          const language = metadataParts[1] || '';
          const client = metadataParts[2] || '';
          const channel = metadataParts[3] || '';
          const page = metadataParts[4] || '';
          // Placement might have dashes
          const placementStr = metadataParts[5] || '';
          const placements = placementStr ? placementStr.split('-') : [];
          const domain = metadataParts[6] || '';
          
          // Set key fields with what we have
          setKeyFields({
            market,
            language,
            client,
            channel,
            page,
            placement: placements,
            domain
          });
          
          console.log("Set key fields:", {
            market,
            language,
            client,
            channel,
            page, 
            placement: placements,
            domain
          });
          
        } catch (err) {
          console.error("Error parsing key fields:", err);
          setError(`Failed to parse workflow key: ${err}`);
        }
      }
    } catch (err: any) {
      console.error("Error loading workflow:", err);
      setError(`Failed to load workflow: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  loadWorkflow();
}, [key]);


