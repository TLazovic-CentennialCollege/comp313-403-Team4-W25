import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { Ticket } from '../data/models/ticket.model';
import { User } from '../data/models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Core HTTP methods with auth headers
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, {
      headers: this.getAuthHeaders(),
    });
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  patch<T>(endpoint: string, data: any): Observable<T> {
    return this.http.patch<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${endpoint}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Auth-specific endpoints
  login(email: string, password: string): Observable<any> {
    return this.post('/auth/login', {
      employeeNumber: email,
      password,
    });
  }

  // User endpoints
  getUsers(): Observable<User[]> {
    return this.get<User[]>('/users');
  }

  getUserById(id: string): Observable<User> {
    return this.get<User>(`/users/${id}`);
  }

  // Ticket endpoints
  getTickets(): Observable<Ticket[]> {
    return this.get<Ticket[]>('/tickets');
  }

  getTicketById(id: string): Observable<Ticket> {
    return this.get<Ticket>(`/tickets/${id}`);
  }

  createTicket(ticket: Ticket): Observable<Ticket> {
    console.log('API Service: Creating new ticket:', ticket);
    return this.post<Ticket>('/tickets', ticket).pipe(
      tap((response) => console.log('Server response:', response)),
      catchError((error) => {
        console.error('API Error:', error);
        return throwError(() => error);
      })
    );
  }

  updateTicket(ticketId: string, ticket: Ticket): Observable<Ticket> {
    console.log('API Service: Updating ticket with status:', ticket.status);
    return this.put<Ticket>(`/tickets/${ticketId}`, ticket).pipe(
      tap((response) => console.log('API Response:', response)),
      catchError((error) => {
        console.error('API Error:', error);
        return throwError(() => error);
      })
    );
  }

  deleteTicket(id: string): Observable<any> {
    return this.delete<any>(`/tickets/${id}`);
  }

  getTicketsByUserId(userId: string): Observable<any[]> {
    return this.get<any[]>(`/tickets/user/${userId}`);
  }

  assignTicket(id: string, hrUserId: string): Observable<Ticket> {
    return this.patch<Ticket>(`/tickets/${id}/assign`, {
      assignedTo: hrUserId,
    });
  }
}
