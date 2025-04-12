import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimengModule } from '../primeng.module';
import { CommonModule } from '@angular/common';
import { UserService } from './services/user.service';
import { EmployeeChatComponent } from './components/chat/employee-chat.component';
import { HrChatComponent } from './components/chat/hr-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    PrimengModule, 
    CommonModule,
    EmployeeChatComponent,
    HrChatComponent
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'hopper';
  
  constructor(public userService: UserService) {}
}