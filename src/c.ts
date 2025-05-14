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

  // Find root nodes (no incoming edges)
  const rootNodes = nodes.filter(node =>
    !incomingConnections.get(node.id) || incomingConnections.get(node.id)!.size === 0
  );

  // Helper to build the node tree recursively
  const buildNodeTree = (nodeId: string, visited: Set<string> = new Set()): any => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const outgoing = connectionMap.get(nodeId) ? Array.from(connectionMap.get(nodeId)!) : [];

    // If node is Fork, collect all outgoing as forkTasks
    if (node.text === "Fork") {
      // Create tasks for all outgoing connections from fork
      const forkTasks = outgoing
        .map(childId => {
          // Create a new visited set for each branch to avoid interference
          // This ensures each fork branch is fully explored independently
          return buildNodeTree(childId, new Set(visited));
        })
        .filter(Boolean);

      // Create the result object with basic properties
      const result: any = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };
      
      // Add optional properties if they exist
      if (node.url && node.url.trim() !== '') {
        result.url = node.url.trim();
      }
      if (node.headers && Object.keys(node.headers).length > 0) {
        result.headers = node.headers;
      }
      
      // Add fork tasks as separate array, not as children
      if (forkTasks.length > 0) {
        result.forkTasks = forkTasks;
      }
      
      return result;
    } else {
      // Regular node: create basic properties
      const result: any = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };
      
      // Add optional properties if they exist
      if (node.url && node.url.trim() !== '') {
        result.url = node.url.trim();
      }
      if (node.headers && Object.keys(node.headers).length > 0) {
        result.headers = node.headers;
      }
      
      return result;
    }
  };

  // Process the main workflow as a flat list
  const result: any[] = [];
  let currentNodes = [...rootNodes];
  const processedNodes = new Set<string>();
  
  while (currentNodes.length > 0) {
    const node = currentNodes.shift();
    if (!node) break;
    
    // Skip if this node was already processed
    if (processedNodes.has(node.id)) continue;
    processedNodes.add(node.id);
    
    // Build the node tree starting from this node
    const nodeObj = buildNodeTree(node.id);
    if (nodeObj) {
      result.push(nodeObj);
    }
    
    // For non-fork nodes, follow the first outgoing edge (if any) for the main flow
    if (node.text !== "Fork") {
      const outgoing = connectionMap.get(node.id) ? Array.from(connectionMap.get(node.id)!) : [];
      if (outgoing.length > 0) {
        const nextNode = nodes.find(n => n.id === outgoing[0]);
        if (nextNode && !processedNodes.has(nextNode.id)) {
          currentNodes.unshift(nextNode);
        }
      }
    }
  }

  return result;
};
