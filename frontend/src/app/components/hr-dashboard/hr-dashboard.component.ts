import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '../../../primeng.module';
import { TicketService } from '../../services/ticket.service';
import { UserService } from '../../services/user.service';
import { RouterService } from '../../services/router.service';
import { Ticket } from '../../data/models/ticket.model';
import { User } from '../../data/models/user.model';
import { StatusEnum, STATUS_OPTIONS } from '../../data/enums/StatusEnum';
import { SentimentEnum } from '../../data/enums/SentimentEnum';
import { PriorityEnum, PRIORITY_OPTIONS } from '../../data/enums/PriorityEnum';
import { CategoryEnum, CATEGORY_OPTIONS } from '../../data/enums/CategoryEnum';
import { HttpClientModule } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { RecommendationService } from '../../services/recommendation.service';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    HttpClientModule,
    TooltipModule,
  ],
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.css'],
})
export class HrDashboardComponent implements OnInit {
  // Add this line to expose StatusEnum to the template
  StatusEnum = StatusEnum;

  // Add this line to expose CategoryEnum to the template
  CategoryEnum = CategoryEnum;

  // Tickets organized by status
  openTickets: Ticket[] = [];
  inProgressTickets: Ticket[] = [];
  resolvedTickets: Ticket[] = [];
  closedTickets: Ticket[] = [];

  // Selected ticket for details panel
  selectedTicket: Ticket | null = null;

  // HR representatives for assignment
  hrUsers: { id: string; username: string }[] = [];
  selectedHrId: string = '';

  // Use the shared option constants
  statusOptions = STATUS_OPTIONS;
  priorityOptions = PRIORITY_OPTIONS;
  categoryOptions = CATEGORY_OPTIONS;

  // Filter and Sort options
  filterText: string = '';
  filterPriority: string = '';
  filterCategory: string = '';
  sortBy: string = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Add to the component's class properties
  recommendations: any[] = [];
  isLoadingRecommendations: boolean = false;

  showChatbot = false;
  
  constructor(
    private ticketService: TicketService,
    private userService: UserService,
    private routerService: RouterService,
    private messageService: MessageService,
    private recommendationService: RecommendationService
  ) {}

  ngOnInit(): void {
    this.loadTickets();
    this.loadHrUsers();
  }

  loadTickets(): void {
    this.ticketService.loadTickets().subscribe((tickets: Ticket[]) => {
      // Use spread operator to simplify mapping
      const allTickets = tickets.map((ticket) => ({
        ...ticket,
        // Only set properties that need special handling
        category: ticket.category || CategoryEnum.General,
        dateAndTimeOfCreation: ticket.createdAt
          ? ticket.createdAt.toISOString()
          : new Date().toISOString(),
      }));

      // Filter and sort the tickets
      const filteredTickets = this.applyFilters(allTickets);

      // Distribute tickets by status
      this.openTickets = filteredTickets.filter(
        (ticket) => ticket.status === StatusEnum.Open
      );
      this.inProgressTickets = filteredTickets.filter(
        (ticket) => ticket.status === StatusEnum.InProgress
      );
      this.resolvedTickets = filteredTickets.filter(
        (ticket) => ticket.status === StatusEnum.Resolved
      );
      this.closedTickets = filteredTickets.filter(
        (ticket) => ticket.status === StatusEnum.Closed
      );
    });
  }

  loadHrUsers(): void {
    this.userService.getHrUsers().subscribe(
      (hrUsers) => {
        this.hrUsers = hrUsers;
      },
      (error) => {
        console.error('Failed to load HR users:', error);
      }
    );
  }

  applyFilters(tickets: Ticket[]): Ticket[] {
    let result = [...tickets];

    // Text search (searches in title and description)
    if (this.filterText) {
      const searchText = this.filterText.toLowerCase();
      result = result.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(searchText) ||
          ticket.description.toLowerCase().includes(searchText)
      );
    }

    // Priority filter
    if (this.filterPriority) {
      result = result.filter(
        (ticket) => ticket.priority === this.filterPriority
      );
    }

    // Category filter
    if (this.filterCategory) {
      result = result.filter(
        (ticket) => ticket.category === this.filterCategory
      );
    }

