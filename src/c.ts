const createNodeHierarchy = () => {
  try {
    // Just return the root nodes with minimal information
    // This will at least keep the UI from breaking completely
    return nodes
      .filter(node => {
        // Check if it's a root node (no incoming edges)
        const hasIncomingEdge = edges.some(edge => edge.target === node.id);
        return !hasIncomingEdge;
      })
      .map(node => {
        return {
          nodeName: node.text,
          inputParameters: node.inputParameters ?? [],
          retryCount: node.retryCount ?? 1,
          retryDelaySeconds: node.retryDelaySeconds ?? 1,
          timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
        };
      });
  } catch (error) {
    console.error("Error creating node hierarchy:", error);
    return [{ nodeName: "Error in hierarchy generation", inputParameters: [] }];
  }
};




const createNodeHierarchy = () => {
  try {
    // Create basic node data
    const nodeData = {};
    nodes.forEach(node => {
      nodeData[node.id] = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };
      
      // Add optional properties
      if (node.url && node.url.trim() !== '') {
        nodeData[node.id].url = node.url.trim();
      }
      
      if (node.headers && Object.keys(node.headers).length > 0) {
        nodeData[node.id].headers = node.headers;
      }
    });
    
    // Map connections (avoid using references to prevent circular dependencies)
    const outgoingConnections = {};
    edges.forEach(edge => {
      if (!outgoingConnections[edge.source]) {
        outgoingConnections[edge.source] = [];
      }
      outgoingConnections[edge.source].push(edge.target);
    });
    
    // Find root nodes
    const incomingConnections = {};
    edges.forEach(edge => {
      if (!incomingConnections[edge.target]) {
        incomingConnections[edge.target] = [];
      }
      incomingConnections[edge.target].push(edge.source);
    });
    
    const rootNodeIds = nodes
      .filter(node => !incomingConnections[node.id] || incomingConnections[node.id].length === 0)
      .map(node => node.id);
    
    // VERY SIMPLE APPROACH: Just create a flat list with Fork nodes having forkTasks
    const result = [];
    
    // Add root nodes first
    rootNodeIds.forEach(nodeId => {
      // Get the node data
      const node = { ...nodeData[nodeId] };
      
      // If it's a Fork node, add fork tasks
      if (nodes.find(n => n.id === nodeId)?.text === "Fork") {
        const targetIds = outgoingConnections[nodeId] || [];
        if (targetIds.length > 0) {
          node.forkTasks = targetIds.map(targetId => {
            return { ...nodeData[targetId] };
          });
        }
      }
      
      result.push(node);
    });
    
    // Return only the root nodes and their immediate fork tasks
    // This avoids any deep nesting that could cause problems
    return result;
  } catch (error) {
    console.error("Error in createNodeHierarchy:", error);
    // Return a minimal valid result to prevent UI from breaking
    return [{ nodeName: "Error occurred", inputParameters: [] }];
  }
};
