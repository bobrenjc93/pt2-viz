/**
 * PT2 Compiler Visualization Tool
 * Interactive D3.js visualization for PT2 compiler phases and nodes
 * 
 * Features:
 * - Vertical node layout within phases based on topological sorting
 * - Horizontal phase layout for comparing transformations
 * - Loading indicators and smooth animations
 * - Hidden sidebar with slide-in/out animations
 * - Edge toggle functionality
 * - Enhanced node positioning algorithm
 */

class PT2Visualizer {
    constructor() {
        this.data = [];
        this.phases = new Map();
        this.visiblePhases = new Set();
        this.selectedNodeId = null;
        this.highlightedNodeId = null;
        this.edgesVisible = true;
        
        // Configuration
        this.config = {
            nodeRadius: 25,
            nodeSpacing: 350,  // Horizontal spacing between phases
            levelSpacing: 100, // Vertical spacing between dependency levels
            phaseWidth: 250,   // Width of each phase column
            phaseMinHeight: 400, // Minimum height for phase columns
            margin: { top: 50, right: 100, bottom: 50, left: 100 },
            colors: [
                '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
                '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
            ]
        };
        
        try {
            this.initializeElements();
            this.setupEventListeners();
            this.initializeSVG();
        } catch (error) {
            console.error('Error initializing PT2Visualizer:', error);
            this.showError(`Initialization failed: ${error.message}`);
        }
    }
    
    initializeElements() {
        this.jsonInput = document.getElementById('jsonInput');
        this.parseButton = document.getElementById('parseButton');
        this.phaseButtonsContainer = document.getElementById('phaseButtons');
        this.svg = d3.select('#visualization');
        this.metadataContent = document.getElementById('metadataContent');
        this.metadataPanel = document.getElementById('metadataPanel');
        this.closeSidebar = document.getElementById('closeSidebar');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.showEdgesCheckbox = document.getElementById('showEdges');
        
        // Validate that all required elements exist
        const requiredElements = [
            { element: this.jsonInput, name: 'jsonInput' },
            { element: this.parseButton, name: 'parseButton' },
            { element: this.phaseButtonsContainer, name: 'phaseButtons' },
            { element: this.metadataContent, name: 'metadataContent' },
            { element: this.metadataPanel, name: 'metadataPanel' },
            { element: this.closeSidebar, name: 'closeSidebar' },
            { element: this.loadingIndicator, name: 'loadingIndicator' },
            { element: this.showEdgesCheckbox, name: 'showEdges' }
        ];
        
        for (const { element, name } of requiredElements) {
            if (!element) {
                throw new Error(`Required element with id "${name}" not found`);
            }
        }
        
        if (this.svg.empty()) {
            throw new Error('Required element with id "visualization" not found');
        }
        
        // Initialize loading indicator as hidden
        this.hideLoading();
    }
    
