const nodeIDGetter = (nodes) => nodes.map(node => node.id);
const isLinkHasNode = (link, node) => link.target === node.id || link.source === node.id;
const sanitizeLinks = (nodeIDs, links) => links.filter(link => nodeIDs.includes(link.target) && nodeIDs.includes(link.source));

const workspaceFilter = (data, filterVal) => {
  const wsFilters = filterVal.split(',').map(f => f.trim());
  const nodes = data.nodes.filter(node => wsFilters.every(f => !node.path.includes(f)));
  return {
    nodes,
    links: sanitizeLinks(nodeIDGetter(nodes), data.links)
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
    links: sanitizeLinks(nodeIDGetter(nodes), data.links)
  };
}

const FILTERS = {
  'workspace-filter': { 
    filterFN: workspaceFilter,
    remove: (filter) => {
      const params = new URLSearchParams(window.location.search);
      const workspaceFilterRaw = params.get('workspace-filter');
      const workspaceFilters = workspaceFilterRaw ? workspaceFilterRaw.split(',').map(element => element.trim()) : [];
      const newFilters = workspaceFilters.filter(f => f !== filter);
      params.set('workspace-filter', newFilters.join(','));
      window.location.search = params.toString();
    }
  },
  'singular-filter': {
    filterFN: singularFilter
  }
};

function initFilters(data) {
  let filteredData = {...data};
  const params = new URLSearchParams(window.location.search);
  Object.entries(FILTERS).forEach(([name, {filterFN}]) => {
    const filterVal = params.get(name);
    if (!filterVal) return;
    
    const input = document.querySelector(`[name="${name}"`);
    if (input.type === 'checkbox') {
      input.checked = true;
    } else {
      input.value = filterVal;
    }
    filteredData = filterFN(filteredData, filterVal);
  })
  return filteredData;
}

function displayCurrentFilters() {
  const params = new URLSearchParams(window.location.search);
  const workspaceFilterRaw = params.get('workspace-filter');
  const workspaceFilters = workspaceFilterRaw ? workspaceFilterRaw.split(',').map(element => element.trim()) : [];
  const filterDisplay = document.getElementById('current-filters');
  filterDisplay.innerHTML = '';

  if (workspaceFilters.length) {
    workspaceFilters.forEach(filter => {
      const filterElement = document.createElement('div');
      filterElement.className = 'filter-item';
      filterElement.innerHTML = `
        <span>${filter}</span>
        <button onclick="FILTERS["workspace-filter"].remove('${filter}')">x</button>
      `;
      filterDisplay.appendChild(filterElement);
    });
  } else {
    filterDisplay.innerHTML = 'No filters applied';
  }
}

function removeFilter(filter) {
  
}
