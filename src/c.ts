const createNodeHierarchy = () => {
  // Create node objects
  const nodeData = {};
  nodes.forEach(node => {
    nodeData[node.id] = {
      nodeName: node.text,
      inputParameters: node.inputParameters ?? [],
      retryCount: node.retryCount ?? 1,
      retryDelaySeconds: node.retryDelaySeconds ?? 1,
      timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
    };
    
    if (node.url && node.url.trim() !== '') {
      nodeData[node.id].url = node.url.trim();
    }
    
    if (node.headers && Object.keys(node.headers).length > 0) {
      nodeData[node.id].headers = node.headers;
    }
  });
  
  // Track connections
  const outgoing = {};
  const incoming = {};
  
  edges.forEach(edge => {
    // Outgoing connections
    if (!outgoing[edge.source]) outgoing[edge.source] = [];
    outgoing[edge.source].push(edge.target);
    
    // Incoming connections
    if (!incoming[edge.target]) incoming[edge.target] = [];
    incoming[edge.target].push(edge.source);
  });
  
  // Create the workflow array
  const workflow = [];
  
  // First add all root nodes (no incoming connections)
  const rootNodeIds = nodes
    .filter(node => !incoming[node.id] || incoming[node.id].length === 0)
    .map(node => node.id);
  
  // Process Fork nodes to add forkTasks
  nodes.forEach(node => {
    if (node.text === "Fork") {
      const forkTaskIds = outgoing[node.id] || [];
      
      if (forkTaskIds.length > 0) {
        const nodeObj = nodeData[node.id];
        nodeObj.forkTasks = forkTaskIds.map(taskId => {
          return { ...nodeData[taskId] };
        });
      }
    }
  });
  
  // Add root nodes to workflow
  rootNodeIds.forEach(id => {
    workflow.push({ ...nodeData[id] });
  });
  
  // Add ALL nodes that are NOT in fork tasks OR are connected to from fork tasks
  nodes.forEach(node => {
    // Skip root nodes as they're already added
    if (rootNodeIds.includes(node.id)) return;
    
    // Skip nodes that are directly part of fork tasks
    const isForkTask = nodes.some(n => 
      n.text === "Fork" && outgoing[n.id] && outgoing[n.id].includes(node.id)
    );
    
    // But NEVER skip nodes that are connected to from fork tasks
    const isConnectedFromForkTask = nodes.some(n => {
      if (n.text !== "Fork") return false;
      
      // Check if any fork task connects to this node
      const forkTaskIds = outgoing[n.id] || [];
      return forkTaskIds.some(taskId => {
        const taskConnections = outgoing[taskId] || [];
        return taskConnections.includes(node.id);
      });
    });
    
    // Add to workflow if it's NOT a fork task OR if it's connected from a fork task
    if (!isForkTask || isConnectedFromForkTask) {
      workflow.push({ ...nodeData[node.id] });
    }
  });
  
  return workflow;
};