    setupEventListeners() {
        // Parse button and keyboard shortcut
        if (this.parseButton) {
            this.parseButton.addEventListener('click', () => this.parseAndVisualize());
        }
        
        if (this.jsonInput) {
            this.jsonInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.parseAndVisualize();
                }
            });
        }
        
        // Sidebar close button
        if (this.closeSidebar) {
            this.closeSidebar.addEventListener('click', () => this.hideSidebar());
        }
        
        // Edge toggle checkbox
        if (this.showEdgesCheckbox) {
            this.showEdgesCheckbox.addEventListener('change', (e) => {
                this.edgesVisible = e.target.checked;
                this.toggleEdgeVisibility();
            });
        }
        
        // Click outside to close sidebar
        document.addEventListener('click', (e) => {
            if (!this.metadataPanel.contains(e.target) && 
                !e.target.closest('.node') && 
                !this.metadataPanel.classList.contains('hidden')) {
                this.hideSidebar();
            }
        });
    }
    
    initializeSVG() {
        this.svg.selectAll('*').remove();
        
        // Get container dimensions
        const container = document.querySelector('.vis-container');
        if (!container) {
            throw new Error('Required element with class "vis-container" not found');
        }
        this.width = container.clientWidth || 800; // Fallback width
        this.height = container.clientHeight || 600; // Fallback height
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
            
        // Add SVG definitions for arrowheads
        const defs = this.svg.append('defs');
        
        // Default arrowhead marker
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('class', 'arrowhead');
        
        // Highlighted arrowhead marker
        defs.append('marker')
            .attr('id', 'arrowhead-highlighted')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('class', 'arrowhead-highlighted');
        
        // Create main group for zooming/panning
        this.mainGroup = this.svg.append('g')
            .attr('class', 'main-group');
            
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                this.mainGroup.attr('transform', event.transform);
            });
            
        this.svg.call(zoom);
        
        // Add reset zoom on double-click
        this.svg.on('dblclick.zoom', () => {
            this.svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity
            );
        });
    }
    
    async parseAndVisualize() {
        try {
            const jsonText = this.jsonInput.value.trim();
            if (!jsonText) {
                this.showError('Please enter JSON data');
                return;
            }
            
            // Show loading indicator
            this.showLoading();
            
            // Small delay to allow UI to update
            await this.delay(10);
            
            try {
                await this.processVisualization(jsonText);
                this.hideLoading();
            } catch (error) {
                this.hideLoading();
                this.showError(`Parse error: ${error.message}`);
            }
            
        } catch (error) {
            this.hideLoading();
            this.showError(`Parse error: ${error.message}`);
        }
    }
    
    async processVisualization(jsonText) {
        this.updateLoadingProgress('Parsing JSON input...');
        await this.delay(50);
        
        // Parse JSON input
        this.data = this.parseJSONInput(jsonText);
        
        this.updateLoadingProgress(`Processing ${this.data.length} nodes...`);
        await this.delay(50);
        
        // Process data and calculate layouts
        this.processData();
        
        this.updateLoadingProgress(`Creating ${this.phases.size} phase controls...`);
        await this.delay(50);
        
        // Create phase buttons
        this.createPhaseButtons();
        
        this.updateLoadingProgress('Rendering visualization...');
        await this.delay(50);
        
        // Use requestAnimationFrame for smooth rendering
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                try {
                    this.renderVisualization();
                    this.updateLoadingProgress('Complete!');
                    resolve();
                } catch (error) {
                    console.error('Error rendering visualization:', error);
                    resolve(); // Still resolve to hide loading
                }
            });
        });
    }
    
    updateLoadingProgress(message) {
        const loadingText = this.loadingIndicator?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        console.log('Loading progress:', message);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    parseJSONInput(jsonText) {
        const lines = jsonText.split('\n').filter(line => line.trim());
        const parsedData = [];
        
        if (lines.length === 0) {
            throw new Error('No input data provided');
        }
        
        for (let i = 0; i < lines.length; i++) {
            try {
                const line = lines[i].trim();
                if (!line) continue;
                
                const obj = JSON.parse(line);
                
                // Validate required fields
                if (!obj.phase) {
                    throw new Error(`Missing required field 'phase'`);
                }
                if (!obj.id) {
                    throw new Error(`Missing required field 'id'`);
                }
                
                // Validate data types
                if (typeof obj.phase !== 'string' && typeof obj.phase !== 'number') {
                    throw new Error(`Field 'phase' must be a string or number`);
                }
                if (typeof obj.id !== 'string' && typeof obj.id !== 'number') {
                    throw new Error(`Field 'id' must be a string or number`);
                }
                
                parsedData.push({
                    phase: String(obj.phase),
                    id: String(obj.id),
                    metadata: obj.metadata || {},
                    edges: Array.isArray(obj.edges) ? obj.edges.map(String) : [],
                    originalLine: i + 1
                });
                
            } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                    throw new Error(`Line ${i + 1}: Invalid JSON syntax - ${parseError.message}`);
                } else {
                    throw new Error(`Line ${i + 1}: ${parseError.message}`);
                }
            }
        }
        
        if (parsedData.length === 0) {
            throw new Error('No valid JSON objects found');
        }
        
        return parsedData;
    }
    
    processData() {
        this.phases.clear();
        
        // Group data by phase
        this.data.forEach(item => {
            if (!this.phases.has(item.phase)) {
                this.phases.set(item.phase, []);
            }
            this.phases.get(item.phase).push(item);
        });
        
        // Calculate vertical layout for each phase using topological sorting
        this.phases.forEach((nodes, phaseName) => {
            this.calculateVerticalLayout(nodes);
        });
        
        // Initialize all phases as visible
        this.visiblePhases = new Set(this.phases.keys());
    }
    
    /**
     * Calculate vertical layout for nodes within a phase using topological sorting
     * Nodes with no incoming edges go at the top, then their dependents below them
     */
    calculateVerticalLayout(nodes) {
        if (!nodes || nodes.length === 0) return;
        
        // Create maps for faster lookup
        const nodeMap = new Map();
        const incomingEdges = new Map();
        const outgoingEdges = new Map();
        
        // Initialize data structures
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
            incomingEdges.set(node.id, new Set());
            outgoingEdges.set(node.id, new Set());
        });
        
        // Build edge relationships within this phase
        nodes.forEach(node => {
            if (node.edges && Array.isArray(node.edges)) {
                node.edges.forEach(targetId => {
                    // Only consider edges to nodes within the same phase
                    if (nodeMap.has(targetId)) {
                        outgoingEdges.get(node.id).add(targetId);
                        incomingEdges.get(targetId).add(node.id);
                    }
                });
            }
        });
        
        // Perform topological sorting to determine levels
        const levels = [];
        const processed = new Set();
        const queue = [];
        
        // Find nodes with no incoming edges (level 0)
        nodes.forEach(node => {
            if (incomingEdges.get(node.id).size === 0) {
                queue.push({ node, level: 0 });
            }
        });
        
        // If no nodes without incoming edges, start with all nodes at level 0
        if (queue.length === 0) {
            nodes.forEach(node => {
                queue.push({ node, level: 0 });
            });
        }
        
        // Process nodes level by level
        while (queue.length > 0) {
            const { node, level } = queue.shift();
            
            if (processed.has(node.id)) continue;
            processed.add(node.id);
            
            // Ensure levels array is large enough
            while (levels.length <= level) {
                levels.push([]);
            }
            
            // Add node to its level
            levels[level].push(node);
            
            // Process outgoing edges
            outgoingEdges.get(node.id).forEach(targetId => {
                if (!processed.has(targetId)) {
                    const targetNode = nodeMap.get(targetId);
                    // Calculate the minimum level for the target node
                    let minLevel = level + 1;
                    
                    // Check if all incoming edges to target have been processed
                    const targetIncoming = incomingEdges.get(targetId);
                    let allIncomingProcessed = true;
                    for (const incomingId of targetIncoming) {
                        if (!processed.has(incomingId)) {
                            allIncomingProcessed = false;
                            break;
                        }
                    }
                    
                    if (allIncomingProcessed) {
                        queue.push({ node: targetNode, level: minLevel });
                    }
                }
            });
        }
        
        // Add any unprocessed nodes to the last level
        const unprocessed = nodes.filter(node => !processed.has(node.id));
        if (unprocessed.length > 0) {
            if (levels.length === 0) levels.push([]);
            levels[levels.length - 1].push(...unprocessed);
        }
        
        // Assign level and position information to nodes
        levels.forEach((levelNodes, levelIndex) => {
            levelNodes.forEach((node, nodeIndex) => {
                node._layout = {
                    level: levelIndex,
                    positionInLevel: nodeIndex,
                    totalInLevel: levelNodes.length
                };
            });
        });
        
        // Store level information for the phase
        const phaseIndex = Array.from(this.phases.keys()).indexOf(nodes[0].phase);
        this.phases.get(nodes[0].phase)._levels = levels;
        this.phases.get(nodes[0].phase)._maxLevel = levels.length - 1;
    }
    
    createPhaseButtons() {
        this.phaseButtonsContainer.innerHTML = '';
        
        const phaseNames = Array.from(this.phases.keys()).sort();
        
        phaseNames.forEach((phaseName, index) => {
            const button = document.createElement('button');
            button.className = 'phase-button active';
            button.textContent = phaseName;
            const phaseColor = this.config.colors[index % this.config.colors.length];
            button.style.borderColor = phaseColor;
            button.style.backgroundColor = phaseColor;
            button.style.color = 'white';
            
            button.addEventListener('click', () => {
                this.togglePhase(phaseName, button);
            });
            
            this.phaseButtonsContainer.appendChild(button);
        });
    }
    
    togglePhase(phaseName, button) {
        if (this.visiblePhases.has(phaseName)) {
            this.visiblePhases.delete(phaseName);
            button.classList.remove('active');
            button.style.backgroundColor = 'white';
            button.style.color = button.style.borderColor;
        } else {
            this.visiblePhases.add(phaseName);
            button.classList.add('active');
            button.style.backgroundColor = button.style.borderColor;
            button.style.color = 'white';
        }
        
        this.updateVisualization();
    }
    
    renderVisualization() {
        this.mainGroup.selectAll('*').remove();
        
        const phaseNames = Array.from(this.phases.keys()).sort();
        
        // Calculate total dimensions based on vertical layout
        let maxPhaseHeight = 0;
        phaseNames.forEach(phaseName => {
            const phaseData = this.phases.get(phaseName);
            const levels = phaseData._levels || [[]];
            const phaseHeight = Math.max(levels.length * this.config.levelSpacing, this.config.phaseMinHeight);
            maxPhaseHeight = Math.max(maxPhaseHeight, phaseHeight);
        });
        
        const totalWidth = phaseNames.length * this.config.nodeSpacing + this.config.margin.left + this.config.margin.right;
        const totalHeight = maxPhaseHeight + this.config.margin.top + this.config.margin.bottom;
        
        // Update SVG dimensions
        this.svg.attr('width', Math.max(totalWidth, 800))
                .attr('height', Math.max(totalHeight, 600));
        
        phaseNames.forEach((phaseName, phaseIndex) => {
            const phaseNodes = this.phases.get(phaseName);
            const phaseColor = this.config.colors[phaseIndex % this.config.colors.length];
            const levels = phaseNodes._levels || [[]];
            
            // Calculate phase position (horizontal layout of phases)
            const phaseX = this.config.margin.left + phaseIndex * this.config.nodeSpacing;
            const phaseStartY = this.config.margin.top;
            const phaseHeight = Math.max(levels.length * this.config.levelSpacing, this.config.phaseMinHeight);
            
            // Create phase group
            const phaseGroup = this.mainGroup.append('g')
                .attr('class', 'phase-group')
                .attr('data-phase', phaseName);
            
            // Add phase background
            phaseGroup.append('rect')
                .attr('class', 'phase-background')
                .attr('x', phaseX - this.config.phaseWidth / 2 - 20)
                .attr('y', phaseStartY - 30)
                .attr('width', this.config.phaseWidth + 40)
                .attr('height', phaseHeight + 60)
                .attr('fill', phaseColor)
                .attr('fill-opacity', 0.05)
                .attr('stroke', phaseColor)
                .attr('stroke-width', 2)
                .attr('rx', 12);
            
            // Add phase separator line (except for first phase)
            if (phaseIndex > 0) {
                phaseGroup.append('line')
                    .attr('class', 'phase-separator')
                    .attr('x1', phaseX - this.config.nodeSpacing / 2)
                    .attr('y1', phaseStartY - 50)
                    .attr('x2', phaseX - this.config.nodeSpacing / 2)
                    .attr('y2', phaseStartY + phaseHeight + 50)
                    .attr('stroke', '#95a5a6')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '8,4')
                    .attr('opacity', 0.7);
            }
            
            // Add phase label
            phaseGroup.append('text')
                .attr('class', 'phase-label')
                .attr('x', phaseX)
                .attr('y', phaseStartY - 5)
                .attr('text-anchor', 'middle')
                .attr('fill', '#2c3e50')
                .attr('font-size', '16px')
                .attr('font-weight', 'bold')
                .text(phaseName);
            
            // Create edges group (rendered before nodes)
            const edgesGroup = phaseGroup.append('g')
                .attr('class', 'edges-group');
            
            // Position nodes within phase using vertical layout
            levels.forEach((levelNodes, levelIndex) => {
                const levelY = phaseStartY + levelIndex * this.config.levelSpacing + 50;
                
                levelNodes.forEach((node, nodeIndex) => {
                    // Calculate horizontal position within the level
                    const levelWidth = this.config.phaseWidth - 100; // Leave some margin
                    const nodeSpacing = levelNodes.length > 1 ? levelWidth / (levelNodes.length - 1) : 0;
                    const nodeX = levelNodes.length === 1 ? 
                        phaseX : 
                        phaseX - levelWidth / 2 + nodeIndex * nodeSpacing;
                    
                    const nodeGroup = phaseGroup.append('g')
                        .attr('class', 'node')
                        .attr('data-id', node.id)
                        .attr('data-level', levelIndex)
                        .attr('transform', `translate(${nodeX}, ${levelY})`)
                        .style('cursor', 'pointer');
                    
                    // Store position for edge calculations
                    node._position = { x: nodeX, y: levelY };
                    
                    // Add node circle
                    nodeGroup.append('circle')
                        .attr('r', this.config.nodeRadius)
                        .attr('fill', phaseColor)
                        .attr('fill-opacity', 0.8)
                        .attr('stroke', '#333')
                        .attr('stroke-width', 2);
                    
                    // Add node label with better text wrapping
                    const labelText = this.truncateText(node.id, 12);
                    nodeGroup.append('text')
                        .attr('y', 4)
                        .attr('fill', 'white')
                        .attr('font-weight', 'bold')
                        .attr('font-size', '12px')
                        .attr('text-anchor', 'middle')
                        .attr('stroke', 'rgba(0,0,0,0.3)')
                        .attr('stroke-width', '0.5')
                        .text(labelText);
                    
                    // Add level indicator (small text above node)
                    if (levels.length > 1) {
                        nodeGroup.append('text')
                            .attr('y', -this.config.nodeRadius - 8)
                            .attr('fill', '#2c3e50')
                            .attr('font-size', '11px')
                            .attr('font-weight', 'bold')
                            .attr('text-anchor', 'middle')
                            .text(`L${levelIndex}`);
                    }
                    
                    // Add hover and click events
                    nodeGroup
                        .on('mouseenter', () => this.onNodeHover(node, nodeGroup))
                        .on('mouseleave', () => this.onNodeLeave(node, nodeGroup))
                        .on('click', (event) => this.onNodeClick(node, nodeGroup, event));
                });
            });
            
            // Render edges within the phase
            this.renderEdgesForPhase(phaseGroup, phaseNodes, phaseColor);
        });
        
        this.updateVisualization();
    }
    
    renderEdgesForPhase(phaseGroup, phaseNodes, phaseColor) {
        if (!phaseGroup || !phaseNodes || !Array.isArray(phaseNodes)) {
            console.warn('renderEdgesForPhase called with invalid parameters');
            return;
        }
        
        const edgesGroup = phaseGroup.select('.edges-group');
        if (edgesGroup.empty()) {
            console.warn('edges-group not found in phase group');
            return;
        }
        
        // Create a map of node ID to node for quick lookup
        const nodeMap = new Map();
        phaseNodes.forEach(node => {
            if (node && node.id) {
                nodeMap.set(node.id, node);
            }
        });
        
        // Render edges for each node
        phaseNodes.forEach(sourceNode => {
            if (!sourceNode || !sourceNode.id || !sourceNode.edges || sourceNode.edges.length === 0) {
                return;
            }
            
            if (!sourceNode._position) {
                console.warn('Source node missing position data:', sourceNode.id);
                return;
            }
            
            sourceNode.edges.forEach(targetId => {
                if (typeof targetId !== 'string' && typeof targetId !== 'number') {
                    console.warn('Invalid target ID type:', typeof targetId);
                    return;
                }
                
                const targetNode = nodeMap.get(String(targetId));
                if (!targetNode) {
                    // Target node not found in this phase - skip this edge
                    return;
                }
                
                if (!targetNode._position) {
                    console.warn('Target node missing position data:', targetId);
                    return;
                }
                
                const edgeCoords = this.calculateEdgeCoordinates(
                    sourceNode, 
                    targetNode, 
                    sourceNode._position, 
                    targetNode._position
                );
                
                if (!edgeCoords) return; // Skip invalid edges
                
                try {
                    // Create curved edge path for better visual appeal
                    const path = this.createCurvedPath(edgeCoords, sourceNode._position, targetNode._position);
                    
                    // Create edge path
                    edgesGroup.append('path')
                        .attr('class', 'edge')
                        .attr('data-source', sourceNode.id)
                        .attr('data-target', targetId)
                        .attr('d', path)
                        .attr('stroke', phaseColor)
                        .attr('stroke-width', 2)
                        .attr('stroke-opacity', 0.6)
                        .attr('fill', 'none')
                        .attr('marker-end', 'url(#arrowhead)')
                        .style('pointer-events', 'none') // Edges don't respond to mouse events
                        .style('display', this.edgesVisible ? 'block' : 'none');
                } catch (error) {
                    console.error('Error creating edge path:', error);
                }
            });
        });
    }
    
    /**
     * Create a curved path for edges to improve visual appeal
     */
    createCurvedPath(edgeCoords, sourcePos, targetPos) {
        const { x1, y1, x2, y2 } = edgeCoords;
        
        // If nodes are on the same level (same Y), use straight line
        if (Math.abs(y1 - y2) < 10) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        
        // Create a smooth curve for vertical connections
        const midY = (y1 + y2) / 2;
        const controlPoint1X = x1;
        const controlPoint1Y = midY;
        const controlPoint2X = x2;
        const controlPoint2Y = midY;
        
        return `M ${x1} ${y1} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${x2} ${y2}`;
    }
    
    updateVisualization() {
        const visiblePhases = this.visiblePhases;
        this.mainGroup.selectAll('.phase-group')
            .style('display', function() {
                const element = d3.select(this);
                const phaseName = element.attr('data-phase');
                return visiblePhases.has(phaseName) ? 'block' : 'none';
            });
    }
    
    onNodeHover(node, nodeGroup) {
        if (this.highlightedNodeId !== node.id) {
            nodeGroup.select('circle')
                .transition()
                .duration(200)
                .attr('fill-opacity', 1)
                .attr('r', this.config.nodeRadius + 3);
        }
    }
    
    onNodeLeave(node, nodeGroup) {
        if (this.highlightedNodeId !== node.id && this.selectedNodeId !== node.id) {
            nodeGroup.select('circle')
                .transition()
                .duration(200)
                .attr('fill-opacity', 0.8)
                .attr('r', this.config.nodeRadius);
        }
    }
    
    onNodeClick(node, nodeGroup, event) {
        event.stopPropagation();
        
        // Update selected node
        this.selectedNodeId = node.id;
        
        // Clear previous selections
        this.mainGroup.selectAll('.node')
            .classed('selected', false)
            .classed('highlighted', false);
        
        // Clear previous edge highlighting
        this.mainGroup.selectAll('.edge')
            .classed('highlighted', false)
            .attr('marker-end', 'url(#arrowhead)');
        
        // Highlight all nodes with the same ID
        this.highlightedNodeId = node.id;
        this.mainGroup.selectAll(`.node[data-id="${node.id}"]`)
            .classed('highlighted', true);
        
        // Highlight connected edges
        try {
            this.mainGroup.selectAll('.edge')
                .filter(function() {
                    try {
                        const edge = d3.select(this);
                        const source = edge.attr('data-source');
                        const target = edge.attr('data-target');
                        return source === node.id || target === node.id;
                    } catch (error) {
                        console.warn('Error filtering edge:', error);
                        return false;
                    }
                })
                .classed('highlighted', true)
                .attr('marker-end', 'url(#arrowhead-highlighted)');
        } catch (error) {
            console.error('Error highlighting edges:', error);
        }
        
        // Mark clicked node as selected
        nodeGroup.classed('selected', true);
        
        // Show sidebar and update metadata display
        this.showSidebar();
        this.displayMetadata(node);
        
        // Animate selection
        this.animateNodeSelection(nodeGroup);
    }
    
    animateNodeSelection(nodeGroup) {
        nodeGroup.select('circle')
            .transition()
            .duration(300)
            .attr('r', this.config.nodeRadius + 5)
            .transition()
            .duration(200)
            .attr('r', this.config.nodeRadius);
    }
    
    displayMetadata(node) {
        if (!this.metadataContent) {
            console.warn('Cannot display metadata: metadataContent element not found');
            return;
        }
        
        // Enhanced metadata display with better formatting
        const edgesList = node.edges && node.edges.length > 0 ? 
            node.edges.map(edge => `<span class="edge-item">${edge}</span>`).join(', ') : 
            '<em>No outgoing edges</em>';
        
        const levelInfo = node._layout ? 
            `<div class="metadata-item">
                <strong>Dependency Level:</strong> ${node._layout.level}
                <br>
                <strong>Position in Level:</strong> ${node._layout.positionInLevel + 1} of ${node._layout.totalInLevel}
            </div>` : '';
        
        const metadataHTML = `
<div class="metadata-header">
    <div class="metadata-item">
        <strong>Node ID:</strong> <code>${node.id || 'Unknown'}</code>
    </div>
    <div class="metadata-item">
        <strong>Phase:</strong> <span class="phase-badge">${node.phase || 'Unknown'}</span>
    </div>
    <div class="metadata-item">
        <strong>Source Line:</strong> ${node.originalLine || 'Unknown'}
    </div>
    ${levelInfo}
</div>

<div class="metadata-body">
    <div class="metadata-item">
        <strong>Outgoing Edges:</strong>
        <div class="edges-list">${edgesList}</div>
    </div>
    
    <div class="metadata-item">
        <strong>Metadata:</strong>
        <div class="metadata-json">${this.formatMetadata(node.metadata)}</div>
    </div>
</div>
        `.trim();
        
        this.metadataContent.innerHTML = metadataHTML;
    }
    
    formatMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return '<em class="no-metadata">No metadata available</em>';
        }
        
        try {
            return `<pre class="json-content">${JSON.stringify(metadata, null, 2)}</pre>`;
        } catch (error) {
            console.error('Error formatting metadata:', error);
            return '<em class="error-metadata">Error formatting metadata</em>';
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }
    
    // Utility method to calculate edge coordinates
    calculateEdgeCoordinates(sourceNode, targetNode, sourcePos, targetPos) {
        // Validate inputs
        if (!sourceNode || !targetNode || !sourcePos || !targetPos) {
            console.warn('calculateEdgeCoordinates called with invalid parameters');
            return null;
        }
        
        if (typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
            typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
            console.warn('calculateEdgeCoordinates called with invalid position coordinates');
            return null;
        }
        
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return null; // Same position
        
        // Normalize direction vector
        const nx = dx / distance;
        const ny = dy / distance;
        
        // Validate normalized vectors
        if (!isFinite(nx) || !isFinite(ny)) {
            console.warn('Invalid normalized direction vectors');
            return null;
        }
        
        // Adjust start and end points to be at circle edges
        const startX = sourcePos.x + nx * this.config.nodeRadius;
        const startY = sourcePos.y + ny * this.config.nodeRadius;
        const endX = targetPos.x - nx * this.config.nodeRadius;
        const endY = targetPos.y - ny * this.config.nodeRadius;
        
        return {
            x1: startX,
            y1: startY,
            x2: endX,
            y2: endY
        };
    }
    
    // Utility method to get node position from DOM
    getNodePosition(nodeGroup) {
        if (!nodeGroup || nodeGroup.empty()) {
            console.warn('getNodePosition called with invalid nodeGroup');
            return { x: 0, y: 0 };
        }
        
        const transform = nodeGroup.attr('transform');
        if (!transform) {
            console.warn('Node group has no transform attribute');
            return { x: 0, y: 0 };
        }
        
        const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
        if (match) {
            return {
                x: parseFloat(match[1]) || 0,
                y: parseFloat(match[2]) || 0
            };
        }
        
        console.warn('Unable to parse transform attribute:', transform);
        return { x: 0, y: 0 };
    }
    
    showError(message) {
        console.error('PT2Visualizer Error:', message);
        
        // Show error in metadata panel
        if (this.metadataContent) {
            this.metadataContent.innerHTML = `
                <div class="error-display">
                    <h4>⚠️ Error</h4>
                    <p>${message}</p>
                    <small>Check the console for more details</small>
                </div>
            `;
        }
        
        // Show sidebar with error
        this.showSidebar();
        
        // Clear visualization
        if (this.mainGroup) {
            this.mainGroup.selectAll('*').remove();
        }
        if (this.phaseButtonsContainer) {
            this.phaseButtonsContainer.innerHTML = '';
        }
        
        // Hide loading if shown
        this.hideLoading();
    }
    
    // Loading indicator methods
    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.remove('hidden');
            this.loadingIndicator.style.display = 'flex';
            console.log('Loading shown - element exists:', !!this.loadingIndicator);
        } else {
            console.error('Loading indicator element not found');
        }
    }
    
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.add('hidden');
            this.loadingIndicator.style.display = 'none';
            console.log('Loading hidden - element exists:', !!this.loadingIndicator);
        } else {
            console.error('Loading indicator element not found when trying to hide');
        }
    }
    
    // Sidebar methods
    showSidebar() {
        if (this.metadataPanel) {
            this.metadataPanel.classList.remove('hidden');
        }
    }
    
    hideSidebar() {
        if (this.metadataPanel) {
            this.metadataPanel.classList.add('hidden');
        }
        this.clearSelections();
    }
    
    // Edge visibility toggle
    toggleEdgeVisibility() {
        if (this.mainGroup) {
            this.mainGroup.selectAll('.edge')
                .style('display', this.edgesVisible ? 'block' : 'none');
        }
    }
    
    // Utility method to clear all selections
    clearSelections() {
        this.selectedNodeId = null;
        this.highlightedNodeId = null;
        
        if (this.mainGroup) {
            this.mainGroup.selectAll('.node')
                .classed('selected', false)
                .classed('highlighted', false);
            
            this.mainGroup.selectAll('.edge')
                .classed('highlighted', false)
                .attr('marker-end', 'url(#arrowhead)');
        }
        
        if (this.metadataContent) {
            this.metadataContent.innerHTML = '<p>Click on a node to view its metadata</p>';
        }
    }
}

