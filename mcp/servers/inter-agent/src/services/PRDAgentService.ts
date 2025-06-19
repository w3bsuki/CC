import { AgentBaseService, AgentServiceOptions } from '../../../../services/agent-base';
import { marked } from 'marked';
import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  Requirement, 
  Feature, 
  Priority,
  RequirementType,
  AgentRole,
} from '../../../../interfaces';

// PRD Parser Schema (same as in original)
const PRDSchema = z.object({
  title: z.string(),
  overview: z.string().optional(),
  features: z.array(z.object({
    name: z.string(),
    description: z.string(),
    requirements: z.array(z.string()),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  })),
  functionalRequirements: z.array(z.string()).optional(),
  nonFunctionalRequirements: z.array(z.string()).optional(),
  technicalRequirements: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

interface ParsedPRD {
  documentId: string;
  title: string;
  overview?: string;
  features: Feature[];
  requirements: Requirement[];
  estimatedTasks: number;
  metadata: {
    parsedAt: string;
    version: string;
    checksum: string;
  };
}

export class PRDAgentService extends AgentBaseService {
  private readonly sharedPath: string;
  private readonly contextPath: string;
  private readonly tasksPath: string;
  private readonly requirementsPath: string;
  
  constructor(options: AgentServiceOptions) {
    super(options);
    
    // Set up paths
    this.sharedPath = path.join(this.config.workspacePath, 'shared');
    this.contextPath = path.join(this.sharedPath, 'context');
    this.tasksPath = path.join(this.sharedPath, 'tasks');
    this.requirementsPath = path.join(this.sharedPath, 'requirements');
  }
  
  protected async initialize(): Promise<void> {
    console.log('PRD Agent Service initializing...');
    
    // Ensure necessary directories exist
    await fs.ensureDir(this.contextPath);
    await fs.ensureDir(this.requirementsPath);
    
    // Check if auto-start is needed (if PRD exists)
    const prdPath = path.join(this.requirementsPath, 'prd.md');
    if (await this.fileExists(prdPath)) {
      console.log('Found PRD file, scheduling automatic processing...');
      // Process PRD after a short delay to ensure system is ready
      setTimeout(() => this.processPRD(prdPath), 2000);
    }
  }
  
  protected async cleanup(): Promise<void> {
    console.log('PRD Agent Service cleaning up...');
    // Any cleanup needed
  }
  
  protected async processMessage(message: any): Promise<any> {
    console.log(`PRD Agent processing message: ${message.type}`);
    
    switch (message.type) {
      case 'process-prd':
        return await this.handleProcessPRD(message.payload);
        
      case 'parse-requirements':
        return await this.handleParseRequirements(message.payload);
        
      case 'get-requirements':
        return await this.handleGetRequirements(message.payload);
        
      case 'update-requirement-status':
        return await this.handleUpdateRequirementStatus(message.payload);
        
      default:
        console.warn(`Unknown message type: ${message.type}`);
        return { error: `Unknown message type: ${message.type}` };
    }
  }
  
  protected async checkHealth(): Promise<{
    healthy: boolean;
    issues?: string[];
    recoverable?: boolean;
    metrics?: Record<string, any>;
  }> {
    const issues: string[] = [];
    
    // Check if required directories exist
    if (!await this.fileExists(this.contextPath)) {
      issues.push('Context directory missing');
    }
    
    if (!await this.fileExists(this.requirementsPath)) {
      issues.push('Requirements directory missing');
    }
    
    // Check if we can read/write files
    try {
      const testFile = path.join(this.contextPath, '.health-check');
      await this.writeFile(testFile, 'test');
      await fs.remove(testFile);
    } catch (error) {
      issues.push('Cannot write to context directory');
    }
    
    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      recoverable: true,
      metrics: {
        contextDirExists: await this.fileExists(this.contextPath),
        requirementsDirExists: await this.fileExists(this.requirementsPath),
      }
    };
  }
  
  // Message handlers
  private async handleProcessPRD(payload: any): Promise<any> {
    const { prdPath } = payload;
    
    if (!prdPath) {
      throw new Error('PRD path is required');
    }
    
    return await this.processPRD(prdPath);
  }
  
  private async handleParseRequirements(payload: any): Promise<any> {
    const { content } = payload;
    
    if (!content) {
      throw new Error('PRD content is required');
    }
    
    const checksum = this.generateChecksum(content);
    const tokens = marked.lexer(content);
    const parsed = this.extractStructure(tokens);
    
    return this.createParsedPRD(parsed, checksum);
  }
  
  private async handleGetRequirements(payload: any): Promise<any> {
    const requirementsFile = path.join(this.contextPath, 'requirements.json');
    
    if (!await this.fileExists(requirementsFile)) {
      return { error: 'No requirements found. Please process a PRD first.' };
    }
    
    return await fs.readJson(requirementsFile);
  }
  
  private async handleUpdateRequirementStatus(payload: any): Promise<any> {
    const { requirementId, status } = payload;
    
    if (!requirementId || !status) {
      throw new Error('Requirement ID and status are required');
    }
    
    const requirementsFile = path.join(this.contextPath, 'requirements.json');
    
    if (!await this.fileExists(requirementsFile)) {
      throw new Error('No requirements found');
    }
    
    const parsedPRD = await fs.readJson(requirementsFile);
    const requirement = parsedPRD.requirements.find((r: Requirement) => r.id === requirementId);
    
    if (!requirement) {
      throw new Error(`Requirement ${requirementId} not found`);
    }
    
    requirement.status = status;
    await fs.writeJson(requirementsFile, parsedPRD, { spaces: 2 });
    
    return { success: true, requirement };
  }
  
  // Core PRD processing logic (adapted from original)
  private async processPRD(prdPath: string): Promise<any> {
    try {
      this.setStatus('working', 'Processing PRD');
      
      // Read and parse the PRD
      const fullPath = path.isAbsolute(prdPath) 
        ? prdPath 
        : path.join(this.config.workspacePath, prdPath);
        
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`PRD file not found at: ${fullPath}`);
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const parsedPRD = await this.parsePRD(content);
      
      // Save parsed requirements to shared context
      await this.saveToContext('requirements', parsedPRD);
      
      // Generate initial task list
      const taskList = await this.generateTaskList(parsedPRD);
      
      // Save task list to shared context
      await this.saveToContext('initial-tasks', taskList);
      
      // Notify Task Agent via inter-agent server
      await this.notifyTaskAgent(parsedPRD);
      
      this.setStatus('idle');
      
      console.log(`PRD analysis complete. Found ${parsedPRD.features.length} features and ${parsedPRD.requirements.length} requirements.`);
      
      return {
        success: true,
        summary: {
          documentId: parsedPRD.documentId,
          title: parsedPRD.title,
          featureCount: parsedPRD.features.length,
          requirementCount: parsedPRD.requirements.length,
          estimatedTasks: parsedPRD.estimatedTasks,
        }
      };
      
    } catch (error) {
      console.error('PRD processing error:', error);
      this.setStatus('blocked', 'PRD processing failed');
      throw error;
    }
  }
  
  private async parsePRD(content: string): Promise<ParsedPRD> {
    const checksum = this.generateChecksum(content);
    
    // Parse markdown
    const tokens = marked.lexer(content);
    const parsed = this.extractStructure(tokens);
    
    return this.createParsedPRD(parsed, checksum);
  }
  
  private createParsedPRD(parsed: any, checksum: string): ParsedPRD {
    // Generate unique IDs
    let featureCounter = 0;
    let requirementCounter = 0;
    
    const features: Feature[] = parsed.features.map((f: any) => ({
      id: `feat-${String(++featureCounter).padStart(3, '0')}`,
      name: f.name,
      description: f.description,
      requirements: [],
      priority: this.mapPriority(f.priority || 'medium'),
      status: 'pending',
    }));
    
    const requirements: Requirement[] = [];
    
    // Process functional requirements
    if (parsed.functionalRequirements) {
      parsed.functionalRequirements.forEach((req: string) => {
        requirements.push({
          id: `req-${String(++requirementCounter).padStart(3, '0')}`,
          type: 'functional',
          description: req,
          priority: 'high',
          status: 'pending',
          featureId: this.findRelatedFeature(req, features),
        } as any);
      });
    }
    
    // Process non-functional requirements
    if (parsed.nonFunctionalRequirements) {
      parsed.nonFunctionalRequirements.forEach((req: string) => {
        requirements.push({
          id: `req-${String(++requirementCounter).padStart(3, '0')}`,
          type: 'non-functional',
          description: req,
          priority: 'medium',
          status: 'pending',
        } as any);
      });
    }
    
    // Process technical requirements
    if (parsed.technicalRequirements) {
      parsed.technicalRequirements.forEach((req: string) => {
        requirements.push({
          id: `req-${String(++requirementCounter).padStart(3, '0')}`,
          type: 'technical',
          description: req,
          priority: 'high',
          status: 'pending',
        } as any);
      });
    }
    
    // Link requirements to features
    features.forEach(feature => {
      feature.requirements = requirements
        .filter((req: any) => req.featureId === feature.id)
        .map((req: any) => req.id);
    });
    
    return {
      documentId: `prd-${Date.now()}`,
      title: parsed.title,
      overview: parsed.overview,
      features,
      requirements,
      estimatedTasks: this.estimateTasks(features, requirements),
      metadata: {
        parsedAt: new Date().toISOString(),
        version: '1.0',
        checksum,
      },
    };
  }
  
  private extractStructure(tokens: any[]): any {
    const structure = {
      title: '',
      overview: '',
      features: [],
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      technicalRequirements: [],
      constraints: [],
      acceptanceCriteria: [],
    };
    
    let currentSection = '';
    let currentFeature: any = null;
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        const headingText = token.text.toLowerCase();
        
        if (token.depth === 1 && !structure.title) {
          structure.title = token.text;
        } else if (headingText.includes('overview')) {
          currentSection = 'overview';
        } else if (headingText.includes('feature')) {
          currentSection = 'features';
          if (token.depth === 3) {
            currentFeature = {
              name: token.text.replace(/feature[:\s]*/i, '').trim(),
              description: '',
              requirements: [],
            };
            structure.features.push(currentFeature);
          }
        } else if (headingText.includes('functional requirement')) {
          currentSection = 'functionalRequirements';
        } else if (headingText.includes('non-functional') || headingText.includes('non functional')) {
          currentSection = 'nonFunctionalRequirements';
        } else if (headingText.includes('technical requirement')) {
          currentSection = 'technicalRequirements';
        } else if (headingText.includes('constraint')) {
          currentSection = 'constraints';
        } else if (headingText.includes('acceptance criteria')) {
          currentSection = 'acceptanceCriteria';
        }
      } else if (token.type === 'paragraph') {
        if (currentSection === 'overview') {
          structure.overview += token.text + '\n';
        } else if (currentSection === 'features' && currentFeature) {
          currentFeature.description += token.text + '\n';
        }
      } else if (token.type === 'list') {
        const items = token.items.map((item: any) => item.text);
        
        if (currentSection === 'features' && currentFeature) {
          currentFeature.requirements.push(...items);
        } else if (currentSection && (structure as any)[currentSection]) {
          (structure as any)[currentSection].push(...items);
        }
      }
    }
    
    // Clean up descriptions
    structure.overview = structure.overview.trim();
    structure.features.forEach((f: any) => {
      f.description = f.description.trim();
    });
    
    return structure;
  }
  
  private async generateTaskList(prd: ParsedPRD) {
    const tasks: any[] = [];
    let taskCounter = 0;
    
    // Generate tasks for each feature
    for (const feature of prd.features) {
      // Setup task
      tasks.push({
        id: `task-${String(++taskCounter).padStart(3, '0')}`,
        type: 'setup',
        title: `Setup development environment for ${feature.name}`,
        description: `Initialize project structure and dependencies for ${feature.name}`,
        featureId: feature.id,
        priority: this.calculateTaskPriority(feature.priority, 'setup'),
        estimatedEffort: 2,
        dependencies: [],
        acceptanceCriteria: [
          'Project structure created',
          'Dependencies installed',
          'Development environment configured',
        ],
      });
      
      // Implementation tasks
      const featureRequirements = prd.requirements.filter((r: any) => r.featureId === feature.id);
      
      for (const req of featureRequirements) {
        // Test task (TDD - test first)
        const testTaskId = `task-${String(++taskCounter).padStart(3, '0')}`;
        tasks.push({
          id: testTaskId,
          type: 'test',
          title: `Write tests for: ${req.description.substring(0, 60)}...`,
          description: `Create comprehensive test suite for requirement: ${req.description}`,
          featureId: feature.id,
          requirementId: req.id,
          priority: this.calculateTaskPriority(feature.priority, 'test'),
          estimatedEffort: this.estimateTestEffort(req),
          dependencies: [],
          acceptanceCriteria: [
            'Unit tests written',
            'Integration tests written',
            'Edge cases covered',
            'Tests are failing (red phase)',
          ],
        });
        
        // Implementation task
        tasks.push({
          id: `task-${String(++taskCounter).padStart(3, '0')}`,
          type: 'implementation',
          title: `Implement: ${req.description.substring(0, 60)}...`,
          description: `Implement functionality for: ${req.description}`,
          featureId: feature.id,
          requirementId: req.id,
          priority: this.calculateTaskPriority(feature.priority, 'implementation'),
          estimatedEffort: this.estimateImplementationEffort(req),
          dependencies: [testTaskId],
          acceptanceCriteria: [
            'All tests passing',
            'Code follows best practices',
            'Error handling implemented',
            'Documentation updated',
          ],
        });
      }
      
      // Integration task
      tasks.push({
        id: `task-${String(++taskCounter).padStart(3, '0')}`,
        type: 'integration',
        title: `Integrate and validate ${feature.name}`,
        description: `Ensure all components of ${feature.name} work together correctly`,
        featureId: feature.id,
        priority: this.calculateTaskPriority(feature.priority, 'integration'),
        estimatedEffort: 4,
        dependencies: tasks
          .filter(t => t.featureId === feature.id && t.type === 'implementation')
          .map(t => t.id),
        acceptanceCriteria: [
          'All feature components integrated',
          'End-to-end tests passing',
          'Performance requirements met',
          'Feature documentation complete',
        ],
      });
    }
    
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      tasksByType: this.groupTasksByType(tasks),
      estimatedTotalEffort: tasks.reduce((sum: number, t: any) => sum + t.estimatedEffort, 0),
      tasks,
    };
  }
  
  // Helper methods (same as original)
  private calculateTaskPriority(featurePriority: Priority, taskType: string): number {
    const basePriority = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 3,
    }[featurePriority];
    
    const typeMultiplier = {
      setup: 1.0,
      test: 0.9,
      implementation: 0.8,
      integration: 0.7,
    }[taskType] || 0.5;
    
    return Math.round(basePriority * typeMultiplier);
  }
  
  private estimateTestEffort(requirement: Requirement): number {
    const description = requirement.description.toLowerCase();
    let effort = 2; // Base effort
    
    if (description.includes('multiple') || description.includes('various')) effort += 1;
    if (description.includes('validate') || description.includes('verify')) effort += 1;
    if (description.includes('secure') || description.includes('encrypt')) effort += 2;
    if (description.includes('performance') || description.includes('optimize')) effort += 2;
    if (requirement.type === 'non-functional') effort += 1;
    
    return Math.min(effort, 8);
  }
  
  private estimateImplementationEffort(requirement: Requirement): number {
    const description = requirement.description.toLowerCase();
    let effort = 3; // Base effort
    
    if (description.includes('api') || description.includes('endpoint')) effort += 1;
    if (description.includes('database') || description.includes('storage')) effort += 2;
    if (description.includes('authentication') || description.includes('authorization')) effort += 2;
    if (description.includes('real-time') || description.includes('websocket')) effort += 3;
    if (description.includes('integration') || description.includes('third-party')) effort += 2;
    if (requirement.type === 'technical') effort += 1;
    
    return Math.min(effort, 13);
  }
  
  private estimateTasks(features: Feature[], requirements: Requirement[]): number {
    const setupTasks = features.length;
    const requirementTasks = requirements.length * 2;
    const integrationTasks = features.length;
    
    return setupTasks + requirementTasks + integrationTasks;
  }
  
  private findRelatedFeature(requirement: string, features: Feature[]): string | undefined {
    const reqLower = requirement.toLowerCase();
    
    for (const feature of features) {
      const featureTerms = feature.name.toLowerCase().split(/\s+/);
      const descTerms = feature.description.toLowerCase().split(/\s+/);
      
      if (featureTerms.some(term => reqLower.includes(term)) ||
          descTerms.some(term => term.length > 4 && reqLower.includes(term))) {
        return feature.id;
      }
    }
    
    return undefined;
  }
  
  private groupTasksByType(tasks: any[]): Record<string, number> {
    return tasks.reduce((acc: Record<string, number>, task: any) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {});
  }
  
  private mapPriority(priority: string): Priority {
    const map: Record<string, Priority> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return map[priority.toLowerCase()] || 'medium';
  }
  
  private generateChecksum(content: string): string {
    return Buffer.from(content).toString('base64').substring(0, 16);
  }
  
  private async saveToContext(key: string, data: any): Promise<void> {
    const filePath = path.join(this.contextPath, `${key}.json`);
    await fs.writeJson(filePath, data, { spaces: 2 });
    console.log(`Saved ${key} to shared context`);
  }
  
  private async notifyTaskAgent(prd: ParsedPRD): Promise<void> {
    try {
      // Send requirements complete message to task agent
      const payload = {
        requirementsPath: path.join(this.contextPath, 'requirements.json'),
        featureCount: prd.features.length,
        requirementCount: prd.requirements.length,
        estimatedTasks: prd.estimatedTasks,
        summary: `Parsed ${prd.title}: ${prd.features.length} features, ${prd.requirements.length} requirements`,
      };
      
      // Try to find a task agent
      const taskAgents = await this.interAgentServer.getAgentsByRole('task' as any);
      
      if (taskAgents.length > 0) {
        await this.sendMessage(taskAgents[0].id, {
          type: 'requirements-complete',
          payload
        });
        console.log('Notified task agent about completed requirements');
      } else {
        console.warn('No task agent available to notify');
        // Store notification for later delivery
        this.emit('requirements-ready', payload);
      }
    } catch (error) {
      console.error('Failed to notify task agent:', error);
    }
  }
  
  // Compatibility method for standalone operation
  async processPRDStandalone(prdPath: string): Promise<void> {
    const result = await this.processPRD(prdPath);
    console.log('PRD processing result:', result);
  }
}