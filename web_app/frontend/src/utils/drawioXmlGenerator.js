/**
 * drawioXmlGenerator.js
 * Generates standards-compliant Draw.io / diagrams.net (<mxGraphModel>) XML
 * from an HEVC QuadTree structure, matching the user's exact specification.
 *
 * Architecture of Generated Diagram:
 * 1. Top Section: 2D Spatial Partition of CTU 64x64 with dimension markers (64x64),
 *    cross dividers for split blocks, and Z-scan order index labels (0..N-1).
 * 2. Bottom Section: Hierarchical 4-ary QuadTree diagram with orthogonal edge connectors,
 *    depth fill colors (#CCE5FF, #66B2FF, #9999FF), and Z-scan values on leaf nodes.
 */

import { buildQuadtreeTree, computeTreeLayout, getNodeColorTheme } from './quadtreeTreeLayout.js';

/**
 * Escapes special XML characters.
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates Draw.io XML (<mxGraphModel>) from partition nodes or quadtree root.
 *
 * @param {Object} params
 * @param {Object} params.treeRoot Quadtree root node (optional, built if not provided)
 * @param {Array} params.partitionNodes Flat array of partition nodes
 * @param {number} params.ctuX CTU coordinate X
 * @param {number} params.ctuY CTU coordinate Y
 * @param {Object} params.options Customization flags (includeCost, includeMode)
 * @returns {string} XML string
 */
