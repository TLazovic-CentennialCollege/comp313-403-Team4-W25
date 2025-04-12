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
  selector: 'app-employee-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimengModule],
  templateUrl: './employee-chat.component.html',
  styleUrls: ['./employee-chat.component.css']
})
export class EmployeeChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;
  
  currentUser: User | null = null;
  activeHrUsers: ActiveUser[] = [];
  messages: ChatMessage[] = [];
  selectedUser: ActiveUser | null = null;
  newMessage: string = '';
  searchTerm: string = '';
  isSearching: boolean = false;
  partnerIsTyping: boolean = false;
  showChatPanel: boolean = false;
  
  private subscriptions: Subscription[] = [];
  private typingSubject = new Subject<string>();
  
  constructor(
    private chatService: ChatService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    console.log('Employee Chat component initialized');
    this.currentUser = this.userService.getLoggedInUser();
    
    // Connect to chat service
    this.chatService.connect();
    
    // Subscribe to active HR users
    this.subscriptions.push(
      this.chatService.activeHrUsers$.subscribe(users => {
        console.log('Active HR users updated:', users);
        this.activeHrUsers = users || [];
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
    
    // Load chat history
    this.chatService.loadChatHistory(user.id).subscribe(
      messages => {
        console.log('Loaded chat history:', messages);
        this.messages = messages;
        // Mark incoming messages as read
        if (messages.some(m => m.read === false && m.sender === user.id)) {
          this.chatService.markMessageAsRead(user.id);
        }
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error => console.error('Error loading chat history:', error)
    );
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
    
    // If we're already chatting with this person
    if (this.selectedUser && 
        (message.sender === this.selectedUser.id || 
         message.recipient === this.selectedUser.id)) {
      
      // Check if message is already in our list (avoid duplicates)
      if (!this.messages.some(m => m._id === message._id)) {
        this.messages.push(message);
        setTimeout(() => this.scrollToBottom(), 100);
      }
      
      // Mark as read if from current selected user
      if (message.sender === this.selectedUser.id && !message.read) {
        this.chatService.markMessageAsRead(message.sender);
      }
    }
  }
  
  // Scroll to bottom of chat container
  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop = 
        this.messageContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }
}