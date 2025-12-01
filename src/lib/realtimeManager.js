import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized realtime broadcast manager to avoid channel conflicts
 */
class RealtimeBroadcastManager {
  constructor() {
    this.globalChannel = null;
    this.subscribers = new Map();
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    
    this.initializeGlobalChannel();
  }

  initializeGlobalChannel() {
    console.log('🔌 Initializing global realtime broadcast manager...');
    
    this.globalChannel = supabase
      .channel('global-realtime-manager')
      .on('broadcast', { event: 'match-state-updated' }, (payload) => {
        console.log('🌐 Global manager received match-state-updated:', payload);
        this.notifySubscribers('match-state-updated', payload);
      })
      .on('broadcast', { event: 'force-notification-refresh' }, (payload) => {
        console.log('🌐 Global manager received force-notification-refresh:', payload);
        this.notifySubscribers('force-notification-refresh', payload);
      })
      .subscribe((status, error) => {
        console.log('🔌 Global channel status:', status);
        
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.connectionAttempts = 0;
          console.log('✅ Global realtime manager connected');
        } else if (status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          console.error('❌ Global channel error:', error);
          this.attemptReconnection();
        } else if (status === 'CLOSED') {
          this.isConnected = false;
          console.log('🔌 Global channel closed');
        }
      });
  }

  attemptReconnection() {
    if (this.connectionAttempts >= this.maxRetries) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.connectionAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000);
    
    console.log(`🔄 Attempting reconnection ${this.connectionAttempts}/${this.maxRetries} in ${delay}ms...`);
    
    setTimeout(() => {
      this.cleanup();
      this.initializeGlobalChannel();
    }, delay);
  }

  subscribe(id, callback) {
    console.log('📝 Registering subscriber:', id);
    this.subscribers.set(id, callback);
    
    return () => {
      console.log('🗑️ Unregistering subscriber:', id);
      this.subscribers.delete(id);
    };
  }

  notifySubscribers(event, payload) {
    console.log(`📢 Notifying ${this.subscribers.size} subscribers of ${event}`);
    
    this.subscribers.forEach((callback, id) => {
      try {
        callback(event, payload);
      } catch (error) {
        console.error(`❌ Error notifying subscriber ${id}:`, error);
      }
    });
  }

  async broadcast(event, payload, retries = 2) {
    if (!this.isConnected && retries > 0) {
      console.log('⏳ Channel not connected, retrying broadcast...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.broadcast(event, payload, retries - 1);
    }

    if (!this.isConnected) {
      console.error('❌ Cannot broadcast - channel not connected');
      return false;
    }

    try {
      console.log('📡 Broadcasting event:', event, payload);
      
      await this.globalChannel.send({
        type: 'broadcast',
        event,
        payload
      });
      
      console.log('✅ Broadcast successful');
      return true;
    } catch (error) {
      console.error('❌ Broadcast failed:', error);
      return false;
    }
  }

  cleanup() {
    if (this.globalChannel) {
      console.log('🧹 Cleaning up global channel');
      supabase.removeChannel(this.globalChannel);
      this.globalChannel = null;
    }
    this.isConnected = false;
    this.subscribers.clear();
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      subscriberCount: this.subscribers.size,
      connectionAttempts: this.connectionAttempts
    };
  }
}

// Create singleton instance
export const realtimeManager = new RealtimeBroadcastManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.cleanup();
  });
}