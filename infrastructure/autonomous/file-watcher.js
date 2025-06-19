const chokidar = require('chokidar');
const Redis = require('ioredis');
const path = require('path');

class AutonomousFileWatcher {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6380
    });
    
    this.workspaceRoot = '/home/w3bsuki/omg/claude-multi-agent/workspace';
    this.setupWatchers();
  }

  setupWatchers() {
    // Watch PRD files for PRD Agent trigger
    chokidar.watch(`${this.workspaceRoot}/shared/requirements/prd.md`)
      .on('change', () => this.triggerPRDAgent())
      .on('add', () => this.triggerPRDAgent());

    // Watch analysis files for Architect Agent trigger  
    chokidar.watch(`${this.workspaceRoot}/shared/requirements/analysis.json`)
      .on('change', () => this.triggerArchitectAgent())
      .on('add', () => this.triggerArchitectAgent());

    // Watch architecture files for Builder Agent trigger
    chokidar.watch(`${this.workspaceRoot}/shared/architecture/tech-stack.json`)
      .on('change', () => this.triggerBuilderAgent())
      .on('add', () => this.triggerBuilderAgent());

    console.log('🔍 Autonomous file watcher started');
  }

  async triggerPRDAgent() {
    console.log('📋 Triggering PRD Agent...');
    await this.redis.publish('agent:trigger', JSON.stringify({
      agent: 'prd-agent',
      trigger: 'file:prd-ready',
      timestamp: new Date().toISOString()
    }));
  }

  async triggerArchitectAgent() {
    console.log('🏗️ Triggering Architect Agent...');
    await this.redis.publish('agent:trigger', JSON.stringify({
      agent: 'architect-agent', 
      trigger: 'file:requirements-ready',
      timestamp: new Date().toISOString()
    }));
  }

  async triggerBuilderAgent() {
    console.log('⚡ Triggering Builder Agent...');
    await this.redis.publish('agent:trigger', JSON.stringify({
      agent: 'builder-agent',
      trigger: 'file:architecture-ready', 
      timestamp: new Date().toISOString()
    }));
  }
}

// Start autonomous watcher
new AutonomousFileWatcher();