export function generateDrawioXml({
  treeRoot = null,
  partitionNodes = [],
  ctuX = 0,
  ctuY = 0,
  options = {}
} = {}) {
  const root = treeRoot || buildQuadtreeTree(partitionNodes, ctuX * 64, ctuY * 64);
  const { includeCost = false, includeMode = false } = options;

  let cellId = 2; // IDs 0 and 1 are reserved by mxGraph
  const xmlCells = [];

  // =========================================================================
  // 1. GEOMETRY CONFIGURATION
  // =========================================================================
  // Spatial 2D CTU Block on Top
  const spatialBaseX = 140;
  const spatialBaseY = 80;
  const spatialSize = 520; // 520px represents 64x64
  const scale = spatialSize / 64; // 8.125 px per CTU pixel

  // =========================================================================
  // 2. GENERATE TOP 2D SPATIAL PARTITION
  // =========================================================================
  
  // 2.1 Base 64x64 CTU Block
  const spatialRootId = cellId++;
  xmlCells.push(`    <mxCell id="${spatialRootId}" parent="1" style="whiteSpace=wrap;html=1;aspect=fixed;strokeWidth=4;fontSize=43;fillColor=#CCE5FF;" value="" vertex="1"><mxGeometry height="${spatialSize}" width="${spatialSize}" x="${spatialBaseX}" y="${spatialBaseY}" as="geometry"/></mxCell>`);

  // Dimension indicators (width and height arrows)
  const leftArrowId = cellId++;
  xmlCells.push(`    <mxCell id="${leftArrowId}" edge="1" parent="1" style="endArrow=classic;startArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=3.5;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=15;fontColor=default;labelBackgroundColor=default;" value=""><mxGeometry height="50" relative="1" width="50" as="geometry"><mxPoint x="${spatialBaseX - 20}" y="${spatialBaseY + spatialSize}" as="sourcePoint"/><mxPoint x="${spatialBaseX - 20}" y="${spatialBaseY}" as="targetPoint"/></mxGeometry></mxCell>`);

  const topArrowId = cellId++;
  xmlCells.push(`    <mxCell id="${topArrowId}" edge="1" parent="1" style="endArrow=classic;startArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=4;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=15;fontColor=default;labelBackgroundColor=default;" value=""><mxGeometry height="50" relative="1" width="50" as="geometry"><mxPoint x="${spatialBaseX + spatialSize}" y="${spatialBaseY - 24}" as="sourcePoint"/><mxPoint x="${spatialBaseX}" y="${spatialBaseY - 24}" as="targetPoint"/></mxGeometry></mxCell>`);

  const dimLabelHId = cellId++;
  xmlCells.push(`    <mxCell id="${dimLabelHId}" parent="1" style="text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=43;" value="64" vertex="1"><mxGeometry height="30" width="60" x="${spatialBaseX - 120}" y="${spatialBaseY + spatialSize / 2 - 15}" as="geometry"/></mxCell>`);

  const dimLabelWId = cellId++;
  xmlCells.push(`    <mxCell id="${dimLabelWId}" parent="1" style="text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=43;" value="64" vertex="1"><mxGeometry height="30" width="60" x="${spatialBaseX + spatialSize / 2 - 30}" y="${spatialBaseY - 74}" as="geometry"/></mxCell>`);

  // Recursive traversal to add split lines and sub-blocks for the 2D spatial view
  function addSpatialDividers(node) {
    if (!node.children || node.children.length === 0) {
      // Leaf CU: add Z-scan index number text cell
      const cx = spatialBaseX + node.relX * scale + (node.size * scale) / 2 - 20;
      const cy = spatialBaseY + node.relY * scale + (node.size * scale) / 2 - 15;
      const textId = cellId++;

      let label = `${node.zScanIndex}`;
      if (includeMode && node.mode) {
        label += ` (${node.mode})`;
      }
      if (includeCost && node.cost !== null) {
        label += `&#xa;J:${Math.round(node.cost)}`;
      }

      xmlCells.push(`    <mxCell id="${textId}" parent="1" style="text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=43;fontStyle=1;" value="${escapeXml(label)}" vertex="1"><mxGeometry height="30" width="40" x="${Math.round(cx)}" y="${Math.round(cy)}" as="geometry"/></mxCell>`);
      return;
    }

    // Split block: add cross divider connectors
    const px = spatialBaseX + node.relX * scale;
    const py = spatialBaseY + node.relY * scale;
    const pSize = node.size * scale;

    // Sub-block background if depth > 0
    let parentCellRef = spatialRootId;
    if (node.depth > 0) {
      const subBlockId = cellId++;
      parentCellRef = subBlockId;
      const theme = getNodeColorTheme(node.depth, true);
      xmlCells.push(`    <mxCell id="${subBlockId}" parent="1" style="whiteSpace=wrap;html=1;aspect=fixed;strokeWidth=4;fontSize=43;fillColor=${theme.fill};" value="" vertex="1"><mxGeometry height="${Math.round(pSize)}" width="${Math.round(pSize)}" x="${Math.round(px)}" y="${Math.round(py)}" as="geometry"/></mxCell>`);
    }

    // Vertical line
    const vLineId = cellId++;
    xmlCells.push(`    <mxCell id="${vLineId}" edge="1" parent="1" source="${parentCellRef}" style="shape=connector;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;strokeColor=#000000;strokeWidth=4;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=43;fontColor=default;labelBackgroundColor=default;endArrow=none;endFill=0;" target="${parentCellRef}"><mxGeometry relative="1" as="geometry"/></mxCell>`);

    // Horizontal line
    const hLineId = cellId++;
    xmlCells.push(`    <mxCell id="${hLineId}" edge="1" parent="1" source="${parentCellRef}" style="shape=connector;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;strokeColor=#000000;strokeWidth=4;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=43;fontColor=default;labelBackgroundColor=default;endArrow=none;endFill=0;" target="${parentCellRef}"><mxGeometry relative="1" as="geometry"/></mxCell>`);

    // Recursively process 4 quadrants
    node.children.forEach(child => addSpatialDividers(child));
  }

  addSpatialDividers(root);

  // =========================================================================
  // 3. GENERATE BOTTOM TREE HIERARCHY
  // =========================================================================
  // Compute Reingold-Tilford layout coordinates for the tree
  const depthLevelY = {
    0: 80,   // root connects to top
    1: 680,  // 32x32 blocks
    2: 1140, // 16x16 blocks
    3: 1380  // 8x8 blocks
  };
  const depthBlockSize = {
    0: 520,
    1: 260,
    2: 130,
    3: 65
  };

  // Assign cell IDs and mapping for each node
  const treeNodeMap = new Map();
  function registerTreeNodes(node) {
    const id = cellId++;
    treeNodeMap.set(node.id, { cellId: id, node });
    if (node.children) {
      node.children.forEach(child => registerTreeNodes(child));
    }
  }
  registerTreeNodes(root);

  // Compute layout with sizing proportional to Draw.io dimensions
  const treeLayout = computeTreeLayout(root, {
    depthConfig: {
      0: { size: 520, y: 80 },
      1: { size: 260, y: 680 },
      2: { size: 130, y: 1140 },
      3: { size: 65,  y: 1380 }
    },
    siblingGaps: {
      1: 110,
      2: 55,
      3: 32
    }
  });

  // Calculate horizontal scale and offset to align nicely with spatial BaseX
  const treeMinX = Math.min(...treeLayout.nodes.map(n => n.layout.x));
  const treeMaxX = Math.max(...treeLayout.nodes.map(n => n.layout.x + n.layout.size));
  const treeCenter = (treeMinX + treeMaxX) / 2;
  const spatialCenter = spatialBaseX + spatialSize / 2;
  let treeShiftX = spatialCenter - treeCenter;
  if (treeMinX + treeShiftX < 40) {
    treeShiftX = 40 - treeMinX;
  }

  // Render tree vertex cells
  treeLayout.nodes.forEach(node => {
    const mapping = treeNodeMap.get(node.id);
    if (!mapping) return;

    // Use depth-based geometry size matching Draw.io
    const bSize = depthBlockSize[node.depth] || 65;
    const nodeY = depthLevelY[node.depth] || node.layout.y;
    // Align with spatial center
    const nodeX = node.layout.x + treeShiftX;

    const theme = getNodeColorTheme(node.depth, node.isSplit);

    let val = '';
    if (!node.isSplit && node.zScanIndex !== null) {
      val = `${node.zScanIndex}`;
      if (includeCost && node.cost !== null) {
        val += `&#xa;J:${Math.round(node.cost)}`;
      }
    }

    mapping.x = Math.round(nodeX);
    mapping.y = Math.round(nodeY);
    mapping.size = Math.round(bSize);

    // Skip root vertex in tree since root is the spatial 64x64 block (matching user XML!)
    if (node.depth === 0) {
      mapping.cellId = spatialRootId;
      return;
    }

    xmlCells.push(`    <mxCell id="${mapping.cellId}" parent="1" style="whiteSpace=wrap;html=1;aspect=fixed;strokeWidth=4;fontSize=43;fillColor=${theme.fill};" value="${escapeXml(val)}" vertex="1"><mxGeometry height="${Math.round(bSize)}" width="${Math.round(bSize)}" x="${Math.round(nodeX)}" y="${Math.round(nodeY)}" as="geometry"/></mxCell>`);
  });

  // Render tree orthogonal edge connectors
  treeLayout.edges.forEach(edge => {
    const parentMap = treeNodeMap.get(edge.sourceId);
    const childMap = treeNodeMap.get(edge.targetId);
    if (!parentMap || !childMap) return;

    const edgeCellId = cellId++;
    xmlCells.push(`    <mxCell id="${edgeCellId}" edge="1" parent="1" source="${parentMap.cellId}" style="edgeStyle=orthogonalEdgeStyle;shape=connector;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeColor=#000000;strokeWidth=4;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=43;fontColor=default;labelBackgroundColor=default;endArrow=none;endFill=0;" target="${childMap.cellId}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });

  // =========================================================================
  // 4. CONSTRUCT COMPLETE XML DOCUMENT
  // =========================================================================
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>\n${xmlCells.join('\n')}\n</root></mxGraphModel>`;
}

/**
 * Copies text to clipboard with fallback.
 */
export async function copyXmlToClipboard(xmlText) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(xmlText);
    return true;
  }
  // Fallback
  const textArea = document.createElement('textarea');
  textArea.value = xmlText;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const successful = document.execCommand('copy');
  document.body.removeChild(textArea);
  return successful;
}

/**
 * Triggers a browser download of the XML as a .drawio file.
 */
export function downloadDrawioFile(xmlText, filename = 'hevc_ctu_quadtree.drawio') {
  const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.drawio') ? filename : `${filename}.drawio`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
