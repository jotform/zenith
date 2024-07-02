const markerBoxHeight = 10;
const markerBoxWidth = 10;
const refX = markerBoxHeight / 2;
const refY = markerBoxHeight / 2;
const arrowPoints = [[0, 0], [0, markerBoxWidth], [markerBoxHeight, markerBoxWidth / 2]];

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

function initGraph(data) {
  const width = 2000;
  const height = 2000;
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  console.log(data);

  const links = data.links.map(d => ({...d}));
  const nodes = data.nodes.map(d => ({...d}));

  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(50))
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
      .attr("style", "max-width: 100%; height: auto;");

  createArrowDef(svg);
  // Add a line for each link, and a circle for each node.
  const link = svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll()
    .data(links)
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("marker-end", 'url(#arrow)');

  const nodeGroup = svg.append("g")
    .attr("stroke-width", 1.5);

  const node = nodeGroup.selectAll('g')
    .data(nodes)
    .join('g')
    .on('click', (_, clickedNode) => {
      nodes.forEach(n => {
        if (n.id === clickedNode.id) n.clicked = true;
        else n.clicked = false
      });
      
      node.selectAll('circle')
        .attr('fill', d => {console.log(d); return color(d.clicked ? 2 : 1)})

        console.log(link.selectAll('g'))
      link.selectAll('g')
        .attr('stroke-opacity', d => {console.log(d); return d.source.clicked || d.target.clicked ? 1 : 0.6});
    });

  const circles = node.append('circle')
      .attr("r", 5)
      .attr("fill", d => color(d.group));

  const texts = node.append("text")
    .attr("dx", 12)  // Horizontal offset for the text
    .attr("dy", ".35em")  // Vertical offset for the text
    .text(d => d.id);

  // Add a drag behavior.
  node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  console.log(nodes);
  // Set the position attributes of links and nodes each time the simulation ticks.
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

    circles
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    texts
        .attr('x', d => d.x)
        .attr('y', d => d.y);

  }

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
  graphContainer.append(svg.node());
}
