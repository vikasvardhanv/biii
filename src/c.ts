const createNodeHierarchy = () => {
  // Build connection maps
  const connectionMap = new Map<string, Set<string>>();
  const incomingConnections = new Map<string, Set<string>>();
  
  // Initialize connection maps
  nodes.forEach(node => {
    connectionMap.set(node.id, new Set());
    incomingConnections.set(node.id, new Set());
  });
  
  // Fill connection maps based on edges
  edges.forEach(edge => {
    if (!connectionMap.has(edge.source)) connectionMap.set(edge.source, new Set());
    connectionMap.get(edge.source)!.add(edge.target);

    if (!incomingConnections.has(edge.target)) incomingConnections.set(edge.target, new Set());
    incomingConnections.get(edge.target)!.add(edge.source);
  });

  // First pass: create node objects for all nodes
  const nodeObjects = new Map<string, any>();
  nodes.forEach(node => {
    const nodeObj = {
      nodeName: node.text,
      inputParameters: node.inputParameters ?? [],
      retryCount: node.retryCount ?? 1,
      retryDelaySeconds: node.retryDelaySeconds ?? 1,
      timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
    };
    
    if (node.url && node.url.trim() !== '') {
      nodeObj.url = node.url.trim();
    }
    
    if (node.headers && Object.keys(node.headers).length > 0) {
      nodeObj.headers = node.headers;
    }
    
    nodeObjects.set(node.id, nodeObj);
  });
  
  // Second pass: establish connections
  nodes.forEach(node => {
    const nodeObj = nodeObjects.get(node.id);
    if (!nodeObj) return;
    
    const outgoing = connectionMap.get(node.id) ? Array.from(connectionMap.get(node.id)!) : [];
    
    // Handle Fork nodes specially
    if (node.text === "Fork" && outgoing.length > 0) {
      // Create fork tasks for all outgoing connections
      nodeObj.forkTasks = outgoing.map(targetId => {
        const targetObj = nodeObjects.get(targetId);
        if (targetObj) {
          // Clone the target to avoid reference issues
          return { ...targetObj };
        }
        return null;
      }).filter(Boolean);
    }
  });

  // Find root nodes and build the workflow
  const workflow: any[] = [];
  rootNodes.forEach(rootNode => {
    const rootObj = nodeObjects.get(rootNode.id);
    if (rootObj) {
      workflow.push({ ...rootObj });
    }
  });
  
  // Handle connections between nodes that aren't parent-child relationships
  edges.forEach(edge => {
    // Skip edges from Fork nodes, as they're handled through forkTasks
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.text === "Fork") return;
    
    // For regular connections, add a nextNode reference
    const sourceObj = nodeObjects.get(edge.source);
    const targetObj = nodeObjects.get(edge.target);
    
    if (sourceObj && targetObj && !sourceObj.nextNode) {
      sourceObj.nextNode = { ...targetObj };
    }
  });

  // Final step: Convert to the expected flat structure
  const finalWorkflow: any[] = [];
  
  // Process the workflow recursively to extract all nodes
  const processWorkflow = (items: any[]) => {
    for (const item of items) {
      // Extract and remove nextNode
      const nextNode = item.nextNode;
      delete item.nextNode;
      
      // Add the current item
      finalWorkflow.push(item);
      
      // Process nextNode if present
      if (nextNode) {
        processWorkflow([nextNode]);
      }
      
      // Process forkTasks if present
      if (item.forkTasks && item.forkTasks.length > 0) {
        // Keep fork tasks as is since they should be nested
      }
    }
  };
  
  processWorkflow(workflow);
  
  return finalWorkflow;
};
