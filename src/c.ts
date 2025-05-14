const createNodeHierarchy = () => {
  // Create a map of outgoing connections
  const outgoingConnections = {};
  edges.forEach(edge => {
    if (!outgoingConnections[edge.source]) {
      outgoingConnections[edge.source] = [];
    }
    outgoingConnections[edge.source].push(edge.target);
  });

  // Create a map of incoming connections to identify root nodes
  const incomingConnections = {};
  edges.forEach(edge => {
    if (!incomingConnections[edge.target]) {
      incomingConnections[edge.target] = [];
    }
    incomingConnections[edge.target].push(edge.source);
  });

  // Identify root nodes
  const rootNodeIds = nodes
    .filter(node => !incomingConnections[node.id] || incomingConnections[node.id].length === 0)
    .map(node => node.id);

  // Create the workflow structure
  const workflow = [];
  const processedNodes = new Set();

  // Process all nodes starting from roots
  const processNodes = (nodeIds, isRootLevel = true) => {
    for (const nodeId of nodeIds) {
      // Skip already processed nodes unless they're fork task targets
      if (processedNodes.has(nodeId) && isRootLevel) continue;
      
      // Mark this node as processed
      processedNodes.add(nodeId);
      
      // Get the node
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      // Create the node object
      const nodeObj = {
        nodeName: node.text,
        inputParameters: node.inputParameters ?? [],
        retryCount: node.retryCount ?? 1,
        retryDelaySeconds: node.retryDelaySeconds ?? 1,
        timeoutMilliseconds: node.timeoutMilliseconds ?? 1000
      };
      
      // Add optional properties
      if (node.url && node.url.trim() !== '') {
        nodeObj.url = node.url.trim();
      }
      
      if (node.headers && Object.keys(node.headers).length > 0) {
        nodeObj.headers = node.headers;
      }
      
      // Get connections from this node
      const connections = outgoingConnections[nodeId] || [];
      
      // If this is a Fork node, add fork tasks
      if (node.text === "Fork" && connections.length > 0) {
        // Create fork tasks
        nodeObj.forkTasks = [];
        
        for (const targetId of connections) {
          const targetNode = nodes.find(n => n.id === targetId);
          if (!targetNode) continue;
          
          // Create the fork task object
          const forkTaskObj = {
            nodeName: targetNode.text,
            inputParameters: targetNode.inputParameters ?? [],
            retryCount: targetNode.retryCount ?? 1,
            retryDelaySeconds: targetNode.retryDelaySeconds ?? 1,
            timeoutMilliseconds: targetNode.timeoutMilliseconds ?? 1000
          };
          
          // Add optional properties
          if (targetNode.url && targetNode.url.trim() !== '') {
            forkTaskObj.url = targetNode.url.trim();
          }
          
          if (targetNode.headers && Object.keys(targetNode.headers).length > 0) {
            forkTaskObj.headers = targetNode.headers;
          }
          
          // Important: Check if this fork task connects to other nodes
          const forkTaskConnections = outgoingConnections[targetId] || [];
          
          // If this fork task has outgoing connections, add them as children
          // This is the key change to preserve connections from fork tasks
          if (forkTaskConnections.length > 0) {
            // Process the children of this fork task
            const childNodes = processNodes(forkTaskConnections, false);
            
            // Add the children to this fork task
            if (childNodes.length > 0) {
              // We need to decide how to represent these connections
              // Option 1: Add them as a children array
              forkTaskObj.children = childNodes;
            }
          }
          
          // Add this fork task to the node's fork tasks
          nodeObj.forkTasks.push(forkTaskObj);
        }
      } else if (connections.length > 0) {
        // For non-fork nodes with connections, process the first connection
        const childNodes = processNodes([connections[0]], false);
        if (childNodes.length > 0) {
          // Add the first child
          nodeObj.children = [childNodes[0]];
        }
      }
      
      // If this is a root level call, add the node to the workflow
      if (isRootLevel) {
        workflow.push(nodeObj);
      } else {
        // Otherwise return it to be added to its parent
        return [nodeObj];
      }
    }
    
    return [];
  };
  
  // Start processing from root nodes
  processNodes(rootNodeIds);
  
  return workflow;
};
