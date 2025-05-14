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

  // Find root nodes (no incoming edges)
  const rootNodes = nodes.filter(node =>
    !incomingConnections.get(node.id) || incomingConnections.get(node.id)!.size === 0
  );

  // Create basic node objects
  const createNodeObject = (node: WorkflowNode) => {
    const nodeObj: any = {
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
    
    return nodeObj;
  };

  // Track nodes for duplicate detection
  const alreadyInForkTasks = new Set<string>();
  const nodesInMainFlow = new Set<string>();

  // Process all nodes in the workflow
  const result: any[] = [];

  // First add root nodes
  rootNodes.forEach(rootNode => {
    const rootObj = createNodeObject(rootNode);
    nodesInMainFlow.add(rootNode.id);
    
    // If this is a Fork node, handle its forkTasks
    if (rootNode.text === "Fork") {
      const outgoing = connectionMap.get(rootNode.id) ? Array.from(connectionMap.get(rootNode.id)!) : [];
      
      if (outgoing.length > 0) {
        rootObj.forkTasks = outgoing.map(childId => {
          const childNode = nodes.find(n => n.id === childId);
          if (!childNode) return null;
          
          // Create the fork task node object
          const childObj = createNodeObject(childNode);
          
          // Mark this node as being in a fork task
          alreadyInForkTasks.add(childId);
          
          return childObj;
        }).filter(Boolean);
      }
    }
    
    result.push(rootObj);
  });

  // Then add any remaining nodes that are not already in fork tasks
  // First find nodes that aren't root nodes or in fork tasks
  const remainingNodeIds = nodes
    .filter(node => !nodesInMainFlow.has(node.id) && !alreadyInForkTasks.has(node.id))
    .map(node => node.id);
  
  // Sort these nodes by their dependency relationships if possible
  const sortedRemainingNodes: string[] = [];
  const visited = new Set<string>();
  
  // Simple topological sort
  const visitNode = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const outgoing = connectionMap.get(nodeId) ? Array.from(connectionMap.get(nodeId)!) : [];
    outgoing.forEach(targetId => {
      if (remainingNodeIds.includes(targetId)) {
        visitNode(targetId);
      }
    });
    
    sortedRemainingNodes.push(nodeId);
  };
  
  remainingNodeIds.forEach(nodeId => {
    if (!visited.has(nodeId)) {
      visitNode(nodeId);
    }
  });
  
  // Add the sorted remaining nodes
  sortedRemainingNodes.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const nodeObj = createNodeObject(node);
      result.push(nodeObj);
    }
  });

  return result;
};
