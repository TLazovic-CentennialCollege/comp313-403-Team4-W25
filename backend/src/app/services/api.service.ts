import { Injectable } from "@angular/core";
import {
	HttpClient,
	HttpHeaders,
	HttpErrorResponse,
} from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { environment } from "../../environments/environment";

@Injectable({
	providedIn: "root",
})
export class ApiService {
	private apiUrl = environment.apiUrl || "/api";

	constructor(private http: HttpClient) {}

	// Get headers with auth token if available
	private getHeaders(): HttpHeaders {
		// Only set content type, let the interceptor handle the auth token
		return new HttpHeaders({
			"Content-Type": "application/json",
		});
	}

	// GET request
	get(endpoint: string): Observable<any> {
		return this.http
			.get(`${this.apiUrl}/${endpoint}`, {
				headers: this.getHeaders(),
				withCredentials: true, // Important for cookie-based auth
			})
			.pipe(catchError(this.handleError));
	}

	// POST request
	post(endpoint: string, data: any): Observable<any> {
		return this.http
			.post(`${this.apiUrl}/${endpoint}`, data, {
				headers: this.getHeaders(),
				withCredentials: true, // Important for cookie-based auth
			})
			.pipe(catchError(this.handleError));
	}

	// PUT request
	put(endpoint: string, data: any): Observable<any> {
		return this.http
			.put(`${this.apiUrl}/${endpoint}`, data, {
				headers: this.getHeaders(),
				withCredentials: true, // Important for cookie-based auth
			})
			.pipe(catchError(this.handleError));
	}

	// DELETE request
	delete(endpoint: string): Observable<any> {
		return this.http
			.delete(`${this.apiUrl}/${endpoint}`, {
				headers: this.getHeaders(),
				withCredentials: true, // Important for cookie-based auth
			})
			.pipe(catchError(this.handleError));
	}

	// Error handler
	private handleError(error: HttpErrorResponse) {
		return throwError(() => error);
	}
}