    // Sorting
    result = this.sortTickets(result);

    return result;
  }

  sortTickets(tickets: Ticket[]): Ticket[] {
    return tickets.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { High: 0, Medium: 1, Low: 2 };
          comparison =
            (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1);
          break;
        case 'createdAt':
        default:
          // Add null checks with fallback to current timestamp
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : Date.now();
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : Date.now();
          comparison = dateB - dateA;
          break;
      }
      // Reverse for ascending order
      return this.sortOrder === 'desc' ? comparison : -comparison;
    });
  }

  resetFilters(): void {
    this.filterText = '';
    this.filterPriority = '';
    this.filterCategory = '';
    this.loadTickets();
  }

  selectTicket(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.selectedHrId = ticket.assignedTo || '';
    this.isLoadingRecommendations = true;

    // Get recommendations for ticket assignment
    this.recommendationService.getRecommendedAssignee(ticket).subscribe(
      (recs) => {
        this.recommendations = recs;
        this.isLoadingRecommendations = false;
      },
      (error) => {
        console.error('Error loading recommendations:', error);
        this.isLoadingRecommendations = false;
        this.recommendations = [];
      }
    );
  }

  assignTicket(): void {
    if (this.selectedTicket && this.selectedTicket.id) {
      this.ticketService.assignTicket(
        this.selectedTicket.id,
        this.selectedHrId
      );
      this.loadTickets();
    }
  }

  updateStatus(ticket: Ticket, newStatus: StatusEnum): void {
    console.log(
      `HR Dashboard: Attempting to update ticket ${ticket.id} status from ${ticket.status} to ${newStatus}`
    );

    if (!ticket.id) {
      console.error('Cannot update ticket without ID');
      return;
    }

    // Update the ticket object with the new status
    const updatedTicket = { ...ticket, status: newStatus };

    this.ticketService.updateTicket(ticket.id, updatedTicket).subscribe(
      (updatedTicket) => {
        console.log('Ticket updated successfully:', updatedTicket);
        this.loadTickets();
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket = updatedTicket;
        }
      },
      (error) => {
        console.error('Error updating ticket:', error);
      }
    );
  }

  updatePriority(ticket: Ticket, newPriority: PriorityEnum): void {
    console.log(
      `HR Dashboard: Attempting to update ticket ${ticket.id} priority from ${ticket.priority} to ${newPriority}`
    );

    if (!ticket.id) {
      console.error('Cannot update ticket without ID');
      return;
    }

    // Update the ticket object with the new priority
    const updatedTicket = { ...ticket, priority: newPriority };

    this.ticketService.updateTicket(ticket.id, updatedTicket).subscribe(
      (updatedTicket) => {
        console.log('Ticket updated successfully:', updatedTicket);
        this.loadTickets();
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket = updatedTicket;
        }
      },
      (error) => {
        console.error('Error updating ticket priority:', error);
      }
    );
  }

  closeDetails(): void {
    this.selectedTicket = null;
  }

  goToHome(): void {
    this.routerService.navigateToHome();
  }

  // Add this method to update HR rep assignment
  assignHrRep(ticket: Ticket, hrUserId: string): void {
    console.log(
      `HR Dashboard: Assigning HR rep ${hrUserId} to ticket ${ticket.id}`
    );

    if (!ticket.id) {
      console.error('Cannot update ticket without ID');
      return;
    }

    // Create updated ticket with new HR rep assigned
    const updatedTicket = {
      ...ticket,
      assignedTo: hrUserId,
    };

    this.ticketService.updateTicket(ticket.id, updatedTicket).subscribe(
      (result) => {
        console.log('Ticket updated with new HR rep:', result);
        this.loadTickets();
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket = result;
        }
        // Optional: Show success message
        this.messageService.add({
          severity: 'success',
          summary: 'HR Rep Assigned',
          detail: 'Ticket has been assigned to a new HR representative',
        });
      },
      (error) => {
        console.error('Error assigning HR rep to ticket:', error);
        // Optional: Show error message
        this.messageService.add({
          severity: 'error',
          summary: 'Assignment Failed',
          detail: 'Could not assign ticket to HR representative',
        });
      }
    );
  }
}
