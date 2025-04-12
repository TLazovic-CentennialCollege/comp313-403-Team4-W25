import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

export interface ChatMessage {
  _id: string;
  sender: string;
  recipient: string;
  message: string;
  ticketId?: string;
  read: boolean;
  createdAt: Date;
  
  // Additional fields for UI display
  senderName?: string;
  senderRole?: string;
}

export interface ActiveHrUser {
  id: string;
  name: string;
  department: string;
}

export interface ActiveUser {
  id: string;
  name: string;
  department?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: Socket | null = null;
  private apiUrl = environment.apiUrl;
  
  // Store all messages received for history purposes
  private allMessages: ChatMessage[] = [];
  
  // Subjects for reactive updates
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private newMessageSubject = new Subject<ChatMessage>();
  private typingSubject = new Subject<{userId: string, isTyping: boolean}>();
  private activeHrUsersSubject = new BehaviorSubject<ActiveHrUser[]>([]);
  private activeEmployeeUsersSubject = new BehaviorSubject<ActiveUser[]>([]);
  
  // Observable streams
  public messages$ = this.messagesSubject.asObservable();
  public newMessage$ = this.newMessageSubject.asObservable();
  public typing$ = this.typingSubject.asObservable();
  public activeHrUsers$ = this.activeHrUsersSubject.asObservable();
  public activeEmployeeUsers$ = this.activeEmployeeUsersSubject.asObservable();

