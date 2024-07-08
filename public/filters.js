const nodesToIDs = (nodes) => nodes.map(node => node.id);
const isLinkHasNode = (link, node) => link.target === node.id || link.source === node.id;
const sanitizeLinks = (nodeIDs, links) => links.filter(link => nodeIDs.includes(link.target) && nodeIDs.includes(link.source));

const includeFilter = (node, filters) => filters.some(f => node.path.includes(f));
const excludeFilter = (node, filters) => filters.every(f => !node.path.includes(f));

const workspaceFilter = (data, filterVal) => {
  const wsFilters = filterVal.split(',').map(f => f.trim());
  const nodes = data.nodes.filter(node => excludeFilter(node, wsFilters));
  return {
    nodes,
    links: sanitizeLinks(nodesToIDs(nodes), data.links)
  };
}

const singularFilter = (data, filterVal) => {
  const sFilter = filterVal === 'on';
  const nodes = data.nodes.filter(node => {
    const isSingular = data.links.filter(link => isLinkHasNode(link, node)).length === 0
    if (isSingular) console.log(node)
    return sFilter ? isSingular : !isSingular
  })

  return {
    nodes,
    links: sanitizeLinks(nodesToIDs(nodes), data.links)
  };
}

const includeWorkspacesFilter = (data, filterVal) => {
  const wsIncludes = filterVal.split(',').map(f => f.trim());
  const nodes = data.nodes.filter(node => includeFilter(node, wsIncludes));
  return {
    nodes,
    links: sanitizeLinks(nodesToIDs(nodes), data.links)
  };
}

const FILTERS = {
  'exclude-workspaces': {
    type: 'text',
    filterFN: workspaceFilter,
    remove: (filter) => {
      const params = new URLSearchParams(window.location.search);
      const workspaceFilterRaw = params.get('exclude-workspaces');
      const workspaceFilters = workspaceFilterRaw ? workspaceFilterRaw.split(',').map(element => element.trim()) : [];
      const newFilters = workspaceFilters.filter(f => f !== filter);
      params.set('exclude-workspaces', newFilters.join(','));
      window.location.search = params.toString();
    }
  },
  'include-workspaces': {
    type: 'text',
    filterFN: includeWorkspacesFilter
  },
  'singular-filter': {
    type: 'bool',
    filterFN: singularFilter
  },
};

function initFilters(data) {
  let filteredData = {...data};
  const params = new URLSearchParams(window.location.search);
  Object.entries(FILTERS).forEach(([name, {filterFN, type}]) => {
    const filterVal = params.get(name);
    if (!filterVal) return;
    
    const input = document.querySelector(`[name="${name}"`);
    if (type === 'bool') {
      input.checked = true;
    } else {
      input.value = filterVal;
    }
    filteredData = filterFN(filteredData, filterVal);
  })
  return filteredData;
}
