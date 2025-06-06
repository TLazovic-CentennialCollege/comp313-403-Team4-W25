import { Component, Input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimengModule } from '../primeng.module';
import { User } from './data/models/user.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PrimengModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  @Input({ required: true }) user!: User;
  title = 'hopper';

  onSuccessfulLogin(loggedInUser: User) {
    // do login stuff
    this.user = loggedInUser;
  }
}
