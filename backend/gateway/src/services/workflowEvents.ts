import { EventEmitter } from 'events'
import { getRedis } from './redis'
import { logger } from '../utils/logger.js'

export interface WorkflowEvent {
  workflowId: string
  type: 'status_update' | 'step_completed' | 'step_started' | 'error' | 'completed' | 'failed'
  data: any
  timestamp: Date
  userId: string
}

class WorkflowEventService extends EventEmitter {
  private readonly CHANNEL_PREFIX = 'workflow:'
  private subscriber: any = null
  private publisher: any = null
  private subscribedChannels: Set<string> = new Set()
  
  constructor() {
    super()
    this.setMaxListeners(100) // Support many concurrent workflow streams
  }
  
  async initialize() {
    try {
      // Create separate Redis connections for pub/sub
      const redis = getRedis()
      // duplicate() returns a connected instance when the original is connected
      this.publisher = redis.duplicate()
      this.subscriber = redis.duplicate()
      
      // Set up message handler
      this.subscriber.on('message', (channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as WorkflowEvent
          // Emit to specific workflow listeners
          this.emit(channel, event)
          // Also emit a general event
          this.emit('workflow-event', event)
        } catch (error) {
          logger.error('Error processing workflow event:', error)
        }
      })
      
      logger.info('Workflow event service initialized')
    } catch (error) {
      logger.error('Failed to initialize workflow event service:', error)
      throw error
    }
  }
  
  /**
   * Subscribe to workflow events
   */
  async subscribeToWorkflow(workflowId: string, userId: string): Promise<void> {
    const channel = `${this.CHANNEL_PREFIX}${workflowId}`
    
    if (!this.subscribedChannels.has(channel)) {
      await this.subscriber.subscribe(channel)
      this.subscribedChannels.add(channel)
      logger.debug(`Subscribed to workflow channel: ${channel}`)
    }
  }
  
  /**
   * Unsubscribe from workflow events
   */
  async unsubscribeFromWorkflow(workflowId: string): Promise<void> {
    const channel = `${this.CHANNEL_PREFIX}${workflowId}`
    
    if (this.subscribedChannels.has(channel)) {
      await this.subscriber.unsubscribe(channel)
      this.subscribedChannels.delete(channel)
      this.removeAllListeners(channel)
      logger.debug(`Unsubscribed from workflow channel: ${channel}`)
    }
  }
  
  /**
   * Publish a workflow event
   */
  async publishWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const channel = `${this.CHANNEL_PREFIX}${event.workflowId}`
    
    try {
      await this.publisher.publish(channel, JSON.stringify(event))
      logger.debug(`Published workflow event: ${event.type} for ${event.workflowId}`)
    } catch (error) {
      logger.error('Failed to publish workflow event:', error)
      throw error
    }
  }
  
  /**
   * Emit status update for a workflow
   */
  async emitStatusUpdate(
    workflowId: string,
    userId: string,
    status: string,
    data?: any
  ): Promise<void> {
    await this.publishWorkflowEvent({
      workflowId,
      type: 'status_update',
      data: { status, ...data },
      timestamp: new Date(),
      userId
    })
  }
  
  /**
   * Emit step started event
   */
  async emitStepStarted(
    workflowId: string,
    userId: string,
    stepId: string,
    stepName: string
  ): Promise<void> {
    await this.publishWorkflowEvent({
      workflowId,
      type: 'step_started',
      data: { stepId, stepName },
      timestamp: new Date(),
      userId
    })
  }
  
  /**
   * Emit step completed event
   */
  async emitStepCompleted(
    workflowId: string,
    userId: string,
    stepId: string,
    stepName: string,
    result?: any
  ): Promise<void> {
    await this.publishWorkflowEvent({
      workflowId,
      type: 'step_completed',
      data: { stepId, stepName, result },
      timestamp: new Date(),
      userId
    })
  }
  
  /**
   * Emit workflow completed event
   */
  async emitWorkflowCompleted(
    workflowId: string,
    userId: string,
    result?: any
  ): Promise<void> {
    await this.publishWorkflowEvent({
      workflowId,
      type: 'completed',
      data: { result },
      timestamp: new Date(),
      userId
    })
  }
  
  /**
   * Emit workflow error event
   */
  async emitWorkflowError(
    workflowId: string,
    userId: string,
    error: string,
    stepId?: string
  ): Promise<void> {
    await this.publishWorkflowEvent({
      workflowId,
      type: 'error',
      data: { error, stepId },
      timestamp: new Date(),
      userId
    })
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from all channels
    for (const channel of this.subscribedChannels) {
      await this.subscriber.unsubscribe(channel)
    }
    this.subscribedChannels.clear()
    this.removeAllListeners()
    
    // Close connections
    if (this.subscriber) {
      await this.subscriber.quit()
    }
    if (this.publisher) {
      await this.publisher.quit()
    }
    
    logger.info('Workflow event service cleaned up')
  }
}

// Export singleton instance
export const workflowEvents = new WorkflowEventService()

// Initialize on module load
workflowEvents.initialize().catch(error => {
  logger.error('Failed to initialize workflow events:', error)
})