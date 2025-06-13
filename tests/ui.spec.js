import { test, expect } from '@playwright/test';

const sampleData = `{"phase": "graph_optimization", "id": "node_1", "edges": ["node_2"], "metadata": {"type": "relu", "input_shape": [32, 64, 128]}}
{"phase": "graph_optimization", "id": "node_2", "edges": ["node_3"], "metadata": {"type": "conv2d", "kernel_size": 3, "stride": 1}}
{"phase": "graph_optimization", "id": "node_3", "edges": [], "metadata": {"type": "output", "shape": [32, 32, 256]}}
{"phase": "lowering", "id": "node_1", "edges": ["node_3"], "metadata": {"lowered_op": "relu_kernel", "grid_size": [4, 8]}}
{"phase": "lowering", "id": "node_3", "edges": [], "metadata": {"lowered_op": "matmul_kernel", "block_size": 16}}`;

test.describe('PT2 Visualizer UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PT2 Compiler Visualization/);
    // Wait for auto-loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
  });

  test('should load with all required elements', async ({ page }) => {
    // Check main elements are present
    await expect(page.locator('h1')).toContainText('PT2 Compiler Visualization');
    await expect(page.locator('#jsonInput')).toBeVisible();
    await expect(page.locator('#parseButton')).toBeVisible();
    await expect(page.locator('#visualization')).toBeVisible();
    await expect(page.locator('#showEdges')).toBeChecked();
  });

  test('should auto-load sample data and render visualization', async ({ page }) => {
    // Should have sample data pre-loaded in textarea
    const textareaContent = await page.locator('#jsonInput').inputValue();
    expect(textareaContent).toContain('graph_optimization');
    expect(textareaContent).toContain('lowering');
    expect(textareaContent).toContain('codegen');
    
    // Should have automatically rendered visualization
    await expect(page.locator('.phase-group')).toHaveCount(3);
    await expect(page.locator('.phase-button')).toHaveCount(3);
    await expect(page.locator('.node')).toHaveCountGreaterThan(0);
  });

  test('should show loading indicator during processing', async ({ page }) => {
    // Fill in sample data
    await page.locator('#jsonInput').fill(sampleData);
    
    // Click parse button
    await page.locator('#parseButton').click();
    
    // Loading indicator should appear
    await expect(page.locator('.loading-indicator')).toBeVisible();
    
    // Wait for processing to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
  });

  test('should create phase buttons with readable text', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // Check phase buttons exist
    const phaseButtons = page.locator('.phase-button');
    await expect(phaseButtons).toHaveCount(2); // graph_optimization and lowering
    
    // Check button text is readable (white text on colored background)
    const firstButton = phaseButtons.first();
    await expect(firstButton).toBeVisible();
    
    // Check button has proper styling
    const buttonStyles = await firstButton.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
      };
    });
    
    // Should have white text
    expect(buttonStyles.color).toBe('rgb(255, 255, 255)');
  });

  test('should render visualization with proper spacing', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // Check visualization elements exist
    await expect(page.locator('.phase-group')).toHaveCount(2);
    await expect(page.locator('.node')).toHaveCount(4); // 3 in first phase, 2 in second (node_1 appears in both)
    await expect(page.locator('.phase-background')).toHaveCount(2);
    
    // Check phase separation exists
    await expect(page.locator('.phase-separator')).toHaveCount(1);
  });

  test('should toggle phase visibility', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // All phase groups should be visible initially
    const phaseGroups = page.locator('.phase-group');
    await expect(phaseGroups).toHaveCount(2);
    
    // Click first phase button to toggle off
    const firstPhaseButton = page.locator('.phase-button').first();
    await firstPhaseButton.click();
    
    // Button should become inactive
    await expect(firstPhaseButton).not.toHaveClass(/active/);
    
    // Click again to toggle back on
    await firstPhaseButton.click();
    await expect(firstPhaseButton).toHaveClass(/active/);
  });

  test('should show metadata panel when clicking nodes', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // Metadata panel should be hidden initially
    await expect(page.locator('#metadataPanel')).toHaveClass(/hidden/);
    
    // Click on a node
    const firstNode = page.locator('.node').first();
    await firstNode.click();
    
    // Metadata panel should appear
    await expect(page.locator('#metadataPanel')).not.toHaveClass(/hidden/);
    
    // Should contain node information
    await expect(page.locator('#metadataContent')).toContainText('node_1');
  });

  test('should toggle edge visibility', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // Edges should be visible by default
    const edges = page.locator('.edge');
    await expect(edges.first()).toBeVisible();
    
    // Toggle edges off
    await page.locator('#showEdges').uncheck();
    await expect(edges.first()).toBeHidden();
    
    // Toggle edges back on
    await page.locator('#showEdges').check();
    await expect(edges.first()).toBeVisible();
  });

  test('should handle invalid JSON gracefully', async ({ page }) => {
    // Fill in invalid JSON
    await page.locator('#jsonInput').fill('invalid json data');
    await page.locator('#parseButton').click();
    
    // Should show error in metadata panel
    await expect(page.locator('#metadataPanel')).not.toHaveClass(/hidden/);
    await expect(page.locator('.error-display')).toBeVisible();
    await expect(page.locator('.error-display')).toContainText('Error');
  });

  test('should have readable text colors throughout', async ({ page }) => {
    // Fill in sample data and parse
    await page.locator('#jsonInput').fill(sampleData);
    await page.locator('#parseButton').click();
    
    // Wait for loading to complete
    await expect(page.locator('.loading-indicator')).toBeHidden({ timeout: 10000 });
    
    // Check phase labels are readable (dark text)
    const phaseLabel = page.locator('.phase-label').first();
    const labelColor = await phaseLabel.evaluate(el => {
      return window.getComputedStyle(el).fill;
    });
    expect(labelColor).toBe('rgb(44, 62, 80)'); // #2c3e50
    
    // Check node text is white
    const nodeText = page.locator('.node text').first();
    const textColor = await nodeText.evaluate(el => {
      return window.getComputedStyle(el).fill;
    });
    expect(textColor).toBe('white');
  });
});