// Initialize the visualizer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new PT2Visualizer();
    
    // Make visualizer globally accessible for debugging
    window.pt2Visualizer = visualizer;
    
    // Handle window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            try {
                if (visualizer && typeof visualizer.initializeSVG === 'function') {
                    visualizer.initializeSVG();
                    if (visualizer.data && visualizer.data.length > 0) {
                        visualizer.renderVisualization();
                    }
                }
            } catch (error) {
                console.error('Error handling window resize:', error);
            }
        }, 100);
    });
    
    // Default sample data - automatically loaded for better UX
    const sampleData = `{"phase": "graph_optimization", "id": "relu_1", "edges": ["conv_2"], "metadata": {"type": "relu", "input_shape": [32, 64, 128], "output_shape": [32, 64, 128]}}
{"phase": "graph_optimization", "id": "conv_2", "edges": ["maxpool_3"], "metadata": {"type": "conv2d", "kernel_size": 3, "stride": 1, "padding": 1}}
{"phase": "graph_optimization", "id": "maxpool_3", "edges": ["flatten_4"], "metadata": {"type": "maxpool2d", "kernel_size": 2, "stride": 2}}
{"phase": "graph_optimization", "id": "flatten_4", "edges": ["linear_5"], "metadata": {"type": "flatten", "start_dim": 1}}
{"phase": "graph_optimization", "id": "linear_5", "edges": [], "metadata": {"type": "linear", "in_features": 2048, "out_features": 10}}
{"phase": "lowering", "id": "relu_1", "edges": ["conv_2"], "metadata": {"lowered_op": "relu_kernel", "grid_size": [4, 8, 16], "block_size": 256}}
{"phase": "lowering", "id": "conv_2", "edges": ["maxpool_3"], "metadata": {"lowered_op": "conv2d_kernel", "grid_size": [32, 32], "shared_memory": "48KB"}}
{"phase": "lowering", "id": "maxpool_3", "edges": ["flatten_4"], "metadata": {"lowered_op": "maxpool_kernel", "grid_size": [16, 16], "block_size": 128}}
{"phase": "lowering", "id": "flatten_4", "edges": ["linear_5"], "metadata": {"lowered_op": "reshape_kernel", "memory_layout": "contiguous"}}
{"phase": "lowering", "id": "linear_5", "edges": [], "metadata": {"lowered_op": "gemm_kernel", "tile_size": [64, 64], "shared_memory": "96KB"}}
{"phase": "codegen", "id": "relu_1", "edges": ["conv_2"], "metadata": {"generated_code": "relu_elementwise.cu", "register_usage": 12, "occupancy": "100%"}}
{"phase": "codegen", "id": "conv_2", "edges": ["maxpool_3"], "metadata": {"generated_code": "conv2d_winograd.cu", "register_usage": 48, "occupancy": "75%"}}
{"phase": "codegen", "id": "maxpool_3", "edges": ["flatten_4"], "metadata": {"generated_code": "maxpool_simple.cu", "register_usage": 16, "occupancy": "100%"}}
{"phase": "codegen", "id": "flatten_4", "edges": ["linear_5"], "metadata": {"generated_code": "reshape_memcpy.cu", "register_usage": 8, "occupancy": "100%"}}
{"phase": "codegen", "id": "linear_5", "edges": [], "metadata": {"generated_code": "gemm_cutlass.cu", "register_usage": 64, "occupancy": "50%"}}`;
    
    // Load sample data and auto-render
    if (visualizer.jsonInput) {
        visualizer.jsonInput.value = sampleData;
        // Auto-render after a short delay to ensure DOM is ready
        setTimeout(() => {
            visualizer.parseAndVisualize();
        }, 100);
    }
});