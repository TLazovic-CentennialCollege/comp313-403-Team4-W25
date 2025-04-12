import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '../../../primeng.module';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { User } from '../../data/models/user.model';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ChatMessage, ActiveUser } from '../../models/chat.model';

@Component({
  selector: 'app-hr-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimengModule],
  templateUrl: './hr-chat.component.html',
  styleUrls: ['./hr-chat.component.css']
})
export class HrChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;
  
  currentUser: User | null = null;
  activeEmployeeUsers: ActiveUser[] = [];
  messages: ChatMessage[] = [];
  selectedUser: ActiveUser | null = null;
  newMessage: string = '';
  searchTerm: string = '';
  isSearching: boolean = false;
  partnerIsTyping: boolean = false;
  showChatPanel: boolean = false;
  
  // For tracking unread messages
  unreadCounts = new Map<string, number>();
  
  // Add this property to store all messages
  private allMessages: ChatMessage[] = [];
  
  private subscriptions: Subscription[] = [];
  private typingSubject = new Subject<string>();
  
  constructor(
    private chatService: ChatService,
    private userService: UserService
  ) {}
 
  ngOnInit(): void {
    console.log('HR Chat component initialized');
    this.currentUser = this.userService.getLoggedInUser();
    
    // Connect to chat service
    this.chatService.connect();
    
    // Subscribe to active employee users
    this.subscriptions.push(
      this.chatService.activeEmployeeUsers$.subscribe(users => {
        console.log('Active employee users updated:', users);
        this.activeEmployeeUsers = users || [];
      })
    );
    
    // Subscribe to new messages
    this.subscriptions.push(
      this.chatService.newMessage$.subscribe(message => {
        this.handleNewMessage(message);
      })
    );
    
    // Subscribe to typing indicators
    this.subscriptions.push(
      this.chatService.typing$.subscribe(({ userId, isTyping }) => {
        if (this.selectedUser && userId === this.selectedUser.id) {
          this.partnerIsTyping = isTyping;
        }
      })
    );
    
    // Setup debounced typing indicator
    this.subscriptions.push(
      this.typingSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(message => {
        if (this.selectedUser) {
          this.chatService.sendTypingIndicator(
            this.selectedUser.id, 
            message.length > 0
          );
        }
      })
    );
  }
  
  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.chatService.disconnect();
  }
  
  // Toggle chat panel visibility
  toggleChat(): void {
    this.showChatPanel = !this.showChatPanel;
  }
  
  // Select a user to chat with
  selectUser(user: ActiveUser): void {
    this.selectedUser = user;
    this.isSearching = false;
    this.searchTerm = '';
    
    // Get any pending messages for this user from our local store
    const pendingMessages = this.allMessages.filter(
      msg => msg.sender === user.id || msg.recipient === user.id
    );
    
    console.log('Pending messages for this user:', pendingMessages);
    
    // Load chat history
    this.chatService.loadChatHistory(user.id).subscribe(
      messages => {
        console.log('Loaded chat history from server:', messages);
        
        // Combine history with any pending messages that aren't in the history
        let combinedMessages = [...messages];
        
        // Add any pending messages that aren't in the history
        pendingMessages.forEach(pendingMsg => {
          // Check if this message is already in history (by ID or content)
          const exists = combinedMessages.some(m => 
            m._id === pendingMsg._id || 
            (m.sender === pendingMsg.sender && 
             m.message === pendingMsg.message && 
             Math.abs(new Date(m.createdAt).getTime() - new Date(pendingMsg.createdAt).getTime()) < 5000)
          );
          
          if (!exists) {
            console.log('Adding pending message not in history:', pendingMsg);
            combinedMessages.push(pendingMsg);
          }
        });
        
        // Sort by timestamp
        combinedMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        this.messages = combinedMessages;
        
        // Reset unread count
        this.unreadCounts.set(user.id, 0);
        
        // Mark incoming messages as read
        if (combinedMessages.some(m => m.read === false && m.sender === user.id)) {
          this.chatService.markMessageAsRead(user.id);
        }
        
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error => console.error('Error loading chat history:', error)
    );
  }
  
  // Get total unread count for badge
  getTotalUnreadCount(): number {
    let total = 0;
    this.unreadCounts.forEach(count => total += count);
    return total;
  }
  
  // Handle message input (for typing indicator)
  onMessageInput(): void {
    this.typingSubject.next(this.newMessage);
  }
  
  // Send message
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedUser) return;
    
    this.chatService.sendMessage(this.selectedUser.id, this.newMessage);
    
    // Optimistically add message to UI
    const now = new Date();
    const optimisticMessage: ChatMessage = {
      _id: `temp-${now.getTime()}`,
      sender: this.currentUser?._id || '',
      recipient: this.selectedUser.id,
      message: this.newMessage,
      read: false,
      createdAt: now,
      senderName: this.currentUser?.name || '',
      senderRole: this.currentUser?.role || ''
    };
    
    this.messages.push(optimisticMessage);
    this.newMessage = '';
    setTimeout(() => this.scrollToBottom(), 100);
  }

  // Handle new incoming message
  private handleNewMessage(message: ChatMessage): void {
    console.log('New message received:', message);
    
    // Always store the message, regardless of UI state
    if (!this.allMessages.some(m => m._id === message._id)) {
      this.allMessages.push(message);
    }
    
    // If message is from this user
    if (message.recipient === this.currentUser?._id) {
      // If currently chatting with sender
      if (this.selectedUser && message.sender === this.selectedUser.id) {
        // Add message to chat
        if (!this.messages.some(m => m._id === message._id)) {
          this.messages.push(message);
          this.chatService.markMessageAsRead(message.sender);
          setTimeout(() => this.scrollToBottom(), 100);
        }
      } else {
        // Increment unread count for this sender
        const currentCount = this.unreadCounts.get(message.sender) || 0;
        this.unreadCounts.set(message.sender, currentCount + 1);
      }
    } else if (this.selectedUser && message.recipient === this.selectedUser.id) {
      // Message is a reply to currently selected chat
      if (!this.messages.some(m => m._id === message._id)) {
        this.messages.push(message);
        setTimeout(() => this.scrollToBottom(), 100);
      }
    }
  }
  
  // Get unread count for a specific user
  getUnreadCount(userId: string): number {
    return this.unreadCounts.get(userId) || 0;
  }
  
  // Scroll to bottom of chat container
  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop = 
        this.messageContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }
}