export interface ChatMessage {
    _id: string;
    sender: string;
    recipient: string;
    message: string;
    read: boolean;
    createdAt: Date;
    
    // Additional fields for UI display
    senderName?: string;
    senderRole?: string;
  }
  
  export interface ActiveUser {
    id: string;
    name: string;
    department?: string;
  }