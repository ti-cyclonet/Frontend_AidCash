import { Component, OnInit } from '@angular/core';
import { UserService } from '../../shared/services/user/user.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.getUsers();
  }

  getUsers(): void {
    this.userService.getUsers().subscribe({
      next: (result) => {
        this.users = result;
      },
      error: (e) => {
        console.log(e);
      },
    });
  }
}
