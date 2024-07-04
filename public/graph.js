const markerBoxHeight = 10;
const markerBoxWidth = 10;
const refX = markerBoxHeight / 2;
const refY = markerBoxHeight / 2;
const arrowPoints = [[0, 0], [0, markerBoxWidth], [markerBoxHeight, markerBoxWidth / 2]];
const COLORS = {
  BG: '#85877C',
  PRIMARY: '#E2EF70',
  SECONDARY: '#C1EEFF',
  DARK: '#342E37'
}

const createArrowDef = svg => {
  return svg
    .append('defs')
    .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
      .attr('refX', refX)
      .attr('refY', refY)
      .attr('markerWidth', markerBoxWidth)
      .attr('markerHeight', markerBoxHeight)
      .attr('orient', 'auto-start-reverse')
    .append('path')
      .attr('d', d3.line()(arrowPoints))
      .attr('stroke', 'black');
};

const addDrag = (simulation, node) => {
  // Add a drag behavior.
  node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  // Update the subject (dragged node) position during drag.
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it’s no longer being dragged.
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

function initGraph(data, [w, h]) {
  const width = w;
  const height = h;
  console.log(data);

  const links = data.links.map(d => ({...d}));
  const nodes = data.nodes.map(d => ({...d}));

  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(300))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width/2, height/2))
      .force("y", d3.forceY().y(d => d.height * 300))
      .on("tick", ticked);

  // Create the SVG container.
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .call(d3.zoom().on('zoom', (event) => {
        svg.attr('transform', event.transform);
      }))
      .attr("style", `max-width: 100%; height: auto; background: ${COLORS.BG}`);

  createArrowDef(svg);

  const link = svg.append("g")
    .attr("stroke", COLORS.SECONDARY)
    .attr("stroke-opacity", 0.6)
    .attr("class", "node-link")
    .selectAll()
    .data(links)
    .join("line")
      .attr("marker-end", 'url(#arrow)');

  const nodeGroup = svg.append("g")
    .attr("stroke-width", 1.5);

  const node = nodeGroup.selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .on('mouseenter', (_, hoveredNode) => {
      nodes.forEach(n => {
        if (n.id === hoveredNode.id) n.clicked = true;
        else n.clicked = false
      });

      const targets = new Set();
      links.forEach(d => {
        console.log({d, hoveredNode})
        if (d.source.id === hoveredNode.id || d.target.id === hoveredNode.id) {
          targets.add(d.target.id);
          targets.add(d.source.id);
        }
      })
      
      node.selectAll('rect')
        .attr('class', d => {
          console.log({d, targets})
          if (d.clicked) return 'hovered';
          if (targets.has(d.id)) return 'hovered';
          return 'unhovered';
        })

      link.attr('class',  d => d.source.clicked || d.target.clicked ? 'hovered' : 'unhovered');
      
    })
    .on('mouseleave', () => {
      nodes.forEach(n => n.clicked = false);
      node.selectAll('rect')
        .attr('class', undefined);
      link.attr('class', undefined)
    })

  const rectHeight = 50;
  
  const texts = node.append("text")
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("class", "node-text")
    .text(d => d.id);
  
  node.each(function(d) {
    const textElement = d3.select(this).select('text').node().textContent;
    const svg = document.createElement('svg');
    svg.innerHTML = `
      <g id="text-placeholder">
        ${textElement}
      </g>`;
    svg.id = 'bbox-text-svg'
    document.body.appendChild(svg);
    
    const placeholder = document.querySelector("#text-placeholder");
    const brect = placeholder.getBoundingClientRect();
    svg.remove();
    d.rectWidth = brect.width + 48;  // Add padding to the text width
  });


  simulation.force("collide", d3.forceCollide().radius(d => d.rectWidth / 2).iterations(3))

  const rectangles = node.append('rect')
      .attr("width", d => d.rectWidth)
      .attr("height", rectHeight)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("style", `stroke:${COLORS.SECONDARY};stroke-width:1;`)
      .lower();  // Move rectangles behind the text

  addDrag(simulation, node)
  function ticked() {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => {
          const dx = Math.abs(d.target.x - d.source.x);
          const dy = Math.abs(d.target.y - d.source.y);
          const angle = Math.atan2(dy, dx);
          return d.target.x - (markerBoxWidth * Math.cos(angle));
        })
        .attr("y2", d => {
          const dx = Math.abs(d.target.x - d.source.x);
          const dy = Math.abs(d.target.y - d.source.y);
          const angle = Math.atan2(dy, dx);
          return d.target.y - (markerBoxHeight * Math.sin(angle));
        })

  rectangles
        .attr("x", d => d.x - d.rectWidth / 2)
        .attr("y", d => d.y - rectHeight / 2);

    texts
        .attr('x', d => d.x - d.rectWidth / 2 + 6)
        .attr('y', d => d.y)
        .attr("dx", d => d.rectWidth / 2 - 6)  // Horizontal offset for the text
        .attr("dy", 5);

  }
  graphContainer.append(svg.node());
}
