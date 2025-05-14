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
  
  // Helper to build the node tree recursively
  const buildNodeTree = (nodeId: string, visited: Set<string> = new Set()): any => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const outgoing = connectionMap.get(nodeId) ? Array.from(connectionMap.get(nodeId)!) : [];

    // If node is Fork, collect all outgoing as forkTasks
    if (node.text === "Fork") {
      const forkTasks = outgoing
        .map(childId => buildNodeTree(childId, new Set(visited)))
        .filter(Boolean);

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
      if (forkTasks.length > 0) {
        result.forkTasks = forkTasks;
      }
      return result;
    } else {
      // Not a Fork: just return the node, do not add children
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
      // No children property for non-fork nodes
      return result;
    }
  };

  // Build the main flow as a flat list
  const result: any[] = [];
  let currentNodes = [...rootNodes];
  while (currentNodes.length > 0) {
    const node = currentNodes.shift();
    if (!node) break;
    const nodeObj = buildNodeTree(node.id);
    result.push(nodeObj);

    // For non-fork nodes, follow the first outgoing edge (if any) for the main flow
    if (node.text !== "Fork") {
      const outgoing = connectionMap.get(node.id) ? Array.from(connectionMap.get(node.id)!) : [];
      if (outgoing.length > 0) {
        const nextNode = nodes.find(n => n.id === outgoing[0]);
        if (nextNode) currentNodes.unshift(nextNode);
      }
    }
  }

  // Special handling for Delj node
  // This ensures Delj is always included in the top-level workflow
  const deljNode = nodes.find(n => n.text === "Delj");
  if (deljNode) {
    // Check if Delj is already in the result
    const deljExists = result.some(node => node.nodeName === "Delj");
    
    // If Delj doesn't exist in the result yet, add it
    if (!deljExists) {
      result.push({
        nodeName: deljNode.text,
        inputParameters: deljNode.inputParameters ?? [],
        retryCount: deljNode.retryCount ?? 1,
        retryDelaySeconds: deljNode.retryDelaySeconds ?? 1,
        timeoutMilliseconds: deljNode.timeoutMilliseconds ?? 1000,
        ...(deljNode.url && deljNode.url.trim() !== '' ? { url: deljNode.url.trim() } : {}),
        ...(deljNode.headers && Object.keys(deljNode.headers).length > 0 ? { headers: deljNode.headers } : {})
      });
    }
  }

  return result;
};