  // Track currently selected chat
  private currentChatPartner: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService
  ) {}

  // Initialize socket.io connection
  private initializeSocketConnection(): void {
    if (!this.socket && this.authService.getToken()) {
      console.log('Initializing Socket.IO connection');
      this.socket = io(environment.apiUrl.replace('/api', ''), {
        auth: {
          token: this.authService.getToken()
        }
      });
      
      this.setupSocketListeners();
    }
  }
  
  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;
    
    console.log('Setting up Socket.IO listeners');
    
    // Connection established
    this.socket.on('connect', () => {
      console.log('Socket.IO connection established');
    });
    
    // Listen for active employee users updates
    this.socket.on('active_employee_users', (users: ActiveUser[]) => {
      console.log('Received active employee users:', users);
      this.activeEmployeeUsersSubject.next(users || []);
    });

    // Listen for incoming messages
    this.socket.on('private_message', (message: ChatMessage) => {
      console.log('Socket received new message:', message);
      
      // Store the message in our all messages array
      if (!this.allMessages.some(m => m._id === message._id)) {
        this.allMessages.push(message);
      }
      
      // Always emit the new message regardless of local state
      this.newMessageSubject.next(message);
      
      // Update messages list too
      const currentMessages = this.messagesSubject.value;
      // Check if message already exists to avoid duplicates
      const exists = currentMessages.some(m => m._id === message._id);
      if (!exists) {
        const updatedMessages = [...currentMessages, message];
        this.messagesSubject.next(updatedMessages);
      }
      
      // Mark as read if from current chat partner
      if (this.currentChatPartner === message.sender) {
        this.markMessageAsRead(message.sender);
      }
    });
    
    // Listen for typing indicators
    this.socket.on('typing', (data: {sender: string, isTyping: boolean}) => {
      this.typingSubject.next({userId: data.sender, isTyping: data.isTyping});
    });
    
    // Listen for active HR users updates
    this.socket.on('active_hr_users', (users: ActiveHrUser[]) => {
      console.log('Received active HR users:', users);
      this.activeHrUsersSubject.next(users || []);
    });
    
    // Handle connection errors
    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      
      // Retry connection after delay
      setTimeout(() => {
        this.socket?.connect();
      }, 5000);
    });
  }
  
  // Load chat history between current user and another user
  loadChatHistory(partnerId: string): Observable<ChatMessage[]> {
    this.currentChatPartner = partnerId;
    const currentUser = this.userService.getLoggedInUser();
    const token = this.authService.getToken();
    
    if (!currentUser || !currentUser._id) {
      return new Observable(subscriber => {
        subscriber.error('User not authenticated');
        subscriber.complete();
      });
    }
    
    // Add auth headers to the request
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    // Get pending messages for this partner from our local cache
    const pendingMessages = this.allMessages.filter(
      msg => (msg.sender === partnerId && msg.recipient === currentUser._id) || 
             (msg.sender === currentUser._id && msg.recipient === partnerId)
    );
    
    console.log('Pending messages for this chat:', pendingMessages);
    
    return new Observable(subscriber => {
      this.http.get<ChatMessage[]>(`${this.apiUrl}/chat/history/${currentUser._id}/${partnerId}`, { headers })
        .subscribe(
          messages => {
            console.log('Loaded chat history from server:', messages);
            
            // Combine with pending messages
            let combinedMessages = [...messages];
            
            // Add pending messages that aren't in history
            pendingMessages.forEach(pendingMsg => {
              const exists = combinedMessages.some(m => 
                m._id === pendingMsg._id || 
                (m.sender === pendingMsg.sender && 
                 m.message === pendingMsg.message && 
                 Math.abs(new Date(m.createdAt).getTime() - new Date(pendingMsg.createdAt).getTime()) < 5000)
              );
              
              if (!exists) {
                console.log('Adding pending message to history:', pendingMsg);
                combinedMessages.push(pendingMsg);
              }
            });
            
            // Sort by timestamp
            combinedMessages.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            subscriber.next(combinedMessages);
            subscriber.complete();
          },
          error => {
            console.error('Error loading chat history:', error);
            subscriber.error(error);
          }
        );
    });
  }
  
  // Send a message
  sendMessage(recipientId: string, message: string, ticketId?: string): void {
    if (!this.socket) {
      this.initializeSocketConnection();
    }
    
    console.log('Sending message to:', recipientId, message);
    
    this.socket?.emit('private_message', {
      recipient: recipientId,
      message,
      ticketId
    });
    
    // Stop typing indicator when message is sent
    this.sendTypingIndicator(recipientId, false);
  }
  
  // Send typing indicator
  sendTypingIndicator(recipientId: string, isTyping: boolean): void {
    if (!this.socket) return;
    
    this.socket.emit('typing', {
      recipient: recipientId,
      isTyping
    });
  }
  
  // Mark messages from a sender as read
  markMessageAsRead(senderId: string): void {
    const currentUser = this.userService.getLoggedInUser();
    const token = this.authService.getToken();
    
    if (!currentUser || !currentUser._id) return;
    
    console.log('Marking messages as read from:', senderId);
    
    // Add auth headers to the request
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    this.http.patch(`${this.apiUrl}/chat/read/${currentUser._id}/${senderId}`, {}, { headers })
      .subscribe(() => {
        // Update read status in local messages
        const currentMessages = this.messagesSubject.value;
        const updatedMessages = currentMessages.map(msg => {
          if (msg.sender === senderId && !msg.read) {
            return {...msg, read: true};
          }
          return msg;
        });
        
        // Also update in allMessages
        this.allMessages = this.allMessages.map(msg => {
          if (msg.sender === senderId && !msg.read) {
            return {...msg, read: true};
          }
          return msg;
        });
        
        this.messagesSubject.next(updatedMessages);
      });
  }
  
  searchMessages(searchTerm: string): Observable<ChatMessage[]> {
    const currentUser = this.userService.getLoggedInUser();
    const token = this.authService.getToken();
    
    if (!currentUser || !currentUser._id) {
      return new Observable(subscriber => {
        subscriber.error('User not authenticated');
        subscriber.complete();
      });
    }
    
    // Add auth headers to the request
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/chat/search/${currentUser._id}/${searchTerm}`, { headers });
  }
  
  // Public method to connect to the socket server
  connect(): void {
    console.log('Connecting to chat service');
    // Initialize socket connection if in browser environment
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSocketConnection();
    }
  } 

  // Disconnect socket when service is destroyed
  disconnect(): void {
    console.log('Disconnecting from chat service');
    this.socket?.disconnect();
    this.socket = null;
  }
  
  // Get all cached messages for a user
  getStoredMessages(userId: string): ChatMessage[] {
    const currentUser = this.userService.getLoggedInUser();
    if (!currentUser) return [];
    
    return this.allMessages.filter(
      msg => (msg.sender === userId && msg.recipient === currentUser._id) || 
             (msg.sender === currentUser._id && msg.recipient === userId)
    );
  }
}